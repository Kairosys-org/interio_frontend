import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockPlatformTenantsRepository } from './adapters/mock.repository';
import type { PlatformTenantsRepository } from './repository';

/**
 * The only place that picks mock vs API. No API adapter exists yet, so API
 * mode fails loudly with `API_DATA_SOURCE_NOT_AVAILABLE` (architecture §4.4).
 */
export function getPlatformTenantsRepository(): PlatformTenantsRepository {
	return getConfiguredRepository('platform-tenants', mockPlatformTenantsRepository);
}
