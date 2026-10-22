import { apiCall } from '$network/api';
import { requirePermission } from '$network/guard';
import { PERMISSIONS } from '$shared/domain/permissions';
import type {
	CreateImportInput,
	ImportBatchListParams,
	ImportRowListParams
} from '../domain/types';
import { getImportsRepository } from './repository-provider';

const READ = { latencyMs: 200 } as const;
const WRITE = { latencyMs: 400 } as const;

export const importsApi = {
	list(params: ImportBatchListParams = {}) {
		return apiCall(() => getImportsRepository().list(params), READ);
	},

	get(id: string) {
		return apiCall(() => getImportsRepository().get(id), READ);
	},

	rows(id: string, params: ImportRowListParams = {}) {
		return apiCall(() => getImportsRepository().rows(id, params), READ);
	},

	create(input: CreateImportInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.IMPORT_CREATE);
			return getImportsRepository().create(input);
		}, WRITE);
	},

	commit(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.IMPORT_CREATE);
			return getImportsRepository().commit(id);
		}, WRITE);
	},

	audit(id: string) {
		return apiCall(() => getImportsRepository().audit(id), READ);
	}
};
