import { PERMISSIONS, PLATFORM_PERMISSIONS } from '$shared/domain/permissions';

/**
 * Permission required by each authenticated route. `null` means any
 * authenticated user. Matching is exact first, then longest path prefix
 * (standards/architecture.md §5, §8).
 */
export const ROUTE_PERMISSIONS: Readonly<Record<string, string | null>> = Object.freeze({
	'/dashboard': null,
	'/activity': PERMISSIONS.AUDIT_VIEW,
	'/platform': PLATFORM_PERMISSIONS.PLATFORM_TENANT_VIEW,
	'/platform/tenants': PLATFORM_PERMISSIONS.PLATFORM_TENANT_VIEW,
	'/platform/audit': PLATFORM_PERMISSIONS.PLATFORM_AUDIT_VIEW
});

function normalise(pathname: string): string {
	if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
	return pathname;
}

/** Exact match, then the longest route prefix. */
export function permissionForRoute(pathname: string): string | null {
	const path = normalise(pathname);
	if (path in ROUTE_PERMISSIONS) return ROUTE_PERMISSIONS[path];

	let best: string | null = null;
	for (const route of Object.keys(ROUTE_PERMISSIONS)) {
		if (route === '/') continue;
		if (path === route || path.startsWith(`${route}/`)) {
			if (best === null || route.length > best.length) best = route;
		}
	}
	return best === null ? null : ROUTE_PERMISSIONS[best];
}

/** True when a route is governed by the permission map (used by tests/guards). */
export function hasRoutePermissionEntry(pathname: string): boolean {
	const path = normalise(pathname);
	if (path in ROUTE_PERMISSIONS) return true;
	return Object.keys(ROUTE_PERMISSIONS).some(
		(route) => route !== '/' && path.startsWith(`${route}/`)
	);
}
