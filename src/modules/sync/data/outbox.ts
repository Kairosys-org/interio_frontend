import { COLLECTIONS } from '$shared/data/collections';
import { requireTenantSession } from '$shared/data/mock-session';
import type { SyncConflictRecord, SyncOperationRecord } from '$shared/data/records';
import type { SyncOpState } from '$shared/domain/record-states';
import type { Uuid } from '$shared/domain/uuid';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, setCollection } from '$network/mock-backend';
import type { EnqueueOutboxInput } from '../domain/types';

/**
 * Outbox seam (orchestrator-owned, frozen in wave 0).
 *
 * This is the one contract between the survey data layer (which enqueues an
 * operation when a mobile write cannot reach the server) and the sync module
 * (which drains it through the simulated `/sync/push`). It lives over the
 * `sync_operation` collection so the queue survives a reload even though the
 * mock backend is the "server": `localStorage` is already the durable store.
 *
 * Browser-only. Never import this from an SSR-safe file, presentation or a
 * route module (phase-2 §4 offline note).
 */

export function newIdempotencyKey(): string {
	const bytes = new Uint8Array(16);
	const random = randomBytes(10);
	bytes.set(random, 6);

	let timestamp = Date.now();
	for (let index = 5; index >= 0; index -= 1) {
		bytes[index] = timestamp % 256;
		timestamp = Math.floor(timestamp / 256);
	}

	// RFC 9562 UUIDv7: version nibble 7 and variant bits 10.
	bytes[6] = (bytes[6] & 0x0f) | 0x70;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomBytes(length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
		throw new Error('crypto.getRandomValues is unavailable in this environment.');
	}
	crypto.getRandomValues(bytes);
	return bytes;
}

interface OutboxScope {
	tenantId: Uuid;
	userId: Uuid;
}

/**
 * Broadcast that the queue moved so the mobile shell can refresh its chip and
 * tab badge. Any enqueue, patch or clear happens below this seam, so the shell
 * never has to poll.
 */
function notifySyncChanged(): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event('interio:sync-changed'));
}

function scope(): OutboxScope {
	const { tenantId, user } = requireTenantSession();
	return { tenantId, userId: user.id };
}

function owned(row: SyncOperationRecord, owner: OutboxScope): boolean {
	return row.tenantId === owner.tenantId && row.userId === owner.userId;
}

function notFound(): ApiError {
	return new ApiError({
		code: ApiErrorCode.NOT_FOUND,
		status: 404,
		message: 'That queued change no longer exists.'
	});
}

/**
 * Adds one operation to the queue. Re-enqueuing the same `idempotencyKey`
 * returns the existing row untouched — a double tap can never duplicate work
 * (Part 9 §16).
 */
export function enqueueOutbox(input: EnqueueOutboxInput): SyncOperationRecord {
	const owner = scope();
	const idempotencyKey = input.idempotencyKey ?? newIdempotencyKey();

	const existing = findOperation(owner, idempotencyKey);
	if (existing) return existing;

	const now = new Date().toISOString();
	const record: SyncOperationRecord = {
		id: newUuid(),
		tenantId: owner.tenantId,
		userId: owner.userId,
		idempotencyKey,
		entity: input.entity,
		op: input.op,
		localId: input.localId,
		payload: input.payload,
		baseUpdatedAt: input.baseUpdatedAt ?? null,
		state: 'queued',
		attempts: 0,
		lastError: null,
		conflict: null,
		result: null,
		clientTimestamp: now,
		createdAt: now,
		sentAt: null
	};

	setCollection<SyncOperationRecord>(COLLECTIONS.syncOperations, [
		...getCollection<SyncOperationRecord>(COLLECTIONS.syncOperations),
		record
	]);
	notifySyncChanged();
	return record;
}

export function findOperation(
	owner: OutboxScope,
	idempotencyKey: string
): SyncOperationRecord | null {
	return (
		getCollection<SyncOperationRecord>(COLLECTIONS.syncOperations).find(
			(row) => owned(row, owner) && row.idempotencyKey === idempotencyKey
		) ?? null
	);
}

/** Queue rows for the current user, oldest first (push order). */
export function listOutbox(state?: SyncOpState): SyncOperationRecord[] {
	const owner = scope();
	return getCollection<SyncOperationRecord>(COLLECTIONS.syncOperations)
		.filter((row) => owned(row, owner) && (state === undefined || row.state === state))
		.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

export interface OutboxPatch {
	state?: SyncOpState;
	attempts?: number;
	lastError?: string | null;
	conflict?: SyncConflictRecord | null;
	result?: Record<string, unknown> | null;
	sentAt?: string | null;
}

export function patchOutbox(idempotencyKey: string, patch: OutboxPatch): SyncOperationRecord {
	const owner = scope();
	const rows = getCollection<SyncOperationRecord>(COLLECTIONS.syncOperations);
	const existing = rows.find((row) => owned(row, owner) && row.idempotencyKey === idempotencyKey);
	if (!existing) throw notFound();

	const updated: SyncOperationRecord = { ...existing, ...patch };
	setCollection<SyncOperationRecord>(
		COLLECTIONS.syncOperations,
		rows.map((row) => (row.id === existing.id ? updated : row))
	);
	notifySyncChanged();
	return updated;
}

export interface OutboxCounts {
	queued: number;
	sending: number;
	failed: number;
	conflict: number;
	unsent: number;
}

/** Operation counts only; the sync facade adds the asset counters. */
export function outboxCounts(): OutboxCounts {
	const rows = listOutbox();
	const counts: OutboxCounts = { queued: 0, sending: 0, failed: 0, conflict: 0, unsent: 0 };
	for (const row of rows) {
		if (row.state === 'queued') counts.queued += 1;
		else if (row.state === 'sending') counts.sending += 1;
		else if (row.state === 'failed') counts.failed += 1;
		else if (row.state === 'conflict') counts.conflict += 1;
	}
	counts.unsent = counts.queued + counts.sending + counts.failed + counts.conflict;
	return counts;
}

/** Drops sent rows only. Failed and conflicted rows stay until resolved (N3). */
export function clearSentOutbox(): number {
	const owner = scope();
	const rows = getCollection<SyncOperationRecord>(COLLECTIONS.syncOperations);
	const kept = rows.filter((row) => !owned(row, owner) || row.state !== 'sent');
	const removed = rows.length - kept.length;
	if (removed > 0) {
		setCollection<SyncOperationRecord>(COLLECTIONS.syncOperations, kept);
		notifySyncChanged();
	}
	return removed;
}
