import { apiCall } from '$network/api';
import { requirePermission } from '$network/guard';
import { PLATFORM_PERMISSIONS } from '$shared/domain/permissions';
import type {
	CreateTenantInput,
	PlatformAuditListParams,
	TenantListParams,
	TenantTransitionInput
} from '../domain/types';
import { getPlatformTenantsRepository } from './repository-provider';

/**
 * The UI boundary. Presentation calls only these functions (architecture §4.5);
 * reads are latency-wrapped by `apiCall`, mutations also re-check the platform
 * scope here so the facade is safe even without the mock's server-side guard.
 */
export const platformTenantsApi = {
	list(params: TenantListParams = {}) {
		return apiCall(() => getPlatformTenantsRepository().list(params));
	},

	get(id: string) {
		return apiCall(() => getPlatformTenantsRepository().get(id));
	},

	create(input: CreateTenantInput) {
		return apiCall(() => {
			requirePermission(PLATFORM_PERMISSIONS.PLATFORM_TENANT_CREATE);
			return getPlatformTenantsRepository().create(input);
		});
	},

	transition(id: string, input: TenantTransitionInput) {
		return apiCall(() => {
			requirePermission(PLATFORM_PERMISSIONS.PLATFORM_TENANT_SUSPEND);
			return getPlatformTenantsRepository().transition(id, input);
		});
	},

	listAudit(params: PlatformAuditListParams = {}) {
		return apiCall(() => getPlatformTenantsRepository().listAudit(params));
	}
};
