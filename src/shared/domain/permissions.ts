import { ROLES, type TenantRole } from './roles';

/**
 * Fixed permission vocabulary (spec Part 6 §3, Part 10 §25). Codes are
 * `<object>.<action>`; only the server is authoritative, the UI hides actions.
 */
export const PERMISSIONS = {
	CUSTOMER_VIEW: 'customer.view',
	CUSTOMER_CREATE: 'customer.create',
	CUSTOMER_UPDATE: 'customer.update',
	CUSTOMER_ARCHIVE: 'customer.archive',
	CUSTOMER_EXPORT: 'customer.export',

	PROPERTY_VIEW: 'property.view',
	PROPERTY_CREATE: 'property.create',
	PROPERTY_UPDATE: 'property.update',
	PROPERTY_ARCHIVE: 'property.archive',
	PROPERTY_EXPORT: 'property.export',

	PROJECT_VIEW: 'project.view',
	PROJECT_CREATE: 'project.create',
	PROJECT_UPDATE: 'project.update',
	PROJECT_ARCHIVE: 'project.archive',
	PROJECT_EXPORT: 'project.export',

	SURVEY_VIEW: 'survey.view',
	SURVEY_CREATE: 'survey.create',
	SURVEY_UPDATE: 'survey.update',
	SURVEY_APPROVE: 'survey.approve',
	SURVEY_ARCHIVE: 'survey.archive',

	DESIGN_VIEW: 'design.view',
	DESIGN_CREATE: 'design.create',
	DESIGN_UPDATE: 'design.update',
	DESIGN_APPROVE: 'design.approve',
	DESIGN_ARCHIVE: 'design.archive',

	CABINET_VIEW: 'cabinet.view',
	CABINET_CREATE: 'cabinet.create',
	CABINET_UPDATE: 'cabinet.update',

	MATERIALS_VIEW: 'materials.view',
	MATERIALS_CREATE: 'materials.create',
	MATERIALS_UPDATE: 'materials.update',
	MATERIALS_ARCHIVE: 'materials.archive',

	QUOTE_VIEW: 'quote.view',
	QUOTE_CREATE: 'quote.create',
	QUOTE_UPDATE: 'quote.update',
	QUOTE_APPROVE: 'quote.approve',
	QUOTE_ARCHIVE: 'quote.archive',
	QUOTE_EXPORT: 'quote.export',

	APPROVAL_VIEW: 'approval.view',
	APPROVAL_CREATE: 'approval.create',

	SALES_ORDER_VIEW: 'sales_order.view',
	SALES_ORDER_CREATE: 'sales_order.create',
	SALES_ORDER_ARCHIVE: 'sales_order.archive',

	JOB_VIEW: 'job.view',
	JOB_CREATE: 'job.create',
	JOB_UPDATE: 'job.update',
	JOB_ARCHIVE: 'job.archive',
	JOB_EXPORT: 'job.export',

	UNIT_VIEW: 'unit.view',
	UNIT_UPDATE: 'unit.update',
	UNIT_APPROVE: 'unit.approve',
	UNIT_RELEASE: 'unit.release',
	UNIT_ARCHIVE: 'unit.archive',
	UNIT_EXPORT: 'unit.export',

	PART_VIEW: 'part.view',
	PART_UPDATE: 'part.update',
	PART_APPROVE: 'part.approve',
	PART_RELEASE: 'part.release',
	PART_ARCHIVE: 'part.archive',
	PART_EXPORT: 'part.export',

	REMAKE_VIEW: 'remake.view',
	REMAKE_CREATE: 'remake.create',
	REMAKE_APPROVE: 'remake.approve',

	EXPORT_VIEW: 'export.view',
	EXPORT_CREATE: 'export.create',
	EXPORT_RELEASE: 'export.release',
	EXPORT_EXPORT: 'export.export',

	LABEL_VIEW: 'label.view',
	LABEL_CREATE: 'label.create',

	INSTALLATION_VIEW: 'installation.view',
	INSTALLATION_CREATE: 'installation.create',
	INSTALLATION_UPDATE: 'installation.update',
	INSTALLATION_APPROVE: 'installation.approve',
	INSTALLATION_ARCHIVE: 'installation.archive',

	SNAG_VIEW: 'snag.view',
	SNAG_CREATE: 'snag.create',
	SNAG_UPDATE: 'snag.update',
	SNAG_APPROVE: 'snag.approve',
	SNAG_ARCHIVE: 'snag.archive',

	AFTERCARE_VIEW: 'aftercare.view',
	AFTERCARE_CREATE: 'aftercare.create',
	AFTERCARE_UPDATE: 'aftercare.update',
	AFTERCARE_APPROVE: 'aftercare.approve',
	AFTERCARE_ARCHIVE: 'aftercare.archive',

	PAYMENT_VIEW: 'payment.view',
	PAYMENT_CREATE: 'payment.create',
	PAYMENT_UPDATE: 'payment.update',
	PAYMENT_EXPORT: 'payment.export',

	JOB_COST_VIEW: 'job_cost.view',
	JOB_COST_CREATE: 'job_cost.create',
	JOB_COST_UPDATE: 'job_cost.update',
	JOB_COST_EXPORT: 'job_cost.export',

	USER_VIEW: 'user.view',
	USER_CREATE: 'user.create',
	USER_UPDATE: 'user.update',

	ROLE_VIEW: 'role.view',
	ROLE_CREATE: 'role.create',
	ROLE_UPDATE: 'role.update',

	PERMISSION_CHANGE: 'permission.change',

	AUDIT_VIEW: 'audit.view',
	AUDIT_EXPORT: 'audit.export',

	SETTING_VIEW: 'setting.view',
	SETTING_CREATE: 'setting.create',
	SETTING_UPDATE: 'setting.update',

	IMPORT_VIEW: 'import.view',
	IMPORT_CREATE: 'import.create',

	RECORD_DELETE_REQUEST: 'record.delete_request',
	RECORD_DELETE_EXECUTE: 'record.delete_execute'
} as const;

