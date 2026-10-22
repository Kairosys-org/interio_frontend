import { describe, expect, it } from 'vitest';
import { isUuid } from '$shared/domain/uuid';
import { ROLE_PERMISSIONS } from '$shared/domain/permissions';
import {
	DEMO_INVITATION,
	DEMO_PASSWORD,
	DEMO_PLATFORM_AUDIT,
	DEMO_TENANTS,
	DEMO_USERS,
	MFA_CODE
} from '../demo-seed';

describe('demo seed', () => {
	it('uses valid UUIDs for every id and foreign key', () => {
		const ids = [
			...DEMO_TENANTS.map((tenant) => tenant.id),
			...DEMO_USERS.map((user) => user.id),
			...DEMO_USERS.flatMap((user) => (user.tenantId ? [user.tenantId] : [])),
			DEMO_INVITATION.id,
			DEMO_INVITATION.tenantId,
			...DEMO_PLATFORM_AUDIT.map((row) => row.id)
		];

		for (const id of ids) expect(isUuid(id)).toBe(true);
	});

	it('has no duplicate record ids', () => {
		const ids = [
			...DEMO_TENANTS.map((tenant) => tenant.id),
			...DEMO_USERS.map((user) => user.id),
			...DEMO_PLATFORM_AUDIT.map((row) => row.id)
		];
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('seeds one user per tenant role in Opulent', () => {
		const opulent = DEMO_TENANTS.find((tenant) => tenant.slug === 'opulent');
		const opulentUsers = DEMO_USERS.filter((user) => user.tenantId === opulent?.id);
		const roles = new Set(opulentUsers.flatMap((user) => user.roles));

		for (const role of Object.keys(ROLE_PERMISSIONS)) {
			expect(roles.has(role as keyof typeof ROLE_PERMISSIONS)).toBe(true);
		}
	});

	it('gives every tenant user permissions derived from their roles', () => {
		for (const user of DEMO_USERS) {
			if (user.platform) continue;
			expect(user.roles.length).toBeGreaterThan(0);
			expect(user.permissions.length).toBeGreaterThan(0);
			const expected = new Set(user.roles.flatMap((role) => ROLE_PERMISSIONS[role]));
			for (const permission of user.permissions)
				expect(expected.has(permission as never)).toBe(true);
		}
	});

	it('keeps platform staff out of every tenant', () => {
		const staff = DEMO_USERS.filter((user) => user.platform);
		expect(staff).toHaveLength(1);
		expect(staff[0].tenantId).toBeNull();
		expect(staff[0].roles).toHaveLength(0);
		expect(staff[0].permissions.every((permission) => permission.startsWith('platform.'))).toBe(
			true
		);
	});

	it('keeps the ambiguous email in two workspaces', () => {
		const matches = DEMO_USERS.filter((user) => user.email === 'ambiguous@example.com');
		expect(matches).toHaveLength(2);
		expect(new Set(matches.map((user) => user.tenantId)).size).toBe(2);
	});

	it('uses one documented demo password and MFA code', () => {
		expect(DEMO_PASSWORD).toBe('Interio!2026');
		expect(MFA_CODE).toBe('123456');
		for (const user of DEMO_USERS) expect(user.password).toBe(DEMO_PASSWORD);
	});

	it('links every audit row to a seeded tenant', () => {
		const tenantIds = new Set(DEMO_TENANTS.map((tenant) => tenant.id));
		for (const row of DEMO_PLATFORM_AUDIT) {
			expect(row.scope).toBe('platform');
			expect(row.tenantId).not.toBeNull();
			expect(tenantIds.has(row.tenantId as string)).toBe(true);
		}
	});
});
