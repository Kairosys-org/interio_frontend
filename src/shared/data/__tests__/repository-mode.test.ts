import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiErrorCode, isApiError } from '$network/errors';
import {
	getConfiguredRepository,
	getRepositoryMode,
	isMockMode,
	resolveRepository
} from '../repository-mode';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('repository mode', () => {
	it('defaults to mock when PUBLIC_DATA_SOURCE is missing', () => {
		expect(getRepositoryMode()).toBe('mock');
		expect(isMockMode()).toBe(true);
	});

	it('treats unknown values as mock', () => {
		vi.stubEnv('PUBLIC_DATA_SOURCE', 'something-else');

		expect(getRepositoryMode()).toBe('mock');
	});

	it('selects the API adapter when PUBLIC_DATA_SOURCE is api', () => {
		vi.stubEnv('PUBLIC_DATA_SOURCE', 'api');

		const mockRepository = { source: 'mock' };
		const apiRepository = { source: 'api' };

		expect(getRepositoryMode()).toBe('api');
		expect(isMockMode()).toBe(false);
		expect(resolveRepository(mockRepository, apiRepository)).toBe(apiRepository);
	});

	it('returns the mock repository in mock mode', () => {
		const mockRepository = { source: 'mock' } as const;

		expect(getConfiguredRepository('auth', mockRepository)).toBe(mockRepository);
	});

	it('throws a stable 501 error for modules without an API adapter', () => {
		vi.stubEnv('PUBLIC_DATA_SOURCE', 'api');

		const mockRepository = { source: 'mock' } as const;

		expect(() => getConfiguredRepository('auth', mockRepository)).toThrow(
			/The API data source for "auth" is not available yet/
		);

		try {
			getConfiguredRepository('auth', mockRepository);
			expect.unreachable('expected the provider to throw');
		} catch (error) {
			expect(isApiError(error)).toBe(true);
			if (!isApiError(error)) return;
			expect(error.code).toBe(ApiErrorCode.API_DATA_SOURCE_NOT_AVAILABLE);
			expect(error.status).toBe(501);
			expect(error.message).toContain('"auth"');
		}
	});
});
