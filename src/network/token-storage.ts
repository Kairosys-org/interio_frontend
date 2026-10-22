const MOCK_ACCESS_TOKEN_KEY = 'interio_mock_access_token';
const MOCK_REFRESH_TOKEN_KEY = 'interio_mock_refresh_token';

/**
 * API mode keeps the access token in module memory only. The refresh token is
 * an HttpOnly cookie owned by the backend and is never readable from JS.
 */
let memoryAccessToken: string | null = null;

function isApiMode(): boolean {
	return import.meta.env.PUBLIC_DATA_SOURCE === 'api';
}

function browserStorage(): Storage | null {
	return typeof localStorage === 'undefined' ? null : localStorage;
}

export function getAccessToken(): string | null {
	if (isApiMode()) return memoryAccessToken;
	const storage = browserStorage();
	return storage ? storage.getItem(MOCK_ACCESS_TOKEN_KEY) : null;
}

export function setAccessToken(token: string | null): void {
	if (isApiMode()) {
		memoryAccessToken = token;
		return;
	}
	const storage = browserStorage();
	if (!storage) return;
	if (token === null) storage.removeItem(MOCK_ACCESS_TOKEN_KEY);
	else storage.setItem(MOCK_ACCESS_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
	if (isApiMode()) return null;
	const storage = browserStorage();
	return storage ? storage.getItem(MOCK_REFRESH_TOKEN_KEY) : null;
}

export function setRefreshToken(token: string | null): void {
	if (isApiMode()) return;
	const storage = browserStorage();
	if (!storage) return;
	if (token === null) storage.removeItem(MOCK_REFRESH_TOKEN_KEY);
	else storage.setItem(MOCK_REFRESH_TOKEN_KEY, token);
}

export function clearTokens(): void {
	memoryAccessToken = null;
	const storage = browserStorage();
	if (!storage) return;
	storage.removeItem(MOCK_ACCESS_TOKEN_KEY);
	storage.removeItem(MOCK_REFRESH_TOKEN_KEY);
}

export function hasSessionToken(): boolean {
	const token = getAccessToken();
	return typeof token === 'string' && token.length > 0;
}
