import { createDataSourceUnavailableError } from './repository-errors';

export type RepositoryMode = 'mock' | 'api';

export function getRepositoryMode(): RepositoryMode {
	return import.meta.env.PUBLIC_DATA_SOURCE === 'api' ? 'api' : 'mock';
}

export function isMockMode(): boolean {
	return getRepositoryMode() === 'mock';
}

export function resolveRepository<T>(mockRepository: T, apiRepository: T): T {
	return isMockMode() ? mockRepository : apiRepository;
}

/**
 * For modules whose API adapter does not exist yet. API mode fails loudly
 * instead of silently falling back to mock data.
 */
export function getConfiguredRepository<T>(moduleName: string, mockRepository: T): T {
	if (isMockMode()) return mockRepository;
	throw createDataSourceUnavailableError(moduleName);
}
