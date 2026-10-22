import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockPropertiesRepository } from './adapters/mock.repository';
import type { PropertiesRepository } from './repository';

export function getPropertiesRepository(): PropertiesRepository {
	return getConfiguredRepository('properties', mockPropertiesRepository);
}
