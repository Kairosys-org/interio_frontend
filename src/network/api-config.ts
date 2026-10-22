const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/v1';

export function getBaseUrl(): string {
	const configured = import.meta.env.PUBLIC_API_BASE_URL;
	const base = typeof configured === 'string' ? configured.trim() : '';
	const value = base.length > 0 ? base : DEFAULT_API_BASE_URL;
	return value.replace(/\/+$/, '');
}
