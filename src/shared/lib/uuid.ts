import type { Uuid } from '$shared/domain/uuid';

/**
 * Runtime-created ids only. Seeds must use `deterministicUuid()` instead so
 * demo data is identical on every run.
 */
export function newUuid(): Uuid {
	if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
		throw new Error('crypto.randomUUID is unavailable in this environment.');
	}
	return crypto.randomUUID();
}