/** Platform-namespace scopes — no tenant role ever holds these (Part 2 §2.5). */
export const PLATFORM_PERMISSIONS = {
	PLATFORM_TENANT_VIEW: 'platform.tenant.view',
	PLATFORM_TENANT_CREATE: 'platform.tenant.create',
	PLATFORM_TENANT_SUSPEND: 'platform.tenant.suspend',
	PLATFORM_TENANT_EXPORT: 'platform.tenant.export',
	PLATFORM_SUPPORT_GRANT: 'platform.support.grant',
	PLATFORM_AUDIT_VIEW: 'platform.audit.view',
	PLATFORM_LOG_VIEW: 'platform.log.view'
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.freeze(
	Object.values(PERMISSIONS) as Permission[]
);

export const ALL_PLATFORM_PERMISSIONS: readonly PlatformPermission[] = Object.freeze(
	Object.values(PLATFORM_PERMISSIONS) as PlatformPermission[]
);

export const ALL_KNOWN_PERMISSIONS: readonly string[] = Object.freeze([
	...ALL_PERMISSIONS,
	...ALL_PLATFORM_PERMISSIONS
]);

type Action = 'view' | 'create' | 'update' | 'approve' | 'release' | 'archive' | 'export' | 'change';
type Grants = Record<string, readonly Action[]>;

/**
 * Role → grants, transcribed from the canonical matrix in spec Part 6 §3.
 * Object-level scope (e.g. a surveyor sees only assigned projects) and state
 * transition bindings are enforced server-side in addition to this matrix.
 */
const ROLE_GRANTS: Record<TenantRole, Grants> = {
	[ROLES.SYSTEM_ADMIN]: {
		customer: ['view'],
		property: ['view'],
		project: ['view'],
		survey: ['view'],
		design: ['view'],
		cabinet: ['view', 'create', 'update'],
		materials: ['view', 'create', 'update'],
		quote: ['view'],
		approval: ['view'],
		sales_order: ['view'],
		job: ['view'],
		unit: ['view'],
		part: ['view'],
		remake: ['view'],
		export: ['view'],
		label: ['view'],
		installation: ['view'],
		snag: ['view'],
		aftercare: ['view'],
		payment: ['view'],
		job_cost: ['view'],
		user: ['view', 'create', 'update'],
		role: ['view', 'create', 'update'],
		permission: ['change'],
		audit: ['view', 'export'],
		setting: ['view', 'create', 'update'],
		import: ['view', 'create']
	},
	[ROLES.OWNER_MANAGEMENT]: {
		customer: ['view', 'create', 'update', 'archive', 'export'],
		property: ['view', 'create', 'update', 'archive', 'export'],
		project: ['view', 'create', 'update', 'archive', 'export'],
		survey: ['view', 'archive'],
		design: ['view', 'approve', 'archive'],
		cabinet: ['view', 'create', 'update', 'archive'],
		materials: ['view', 'create', 'update', 'archive'],
		quote: ['view', 'approve', 'archive', 'export'],
		approval: ['view'],
		sales_order: ['view', 'create', 'archive'],
		job: ['view', 'create', 'update', 'archive', 'export'],
		unit: ['view', 'approve', 'release', 'archive', 'export'],
		part: ['view', 'approve', 'release', 'archive', 'export'],
		remake: ['view', 'approve'],
		export: ['view', 'export'],
		label: ['view'],
		installation: ['view', 'approve', 'archive'],
		snag: ['view', 'approve', 'archive'],
		aftercare: ['view', 'approve', 'archive'],
		payment: ['view', 'export'],
		job_cost: ['view', 'export'],
		user: ['view'],
		role: ['view'],
		audit: ['view', 'export'],
		setting: ['view'],
		import: ['view', 'create']
	},
	[ROLES.SALES]: {
		customer: ['view', 'create', 'update'],
		property: ['view', 'create', 'update'],
		project: ['view', 'create', 'update', 'archive'],
		survey: ['view'],
		design: ['view'],
		cabinet: ['view'],
		materials: ['view', 'create', 'update'],
		quote: ['view', 'create', 'update', 'approve', 'export'],
		approval: ['view', 'create'],
		sales_order: ['view', 'create'],
		job: ['view', 'create'],
		unit: ['view'],
		part: ['view'],
		remake: ['view'],
		installation: ['view', 'create', 'update'],
		snag: ['view', 'create', 'update'],
		aftercare: ['view', 'create', 'update'],
		payment: ['view']
	},
	[ROLES.DESIGNER]: {
		customer: ['view'],
		property: ['view'],
		project: ['view', 'create'],
		survey: ['view'],
		design: ['view', 'create', 'update'],
		cabinet: ['view', 'create', 'update'],
		materials: ['view', 'create', 'update'],
		quote: ['view'],
		job: ['view'],
		unit: ['view'],
		part: ['view'],
		installation: ['view'],
		aftercare: ['view']
	},
	[ROLES.SURVEYOR]: {
		customer: ['view'],
		property: ['view'],
		project: ['view'],
		survey: ['view', 'create', 'update', 'approve']
	},
	[ROLES.PURCHASING]: {
		materials: ['view', 'create', 'update'],
		job: ['view'],
		unit: ['view'],
		part: ['view'],
		job_cost: ['view', 'create', 'update', 'export']
	},
	[ROLES.PRODUCTION_MANAGER]: {
		customer: ['view'],
		property: ['view'],
		project: ['view'],
		survey: ['view', 'approve'],
		design: ['view'],
		cabinet: ['view', 'create', 'update'],
		materials: ['view'],
		sales_order: ['view'],
		job: ['view', 'update'],
		unit: ['view', 'update', 'approve', 'release', 'archive', 'export'],
		part: ['view', 'update', 'approve', 'release', 'archive', 'export'],
		remake: ['view', 'create', 'approve'],
		export: ['view', 'create', 'release', 'export'],
		label: ['view'],
		installation: ['view'],
		snag: ['view'],
		aftercare: ['view'],
		job_cost: ['view', 'create', 'update'],
		setting: ['view']
	},
	[ROLES.WORKSHOP]: {
		project: ['view'],
		cabinet: ['view'],
		materials: ['view'],
		job: ['view'],
		unit: ['view', 'update'],
		part: ['view', 'update'],
		remake: ['view', 'create'],
		label: ['view', 'create'],
		aftercare: ['view']
	},
	[ROLES.INSTALLER]: {
		project: ['view'],
		materials: ['view'],
		job: ['view'],
		unit: ['view', 'update'],
		part: ['view', 'update'],
		remake: ['view', 'create'],
		label: ['view'],
		installation: ['view', 'create', 'update'],
		snag: ['view', 'create', 'update'],
		aftercare: ['view', 'create', 'update']
	},
	[ROLES.ACCOUNTS]: {
		customer: ['view'],
		property: ['view'],
		project: ['view'],
		quote: ['view', 'export'],
		approval: ['view'],
		sales_order: ['view'],
		job: ['view', 'export'],
		payment: ['view', 'create', 'update', 'export'],
		job_cost: ['view', 'export'],
		installation: ['view'],
		snag: ['view'],
		aftercare: ['view'],
		audit: ['view']
	}
};

function expandGrants(grants: Grants): Permission[] {
	const permissions: Permission[] = [];
	for (const [object, actions] of Object.entries(grants)) {
		for (const action of actions) {
			permissions.push(`${object}.${action}` as Permission);
		}
	}
	return permissions;
}

export const ROLE_PERMISSIONS: Record<TenantRole, readonly Permission[]> = Object.freeze(
	Object.fromEntries(
		(Object.keys(ROLE_GRANTS) as TenantRole[]).map((role) => [
			role,
			Object.freeze(expandGrants(ROLE_GRANTS[role]))
		])
	) as Record<TenantRole, readonly Permission[]>
);

export function permissionsForRole(role: TenantRole): readonly Permission[] {
	return ROLE_PERMISSIONS[role] ?? [];
}

/** Union of every role the user holds. */
export function permissionsForRoles(roles: readonly TenantRole[]): Permission[] {
	const granted = new Set<Permission>();
	for (const role of roles) for (const permission of permissionsForRole(role)) granted.add(permission);
	return [...granted];
}

export function hasPermission(
	userPermissions: readonly string[],
	permission: string
): boolean {
	return userPermissions.includes(permission);
}

/**
 * UX-only check used by navigation and PermissionGate. The server is
 * authoritative; `role` is a mock-mode fallback when permissions are absent.
 */
export function hasAnyPermission(
	permissions: readonly string[],
	userPermissions: readonly string[],
	role?: TenantRole | null
): boolean {
	if (permissions.length === 0) return true;
	return permissions.some(
		(permission) =>
			userPermissions.includes(permission) ||
			(role ? permissionsForRole(role).includes(permission as Permission) : false)
	);
}
