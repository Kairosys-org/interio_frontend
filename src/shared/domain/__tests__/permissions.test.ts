import { describe, expect, it } from 'vitest';
import {
	ALL_KNOWN_PERMISSIONS,
	ALL_PERMISSIONS,
	ALL_PLATFORM_PERMISSIONS,
	PERMISSIONS,
	PLATFORM_PERMISSIONS,
	ROLE_PERMISSIONS,
	hasAnyPermission,
	hasPermission,
	permissionsForRole,
	permissionsForRoles
} from '../permissions';
import { ALL_TENANT_ROLES, ROLES, isTenantRole } from '../roles';

describe('permission vocabulary', () => {
	it('uses the <object>.<action> shape for every code', () => {
		for (const permission of ALL_KNOWN_PERMISSIONS) {
			expect(permission).toMatch(/^[a-z_]+(?:\.[a-z_]+)+$/);
		}
	});

	it('has no duplicate codes', () => {
		expect(new Set(ALL_KNOWN_PERMISSIONS).size).toBe(ALL_KNOWN_PERMISSIONS.length);
	});

	it('keeps platform scopes in their own namespace', () => {
		for (const permission of ALL_PLATFORM_PERMISSIONS) {
			expect(permission.startsWith('platform.')).toBe(true);
		}
		for (const permission of ALL_PERMISSIONS) {
			expect(permission.startsWith('platform.')).toBe(false);
		}
	});

	it('never grants a platform scope to a tenant role', () => {
		for (const role of ALL_TENANT_ROLES) {
			for (const permission of ROLE_PERMISSIONS[role]) {
				expect(ALL_PLATFORM_PERMISSIONS).not.toContain(permission);
			}
		}
	});

	it('covers all ten canonical roles', () => {
		expect(ALL_TENANT_ROLES).toHaveLength(10);
		for (const role of ALL_TENANT_ROLES) {
			expect(isTenantRole(role)).toBe(true);
			expect(permissionsForRole(role).length).toBeGreaterThan(0);
		}
	});

	it('gives the System Admin every object-view permission but no mutation matrix slip', () => {
		const admin = permissionsForRole(ROLES.SYSTEM_ADMIN);
		expect(admin).toContain(PERMISSIONS.USER_CREATE);
		expect(admin).toContain(PERMISSIONS.PERMISSION_CHANGE);
		expect(admin).toContain(PERMISSIONS.AUDIT_EXPORT);
		expect(admin).not.toContain(PERMISSIONS.CUSTOMER_ARCHIVE);
		expect(admin).not.toContain(PLATFORM_PERMISSIONS.PLATFORM_TENANT_VIEW);
	});

	it('unions roles without duplicates', () => {
		const union = permissionsForRoles([ROLES.SURVEYOR, ROLES.SURVEYOR, ROLES.SALES]);
		expect(new Set(union).size).toBe(union.length);
		expect(union).toContain(PERMISSIONS.SURVEY_APPROVE);
		expect(union).toContain(PERMISSIONS.QUOTE_CREATE);
	});
});

describe('permission checks', () => {
	it('checks a flat permission array', () => {
		expect(hasPermission(['customer.view'], 'customer.view')).toBe(true);
		expect(hasPermission(['customer.view'], 'customer.update')).toBe(false);
	});

	it('treats an empty requirement as allowed', () => {
		expect(hasAnyPermission([], ['customer.view'], ROLES.SALES)).toBe(true);
	});

	it('accepts any of several required codes', () => {
		expect(hasAnyPermission(['quote.approve', 'quote.export'], ['quote.view'], ROLES.SALES)).toBe(
			true
		);
		expect(hasAnyPermission(['permission.change'], ['quote.view'], ROLES.SALES)).toBe(false);
	});

	it('falls back to the role matrix when permissions are absent', () => {
		expect(hasAnyPermission(['customer.create'], [], ROLES.SALES)).toBe(true);
		expect(hasAnyPermission(['customer.archive'], [], ROLES.SALES)).toBe(false);
	});

	it('does not fall back without a role', () => {
		expect(hasAnyPermission(['customer.create'], [], null)).toBe(false);
	});
});
