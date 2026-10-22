/** The ten canonical tenant roles (spec Part 6 §1, R6 vocabulary). */
export const ROLES = {
	SYSTEM_ADMIN: 'system_admin',
	OWNER_MANAGEMENT: 'owner_management',
	SALES: 'sales',
	DESIGNER: 'designer',
	SURVEYOR: 'surveyor',
	PURCHASING: 'purchasing',
	PRODUCTION_MANAGER: 'production_manager',
	WORKSHOP: 'workshop',
	INSTALLER: 'installer',
	ACCOUNTS: 'accounts'
} as const;

export type TenantRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<TenantRole, string> = {
	system_admin: 'System Admin',
	owner_management: 'Owner/Management',
	sales: 'Sales',
	designer: 'Designer',
	surveyor: 'Surveyor',
	purchasing: 'Purchasing',
	production_manager: 'Production Manager',
	workshop: 'Workshop',
	installer: 'Installer',
	accounts: 'Accounts'
};

/** Platform staff hold a platform claim instead of a tenant role (Part 2 §2.5). */
export const PLATFORM_STAFF = 'platform_staff' as const;
export type PlatformClaim = typeof PLATFORM_STAFF;

export const ALL_TENANT_ROLES = Object.values(ROLES) as TenantRole[];

export function isTenantRole(value: string): value is TenantRole {
	return (ALL_TENANT_ROLES as string[]).includes(value);
}
