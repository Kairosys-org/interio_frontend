import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockMaterialsRepository } from './adapters/mock.repository';
import type { MaterialsRepository } from './repository';

/** The only place that picks mock vs API (architecture §4.4). */
export function getMaterialsRepository(): MaterialsRepository {
	return getConfiguredRepository('materials', mockMaterialsRepository);
}
