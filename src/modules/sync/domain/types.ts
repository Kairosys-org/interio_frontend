import type { SyncOpState } from '$shared/domain/record-states';
import type { Uuid } from '$shared/domain/uuid';

export type { SyncOpState };

/**
 * Sync domain contract (spec Part 9 §13, Part 10 §24).
 *
 * Scope is the survey mobile app only: survey tree rows and their assets push
 * through one outbox. The queue is a real collection (`sync_operation`) so it
 * survives a reload; the mock transport simulates `POST /sync/push` and
 * `GET /sync/pull` including idempotent replay and the precondition conflict
 * path. Server wins; the user re-applies explicitly (Q10 decision).
 */

export const SYNC_ENTITIES = [
	'survey',
	'room',
	'wall',
	'opening',
	'utility',
	'obstacle',
	'measurement',
	'note',
	'asset'
] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export const SYNC_OPS = [
	'create',
	'update',
	'transition',
	'verify',
	'revision',
	'asset_state'
] as const;
export type SyncOp = (typeof SYNC_OPS)[number];

export interface SyncConflict {
	/** Server row version that beat the queued precondition. */
	serverUpdatedAt: string;
	/** Field-level view for the side-by-side sheet; server wins. */
	server: Record<string, unknown>;
	local: Record<string, unknown>;
	fields: string[];
}

export interface SyncOperation {
	id: Uuid;
	tenantId: Uuid;
	userId: Uuid;
	/** UUIDv7-shaped and stable across reloads — the replay key. */
	idempotencyKey: string;
	entity: SyncEntity;
	op: SyncOp;
	localId: Uuid;
	payload: Record<string, unknown>;
	/**
	 * Wire precondition: the row version the local edit was based on.
	 * The mock detects a moved server row by comparing the target row's
	 * `updatedAt` with this op's `createdAt` — a row changed after the op was
	 * queued cannot be overwritten silently (Q10). `baseUpdatedAt` is still
	 * carried so the fixture and the future API adapter speak the spec format.
	 */
	baseUpdatedAt: string | null;
	state: SyncOpState;
	attempts: number;
	lastError: string | null;
	conflict: SyncConflict | null;
	result: Record<string, unknown> | null;
	clientTimestamp: string;
	createdAt: string;
	sentAt: string | null;
}

export interface SyncPendingCounts {
	queued: number;
	sending: number;
	failed: number;
	conflict: number;
	/** Metadata rows only; byte quotas stay out of phase 2 (Q15). */
	assetsPending: number;
	assetsUploading: number;
	assetsFailed: number;
	/** Everything the chip counts as "not synced". */
	unsent: number;
}

export interface SyncOperationResult {
	idempotencyKey: string;
	entity: SyncEntity;
	op: SyncOp;
	localId: Uuid;
	/** `sent` after an applied or replayed op; `conflict`; `failed`. */
	state: 'sent' | 'conflict' | 'failed';
	/** Server-authoritative id when the server substituted one. */
	authoritativeId: Uuid | null;
	error: string | null;
	conflict: SyncConflict | null;
}

export interface SyncPushResult {
	/** Per-op results, in queue order; a rejected op never aborts the batch. */
	results: SyncOperationResult[];
	applied: number;
	conflicts: number;
	failed: number;
}

export interface SyncPullParams {
	/** Opaque cursor from the previous pull; tenant-scoped (R8/S39). */
	since?: string | null;
	/** Restrict to one assigned project (S1). */
	projectId?: Uuid | null;
}

export interface SyncPullChange {
	entity: SyncEntity;
	id: Uuid;
	updatedAt: string;
	/** Status is carried for resume lists without a second read. */
	status: string | null;
}

export interface SyncPullResult {
	cursor: string;
	changes: SyncPullChange[];
	pulledAt: string;
}

export interface ResolveConflictInput {
	/** `accept_server` keeps the server row; `reapply_local` re-queues. */
	decision: 'accept_server' | 'reapply_local';
	/** Optional subset of fields to re-apply; omitted = every local field. */
	fields?: string[];
}

/** What the survey repository provider hands to the outbox seam. */
export interface EnqueueOutboxInput {
	entity: SyncEntity;
	op: SyncOp;
	localId: Uuid;
	payload: Record<string, unknown>;
	/** Known row version before the edit; the push precondition. */
	baseUpdatedAt?: string | null;
	/** Reuse the key when retrying an already-identified operation. */
	idempotencyKey?: string;
}
