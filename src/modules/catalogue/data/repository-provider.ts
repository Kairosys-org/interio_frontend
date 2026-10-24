import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockCatalogueRepository } from './adapters/mock.repository';
import type { CatalogueRepository } from './repository';

/** The only place that picks mock vs API (architecture §4.4). */
export function getCatalogueRepository(): CatalogueRepository {
	return getConfiguredRepository('catalogue', mockCatalogueRepository);
}
