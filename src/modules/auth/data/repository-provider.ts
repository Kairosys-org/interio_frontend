import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockAuthRepository } from './adapters/mock.repository';
import type { AuthRepository } from './repository';

/**
 * The only place that picks an adapter (architecture §4.4). Auth has no API
 * adapter yet, so API mode fails loudly with `API_DATA_SOURCE_NOT_AVAILABLE`.
 */
export function getAuthRepository(): AuthRepository {
	return getConfiguredRepository('auth', mockAuthRepository);
}
