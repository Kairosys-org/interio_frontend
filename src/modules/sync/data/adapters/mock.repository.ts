import type { SyncRepository } from '../repository';
import {
	mockClearSent,
	mockLocalIdFor,
	mockPendingCounts,
	mockPull,
	mockPush,
	mockResolveConflict,
	mockRetry,
	mockSyncOperation,
	mockSyncOperations
} from '../mock';

/** Thin, boring adapter: one line per repository method (architecture §4.7). */
export const mockSyncRepository: SyncRepository = {
	pending: async () => mockPendingCounts(),
	operations: async (state) => mockSyncOperations(state),
	push: async () => mockPush(),
	pull: async (params) => mockPull(params),
	retry: async (idempotencyKey) => mockRetry(idempotencyKey),
	resolveConflict: async (idempotencyKey, input) => mockResolveConflict(idempotencyKey, input),
	clearSent: async () => mockClearSent(),
	operation: async (idempotencyKey) => mockSyncOperation(idempotencyKey),
	localIdFor: async (idempotencyKey) => mockLocalIdFor(idempotencyKey)
};
