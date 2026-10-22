import type { PlatformTenantsRepository } from '../repository';
import {
	mockCreateTenant,
	mockGetTenant,
	mockListPlatformAudit,
	mockListTenants,
	mockTransitionTenant
} from '../mock';

/** Thin, boring adapter: one line per repository method (architecture §4.7). */
export const mockPlatformTenantsRepository: PlatformTenantsRepository = {
	list: async (params) => mockListTenants(params),
	get: async (id) => mockGetTenant(id),
	create: async (input) => mockCreateTenant(input),
	transition: async (id, input) => mockTransitionTenant(id, input),
	listAudit: async (params) => mockListPlatformAudit(params)
};
