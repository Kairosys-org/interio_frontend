import { describe, expect, it } from 'vitest';
import {
	ROUTE_PERMISSIONS,
	hasRoutePermissionEntry,
	permissionForRoute
} from '../routePermissions';
import { PERMISSIONS, PLATFORM_PERMISSIONS } from '../permissions';

describe('route permissions', () => {
	it('maps dashboard to any authenticated user', () => {
		expect(permissionForRoute('/dashboard')).toBeNull();
		expect(hasRoutePermissionEntry('/dashboard')).toBe(true);
	});

	it('matches exact routes first', () => {
		expect(permissionForRoute('/activity')).toBe(PERMISSIONS.AUDIT_VIEW);
		expect(permissionForRoute('/platform/tenants')).toBe(
			PLATFORM_PERMISSIONS.PLATFORM_TENANT_VIEW
		);
	});

	it('uses the longest matching prefix', () => {
		expect(permissionForRoute('/platform/tenants/abc')).toBe(
			PLATFORM_PERMISSIONS.PLATFORM_TENANT_VIEW
		);
		expect(permissionForRoute('/platform/audit/2026')).toBe(
			PLATFORM_PERMISSIONS.PLATFORM_AUDIT_VIEW
		);
	});

	it('ignores a trailing slash', () => {
		expect(permissionForRoute('/activity/')).toBe(PERMISSIONS.AUDIT_VIEW);
	});

	it('does not match a route by partial segment', () => {
		expect(hasRoutePermissionEntry('/activity-feed')).toBe(false);
	});

	it('returns null for an unmapped authenticated page', () => {
		expect(permissionForRoute('/account/profile')).toBeNull();
	});

	it('keeps every mapped value in the known vocabulary', () => {
		const known = new Set<string>([...Object.values(PERMISSIONS), ...Object.values(PLATFORM_PERMISSIONS)]);
		for (const requirement of Object.values(ROUTE_PERMISSIONS)) {
			if (requirement !== null) expect(known.has(requirement)).toBe(true);
		}
	});
});
