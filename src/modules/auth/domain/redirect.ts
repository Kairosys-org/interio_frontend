/**
 * `?redirect=` is attacker-controllable, so only same-origin absolute paths
 * survive. Protocol-relative (`//host`), backslash tricks and auth routes
 * (which would bounce a freshly signed-in user straight back to the form)
 * are rejected.
 */
export function safeRedirect(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const candidate = value.trim();
	if (candidate.length === 0) return null;
	if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
	if (candidate.includes('\\')) return null;
	if (/[\u0000-\u001f\u007f]/.test(candidate)) return null;
	if (
		candidate === '/login' ||
		candidate.startsWith('/login?') ||
		candidate.startsWith('/login/')
	) {
		return null;
	}
	if (candidate === '/invite' || candidate.startsWith('/invite/')) return null;
	if (candidate === '/t' || candidate.startsWith('/t/')) return null;
	return candidate;
}
