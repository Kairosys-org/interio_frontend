import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockImportsRepository } from './adapters/mock.repository';
import type { ImportsRepository } from './repository';

export function getImportsRepository(): ImportsRepository {
	return getConfiguredRepository('imports', mockImportsRepository);
}
