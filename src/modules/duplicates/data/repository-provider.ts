import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockDuplicatesRepository } from './adapters/mock.repository';
import type { DuplicatesRepository } from './repository';

export function getDuplicatesRepository(): DuplicatesRepository {
	return getConfiguredRepository('duplicates', mockDuplicatesRepository);
}
