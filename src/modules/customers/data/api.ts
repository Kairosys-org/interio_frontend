import { apiCall } from '$network/api';
import { requirePermission } from '$network/guard';
import { PERMISSIONS } from '$shared/domain/permissions';
import type { DedupReviewInput } from '$shared/domain/dedup';
import type {
	CreateCustomerInput,
	CustomerListParams,
	UpdateCustomerInput
} from '../domain/types';
import { getCustomersRepository } from './repository-provider';

const READ = { latencyMs: 180 } as const;
const WRITE = { latencyMs: 300 } as const;

/** The only surface presentation may call (architecture §1, §3). */
export const customersApi = {
	list(params: CustomerListParams = {}) {
		return apiCall(() => getCustomersRepository().list(params), READ);
	},

	get(id: string) {
		return apiCall(() => getCustomersRepository().get(id), READ);
	},

	create(input: CreateCustomerInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CUSTOMER_CREATE);
			return getCustomersRepository().create(input);
		}, WRITE);
	},

	update(id: string, input: UpdateCustomerInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CUSTOMER_UPDATE);
			return getCustomersRepository().update(id, input);
		}, WRITE);
	},

	archive(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CUSTOMER_ARCHIVE);
			return getCustomersRepository().archive(id);
		}, WRITE);
	},

	unarchive(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CUSTOMER_ARCHIVE);
			return getCustomersRepository().unarchive(id);
		}, WRITE);
	},

	reviewDedup(id: string, input: DedupReviewInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CUSTOMER_UPDATE);
			return getCustomersRepository().reviewDedup(id, input);
		}, WRITE);
	},

	audit(id: string) {
		return apiCall(() => getCustomersRepository().audit(id), READ);
	}
};
