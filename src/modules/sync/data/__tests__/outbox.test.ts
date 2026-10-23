import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));

import { session } from '$shared/application/session';
import { COLLECTIONS } from '$shared/data/collections';
import { DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import type { AppUserRecord, SyncOperationRecord } from '$shared/data/records';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import {
	clearSentOutbox,
	enqueueOutbox,
	listOutbox,
	newIdempotencyKey,
	outboxCounts,
	patchOutbox
} from '../outbox';

/**
 * Outbox seam tests (phase-2 §5.4): ordering, dedupe by idempotency key,
 * state transitions, per-user isolation and the sent-only cleanup. The harness
 * mirrors the module mock suites: an in-memory `Storage` and a demo session.
 */

class MemoryStorage implements Storage {
	private readonly rows = new Map<string, string>();

	get length(): number {
		return this.rows.size;
	}

	clear(): void {
		this.rows.clear();
	}

	getItem(key: string): string | null {
		return this.rows.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.rows.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.rows.delete(key);
	}

	setItem(key: string, value: string): void {
		this.rows.set(key, String(value));
	}
}

function installStorage(): void {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		writable: true,
		value: new MemoryStorage()
	});
}

function sessionUserFrom(record: AppUserRecord): SessionUser {
	const tenantRecord = record.tenantId
		? (DEMO_TENANTS.find((candidate) => candidate.id === record.tenantId) ?? null)
		: null;
	const tenant: TenantIdentity | null = tenantRecord
		? {
				id: tenantRecord.id,
				slug: tenantRecord.slug,
				legalName: tenantRecord.legalName,
				status: tenantRecord.status,
				branding: tenantRecord.branding
			}
		: null;

	return {
		id: record.id,
		email: record.email,
		displayName: record.displayName,
		roles: record.roles,
		permissions: record.permissions,
		tenant,
		platform: record.platform,
		mfaEnrolled: record.mfaEnrolled
	};
}

function signIn(email: string): SessionUser {
	const record = DEMO_USERS.find((candidate) => candidate.email === email);
	if (!record) throw new Error(`Demo user ${email} is missing from the seed.`);
	const user = sessionUserFrom(record);
	session.setUser(user);
	return user;
}

function enqueueMeasurementUpdate(idempotencyKey?: string): SyncOperationRecord {
	return enqueueOutbox({
		entity: 'measurement',
		op: 'update',
		localId: '00000000-0000-4000-8000-000000000001',
		payload: { valueMm: 2400 },
		baseUpdatedAt: '2026-10-20T09:00:00.000Z',
		idempotencyKey
	});
}

beforeEach(() => {
	installStorage();
	resetMockDb();
	setCollection(
		COLLECTIONS.appUsers,
		DEMO_USERS.map((user) => ({ ...user }))
	);
	signIn('surveyor@opulentinteriors.co.uk');
});

afterEach(() => {
	session.clearSession();
	delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('newIdempotencyKey', () => {
	it('produces a UUIDv7-shaped, unique key', () => {
		const first = newIdempotencyKey();
		const second = newIdempotencyKey();

		expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(second).not.toBe(first);
	});
});

describe('enqueueOutbox', () => {
	it('queues an operation owned by the signed-in user', () => {
		const user = signIn('surveyor@opulentinteriors.co.uk');
		const operation = enqueueMeasurementUpdate();

		expect(operation.state).toBe('queued');
		expect(operation.attempts).toBe(0);
		expect(operation.tenantId).toBe(user.tenant?.id);
		expect(operation.userId).toBe(user.id);
		expect(operation.conflict).toBeNull();
		expect(listOutbox()).toHaveLength(1);
	});

	it('re-enqueuing the same idempotency key never duplicates the row', () => {
		const first = enqueueMeasurementUpdate();
		const replay = enqueueMeasurementUpdate(first.idempotencyKey);

		expect(replay.id).toBe(first.id);
		expect(listOutbox()).toHaveLength(1);
	});

	it('scopes the queue to the signed-in user', () => {
		enqueueMeasurementUpdate();
		signIn('production@opulentinteriors.co.uk');

		expect(listOutbox()).toHaveLength(0);
		expect(outboxCounts().unsent).toBe(0);
	});
});

describe('patchOutbox', () => {
	it('moves a row through sending to sent and updates the counters', () => {
		const operation = enqueueMeasurementUpdate();

		patchOutbox(operation.idempotencyKey, { state: 'sending', attempts: 1 });
		expect(outboxCounts()).toMatchObject({ queued: 0, sending: 1, failed: 0, unsent: 1 });

		patchOutbox(operation.idempotencyKey, {
			state: 'sent',
			sentAt: '2026-10-22T09:05:00.000Z',
			result: { id: operation.localId }
		});
		expect(outboxCounts()).toMatchObject({ queued: 0, sending: 0, unsent: 0 });
		expect(listOutbox('sent')).toHaveLength(1);
	});

	it('keeps failed and conflict rows in the queue', () => {
		const operation = enqueueMeasurementUpdate();
		patchOutbox(operation.idempotencyKey, { state: 'failed', lastError: 'Network unavailable.' });

		const second = enqueueOutbox({
			entity: 'note',
			op: 'create',
			localId: '00000000-0000-4000-8000-000000000002',
			payload: { body: 'Access via side gate' }
		});
		patchOutbox(second.idempotencyKey, {
			state: 'conflict',
			conflict: {
				serverUpdatedAt: '2026-10-21T08:00:00.000Z',
				server: { body: 'Server value' },
				local: { body: 'Access via side gate' },
				fields: ['body']
			}
		});

		expect(outboxCounts()).toMatchObject({ failed: 1, conflict: 1, unsent: 2 });
		expect(clearSentOutbox()).toBe(0);
		expect(getCollection<SyncOperationRecord>(COLLECTIONS.syncOperations)).toHaveLength(2);
	});
});

describe('clearSentOutbox', () => {
	it('removes sent rows only', () => {
		const sent = enqueueMeasurementUpdate();
		const queued = enqueueOutbox({
			entity: 'room',
			op: 'update',
			localId: '00000000-0000-4000-8000-000000000003',
			payload: { ceilingHeightMm: 2400 }
		});
		patchOutbox(sent.idempotencyKey, { state: 'sent' });

		expect(clearSentOutbox()).toBe(1);
		const remaining = getCollection<SyncOperationRecord>(COLLECTIONS.syncOperations);
		expect(remaining.map((row) => row.idempotencyKey)).toEqual([queued.idempotencyKey]);
	});
});
