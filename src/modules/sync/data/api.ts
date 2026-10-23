import { apiCall } from '$network/api';
import { requirePermission } from '$network/guard';
import { PERMISSIONS } from '$shared/domain/permissions';
import type { ResolveConflictInput, SyncPullParams } from '../domain/types';
import { getSyncRepository } from './repository-provider';

const READ = { latencyMs: 120 } as const;
const PUSH = { latencyMs: 320 } as const;

/**
 * Sync facade (architecture §4.5, Part 9 §13).
 *
 * There is no `sync.*` permission code in the canonical vocabulary; the queue
 * belongs to the signed-in survey user, so every call starts from
 * `survey.view` and the repository narrows rows to that user and tenant.
 */
export const syncApi = {
	pending() {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSyncRepository().pending();
		}, READ);
	},

	operations(state?: 'queued' | 'sending' | 'sent' | 'failed' | 'conflict') {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSyncRepository().operations(state);
		}, READ);
	},

	operation(idempotencyKey: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSyncRepository().operation(idempotencyKey);
		}, READ);
	},

	push() {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSyncRepository().push();
		}, PUSH);
	},

	pull(params: SyncPullParams = {}) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSyncRepository().pull(params);
		}, PUSH);
	},

	retry(idempotencyKey: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSyncRepository().retry(idempotencyKey);
		}, READ);
	},

	resolveConflict(idempotencyKey: string, input: ResolveConflictInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSyncRepository().resolveConflict(idempotencyKey, input);
		}, PUSH);
	},

	clearSent() {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSyncRepository().clearSent();
		}, READ);
	},

	localIdFor(idempotencyKey: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSyncRepository().localIdFor(idempotencyKey);
		}, READ);
	}
};
