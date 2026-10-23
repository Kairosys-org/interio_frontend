import type { Uuid } from '$shared/domain/uuid';
import type {
	ResolveConflictInput,
	SyncOperation,
	SyncPendingCounts,
	SyncPullParams,
	SyncPullResult,
	SyncPushResult
} from '../domain/types';
import type { SyncOpState } from '$shared/domain/record-states';

/**
 * Sync repository contract (frozen in wave 0, architecture §4.4).
 *
 * `push()` is the simulated `POST /sync/push`: it drains the outbox in order,
 * replays a duplicate `idempotencyKey` with the original result, applies the
 * `baseUpdatedAt` precondition (server wins → `conflict` row), and retries a
 * transient failure with backoff. `pull()` is `GET /sync/pull` and merges
 * server rows over local ones.
 */
export interface SyncRepository {
	pending(): Promise<SyncPendingCounts>;
	operations(state?: SyncOpState): Promise<SyncOperation[]>;
	push(): Promise<SyncPushResult>;
	pull(params?: SyncPullParams): Promise<SyncPullResult>;
	retry(idempotencyKey: string): Promise<SyncOperation>;
	resolveConflict(idempotencyKey: string, input: ResolveConflictInput): Promise<SyncOperation>;
	/** Removes sent rows only; failed and conflict rows are never dropped (N3). */
	clearSent(): Promise<number>;
	operation(idempotencyKey: string): Promise<SyncOperation>;
	/** Local id of the entity an operation created, for the UI to link rows. */
	localIdFor(idempotencyKey: string): Promise<Uuid | null>;
}
