import { apiCall } from '$network/api';
import { ApiError, ApiErrorCode } from '$network/errors';
import { requirePermission } from '$network/guard';
import { PERMISSIONS } from '$shared/domain/permissions';
import type { DedupEntityType } from '$shared/domain/dedup';
import type { DedupReviewRequest } from '../domain/types';
import { getDuplicatesRepository } from './repository-provider';

const READ = { latencyMs: 200 } as const;
const WRITE = { latencyMs: 320 } as const;

const UPDATE_PERMISSION: Readonly<Record<DedupEntityType, string>> = Object.freeze({
	customer: PERMISSIONS.CUSTOMER_UPDATE,
	property: PERMISSIONS.PROPERTY_UPDATE,
	project: PERMISSIONS.PROJECT_UPDATE
});

export const duplicatesApi = {
	list() {
		return apiCall(() => getDuplicatesRepository().list(), READ);
	},

	review(input: DedupReviewRequest) {
		return apiCall(() => {
			const permission = UPDATE_PERMISSION[input.entityType];
			if (!permission) {
				throw new ApiError({
					code: ApiErrorCode.VALIDATION,
					status: 400,
					message: 'Unknown record type.'
				});
			}
			requirePermission(permission);
			return getDuplicatesRepository().review(input);
		}, WRITE);
	},

	audit(entityType: DedupEntityType, id: string) {
		return apiCall(() => getDuplicatesRepository().audit(entityType, id), READ);
	}
};
