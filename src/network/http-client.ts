import { getBaseUrl } from './api-config';
import { refreshAccessToken } from './auth-refresh';
import { ApiError, ApiErrorCode, nextRequestId } from './errors';
import { getAccessToken } from './token-storage';

const DEFAULT_TIMEOUT_MS = 20_000;

export interface HttpClientRequestOptions {
	method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
	path: string;
	body?: unknown;
	headers?: Record<string, string>;
	signal?: AbortSignal;
	timeoutMs?: number;
	auth?: boolean;
	retryOnUnauthorized?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function buildUrl(path: string): string {
	const base = getBaseUrl().replace(/\/+$/, '');
	const suffix = path.startsWith('/') ? path : `/${path}`;
	return `${base}${suffix}`;
}

function parseJson(text: string): unknown {
	if (text.length === 0) return undefined;
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

/** Accepts both `{ data: ... }` envelopes and raw JSON payloads. */
function unwrapData(payload: unknown): unknown {
	if (isRecord(payload) && !Array.isArray(payload) && 'data' in payload) return payload.data;
	return payload;
}

function fallbackCodeForStatus(status: number): string {
	switch (status) {
		case 400:
		case 422:
			return ApiErrorCode.VALIDATION;
		case 401:
			return ApiErrorCode.UNAUTHORIZED;
		case 403:
			return ApiErrorCode.FORBIDDEN;
		case 404:
			return ApiErrorCode.NOT_FOUND;
		case 409:
			return ApiErrorCode.CONFLICT;
		default:
			return ApiErrorCode.NETWORK_ERROR;
	}
}

function fallbackMessageForStatus(status: number): string {
	switch (status) {
		case 401:
			return 'Your session has expired. Please sign in again.';
		case 403:
			return 'You do not have permission to perform this action.';
		case 404:
			return 'The requested resource was not found.';
		default:
			return 'The request could not be completed. Please try again.';
	}
}

async function send(
	options: HttpClientRequestOptions,
	requestId: string,
	signal: AbortSignal
): Promise<Response> {
	const headers = new Headers({ Accept: 'application/json' });
	if (options.body !== undefined) headers.set('Content-Type', 'application/json');
	for (const [name, value] of Object.entries(options.headers ?? {})) headers.set(name, value);
	if (!headers.has('X-Request-ID')) headers.set('X-Request-ID', requestId);
	if (options.auth !== false) {
		const token = getAccessToken();
		if (token) headers.set('Authorization', `Bearer ${token}`);
	}

	const init: RequestInit = {
		method: options.method,
		headers,
		signal,
		credentials: 'include'
	};
	if (options.body !== undefined) init.body = JSON.stringify(options.body);

	return fetch(buildUrl(options.path), init);
}

async function readResponse<T>(response: Response, requestId: string): Promise<T> {
	if (response.status === 204 || response.status === 205) return undefined as T;

	const text = await response.text();
	const payload = parseJson(text);

	if (!response.ok) {
		const errorBody = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
		const code =
			typeof errorBody?.code === 'string' && errorBody.code.length > 0
				? errorBody.code
				: fallbackCodeForStatus(response.status);
		const message =
			typeof errorBody?.message === 'string' && errorBody.message.length > 0
				? errorBody.message
				: fallbackMessageForStatus(response.status);

		throw new ApiError({
			code,
			status: response.status,
			message,
			requestId,
			details: errorBody?.details ?? payload
		});
	}

	return unwrapData(payload) as T;
}

export const httpClient = {
	async request<T>(options: HttpClientRequestOptions): Promise<T> {
		const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		const requestId = nextRequestId();
		const controller = new AbortController();
		let timedOut = false;

		const handleExternalAbort = () => controller.abort();
		if (options.signal) {
			if (options.signal.aborted) controller.abort();
			else options.signal.addEventListener('abort', handleExternalAbort, { once: true });
		}

		const timer =
			timeoutMs > 0
				? setTimeout(() => {
						timedOut = true;
						controller.abort();
					}, timeoutMs)
				: null;

		try {
			let response = await send(options, requestId, controller.signal);

			const canRefresh = options.auth !== false && options.retryOnUnauthorized !== false;
			if (response.status === 401 && canRefresh) {
				const refreshed = await refreshAccessToken();
				if (refreshed) response = await send(options, requestId, controller.signal);
			}

			return await readResponse<T>(response, requestId);
		} catch (error) {
			if (timedOut) {
				throw new ApiError({
					code: ApiErrorCode.NETWORK_ERROR,
					status: 408,
					message: 'The request timed out. Please try again.',
					requestId
				});
			}
			if (error instanceof ApiError) throw error;
			if (error instanceof Error && error.name === 'AbortError') {
				throw new ApiError({
					code: ApiErrorCode.NETWORK_ERROR,
					status: 499,
					message: 'The request was cancelled.',
					requestId
				});
			}
			throw new ApiError({
				code: ApiErrorCode.NETWORK_ERROR,
				status: 500,
				message: 'Unable to reach the server. Check your connection and try again.',
				requestId,
				details: error instanceof Error ? { name: error.name, message: error.message } : undefined
			});
		} finally {
			if (timer !== null) clearTimeout(timer);
			options.signal?.removeEventListener('abort', handleExternalAbort);
		}
	}
};
