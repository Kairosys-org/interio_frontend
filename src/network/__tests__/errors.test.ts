import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockRequest } from '../client';
import { ApiError, ApiErrorCode, isApiError, nextRequestId } from '../errors';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('ApiError', () => {
	it('defaults to status 400 and keeps a readable message', () => {
		const error = new ApiError({ code: ApiErrorCode.VALIDATION, message: 'Name is required.' });

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('ApiError');
		expect(error.message).toBe('Name is required.');
		expect(error.status).toBe(400);
		expect(error.code).toBe('validation');
	});

	it('exposes status helpers and a JSON shape', () => {
		const notFound = new ApiError({
			code: ApiErrorCode.NOT_FOUND,
			message: 'Tenant not found.',
			status: 404
		});
		const expired = new ApiError({
			code: ApiErrorCode.TOKEN_EXPIRED,
			message: 'Session expired.',
			status: 401
		});
		const forbidden = new ApiError({
			code: ApiErrorCode.FORBIDDEN,
			message: 'Not allowed.',
			status: 403
		});

		expect(notFound.isNotFound()).toBe(true);
		expect(expired.isUnauthorized()).toBe(true);
		expect(forbidden.isForbidden()).toBe(true);
		expect(notFound.isUnauthorized()).toBe(false);
		expect(notFound.toJSON()).toEqual({
			code: 'not_found',
			message: 'Tenant not found.',
			status: 404
		});
	});

	it('is detected by the type guard and gets unique request ids', () => {
		const first = nextRequestId();
		const second = nextRequestId();

		expect(isApiError(new ApiError({ code: ApiErrorCode.CONFLICT, message: 'Conflict.' }))).toBe(
			true
		);
		expect(isApiError(new Error('plain'))).toBe(false);
		expect(first.length).toBeGreaterThan(0);
		expect(second.length).toBeGreaterThan(0);
		expect(first).not.toBe(second);
	});
});

describe('mockRequest', () => {
	it('resolves the operation result with latency disabled', async () => {
		const value = await mockRequest(() => ({ ok: true }), { latencyMs: 0 });

		expect(value).toEqual({ ok: true });
	});

	it('normalizes a thrown non-ApiError into network_error / 500', async () => {
		const failure = new Error('Storage exploded.');

		await expect(
			mockRequest(
				() => {
					throw failure;
				},
				{ latencyMs: 0 }
			)
		).rejects.toMatchObject({
			name: 'ApiError',
			code: ApiErrorCode.NETWORK_ERROR,
			status: 500,
			message: 'Storage exploded.'
		});

		try {
			await mockRequest(
				() => {
					throw failure;
				},
				{ latencyMs: 0 }
			);
			expect.unreachable('mockRequest should have rejected');
		} catch (error) {
			expect(isApiError(error)).toBe(true);
			if (!isApiError(error)) return;
			expect(error.requestId).toBeTypeOf('string');
			expect(error.requestId?.length).toBeGreaterThan(0);
		}
	});

	it('passes an existing ApiError through unchanged', async () => {
		const original = new ApiError({
			code: ApiErrorCode.NOT_FOUND,
			message: 'Item not found.',
			status: 404
		});

		await expect(
			mockRequest(
				() => {
					throw original;
				},
				{ latencyMs: 0 }
			)
		).rejects.toBe(original);
	});

	it('reads the default latency from PUBLIC_MOCK_LATENCY_MS', async () => {
		vi.stubEnv('PUBLIC_MOCK_LATENCY_MS', '0');

		const value = await mockRequest(() => 42);

		expect(value).toBe(42);
	});
});
