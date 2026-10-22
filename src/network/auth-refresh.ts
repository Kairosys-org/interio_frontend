import { getBaseUrl } from './api-config';
import { nextRequestId } from './errors';
import { getAccessToken, setAccessToken } from './token-storage';

export type AuthRefreshListener = (token: string | null) => void;

let inflight: Promise<string | null> | null = null;
const listeners = new Set<AuthRefreshListener>();

function isApiMode(): boolean {
	return import.meta.env.PUBLIC_DATA_SOURCE === 'api';
}

function readTokenFromPayload(payload: unknown): string | null {
	if (typeof payload !== 'object' || payload === null) return null;
	const record = payload as Record<string, unknown>;
	const nested = record.data;
	const candidate =
		typeof nested === 'object' && nested !== null ? (nested as Record<string, unknown>) : record;
	for (const key of ['access_token', 'accessToken', 'token']) {
		const value = candidate[key];
		if (typeof value === 'string' && value.length > 0) return value;
	}
	return null;
}

async function performRefresh(): Promise<string | null> {
	if (!isApiMode()) return getAccessToken();

	const response = await fetch(`${getBaseUrl()}/auth/refresh`, {
		method: 'POST',
		credentials: 'include',
		headers: { Accept: 'application/json', 'X-Request-ID': nextRequestId() }
	});
	if (!response.ok) {
		setAccessToken(null);
		return null;
	}

	const text = await response.text();
	let payload: unknown;
	try {
		payload = text.length > 0 ? (JSON.parse(text) as unknown) : null;
	} catch {
		payload = null;
	}

	const token = readTokenFromPayload(payload);
	setAccessToken(token);
	return token;
}

function emit(token: string | null): void {
	for (const listener of listeners) listener(token);
}

/** Single-flight: concurrent 401s share one refresh round-trip. */
export function refreshAccessToken(): Promise<string | null> {
	if (inflight) return inflight;

	inflight = performRefresh()
		.catch(() => null)
		.then((token) => {
			emit(token);
			return token;
		})
		.finally(() => {
			inflight = null;
		});

	return inflight;
}

export function onAuthRefreshed(listener: AuthRefreshListener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
