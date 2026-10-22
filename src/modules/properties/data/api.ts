import { apiCall } from '$network/api';
import { requirePermission } from '$network/guard';
import type { DedupReviewInput } from '$shared/domain/dedup';
import { PERMISSIONS } from '$shared/domain/permissions';
import type {
	CreatePropertyInput,
	PropertyListParams,
	UpdatePropertyInput
} from '../domain/types';
import { getPropertiesRepository } from './repository-provider';

const READ = { latencyMs: 180 } as const;
const WRITE = { latencyMs: 300 } as const;

export const propertiesApi = {
	list(params: PropertyListParams = {}) {
		return apiCall(() => getPropertiesRepository().list(params), READ);
	},

	get(id: string) {
		return apiCall(() => getPropertiesRepository().get(id), READ);
	},

	create(input: CreatePropertyInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROPERTY_CREATE);
			return getPropertiesRepository().create(input);
		}, WRITE);
	},

	update(id: string, input: UpdatePropertyInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROPERTY_UPDATE);
			return getPropertiesRepository().update(id, input);
		}, WRITE);
	},

	archive(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROPERTY_ARCHIVE);
			return getPropertiesRepository().archive(id);
		}, WRITE);
	},

	unarchive(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROPERTY_ARCHIVE);
			return getPropertiesRepository().unarchive(id);
		}, WRITE);
	},

	reviewDedup(id: string, input: DedupReviewInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROPERTY_UPDATE);
			return getPropertiesRepository().reviewDedup(id, input);
		}, WRITE);
	},

	audit(id: string) {
		return apiCall(() => getPropertiesRepository().audit(id), READ);
	}
};
