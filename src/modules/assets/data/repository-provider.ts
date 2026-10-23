import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockAssetsRepository } from './adapters/mock.repository';
import type { AssetsRepository } from './repository';

export function getAssetsRepository(): AssetsRepository {
	return getConfiguredRepository('assets', mockAssetsRepository);
}
