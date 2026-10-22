import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockProjectsRepository } from './adapters/mock.repository';
import type { ProjectsRepository } from './repository';

export function getProjectsRepository(): ProjectsRepository {
	return getConfiguredRepository('projects', mockProjectsRepository);
}
