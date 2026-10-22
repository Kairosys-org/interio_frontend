import { readPublicEnv } from '$shared/application/env';
import { normalizeApiError } from './client';
import type { MockRequestOptions } from './client';
import { mockRequest } from './client';

/**
 * Facade boundary used by every feature `data/api.ts`. Mock mode simulates the
 * backend; API mode normalizes transport failures identically. This module
 * never imports repository-mode so it stays free of provider cycles.
 */

/**
 * Register every module seeder before the first mock call (architecture §7).
 * Dynamic on purpose: API builds never load the mock backend, and the import
 * is cached after the first call.
 */
let mockSeeds: Promise<unknown> | null = null;

function ensureMockSeeds(): Promise<unknown> {
	mockSeeds ??= import('./mock-bootstrap');
	return mockSeeds;
}

export async function apiCall<T>(
	operation: () => T | Promise<T>,
	options?: MockRequestOptions
): Promise<T> {
	if (readPublicEnv('PUBLIC_DATA_SOURCE') !== 'api') {
		await ensureMockSeeds();
		return mockRequest(operation, options);
	}

	try {
		return await operation();
	} catch (error) {
		throw normalizeApiError(error);
	}
}
