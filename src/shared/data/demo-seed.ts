import { ALL_PLATFORM_PERMISSIONS, permissionsForRoles } from '$shared/domain/permissions';
import { ROLES, type TenantRole } from '$shared/domain/roles';
import { demoDays } from '$shared/data/demo-clock';
import type {
	AppUserRecord,
	AuditEventRecord,
	TenantRecord,
	UserInvitationRecord
} from '$shared/data/records';
import { deterministicUuid } from '$shared/lib/deterministic';

/**
 * Canonical Phase 0 demo seed (orchestrator-owned).
 *
 * Auth owns the `tenants`, `app_users` and `user_invitations` collections;
 * the platform module owns `platform_audit_events`. Both read the same
 * constants from here so ids, names and credentials never drift apart.
 *
 * Deterministic by construction: fixed UUIDv5 ids, fixed demo clock, no
 * `Math.random()` and no `Date.now()`. Never import this from presentation.
 */

export const DEMO_PASSWORD = 'Interio!2026';
export const MFA_CODE = '123456';

const CREATED_AT = demoDays(400);

function tenantId(slug: string): string {
	return deterministicUuid(`tenant:${slug}`);
}

function userId(tenantSlug: string, roleKey: string): string {
	return deterministicUuid(`user:${tenantSlug}:${roleKey}`);
}

function tenant(
	slug: string,
	legalName: string,
	displayName: string,
	emailDomain: string,
	accent: string,
	status: TenantRecord['status'] = 'active'
): TenantRecord {
	return {
		id: tenantId(slug),
		slug,
		legalName,
		displayName,
		status,
		branding: { accent, displayName },
		defaultCurrency: 'GBP',
		vatNumber: null,
		referencePattern: '{TENANT}-{YYYY}-{NNNN}',
		emailDomain,
		createdAt: CREATED_AT,
		updatedAt: demoDays(2)
	};
}

/** Opulent is the fully staffed demo tenant; Harbour creates the ambiguous case. */
export const DEMO_TENANTS: readonly TenantRecord[] = Object.freeze([
	tenant(
		'opulent',
		'Opulent Interiors Group Ltd',
		'Opulent Interiors',
		'opulentinteriors.co.uk',
		'#8A5A2B'
	),
	tenant(
		'harbour',
		'Harbour & Finch Interiors Ltd',
		'Harbour & Finch',
		'harbourfinch.co.uk',
		'#2F5D62'
	),
	tenant(
		'northgate',
		'Northgate Joinery Ltd',
		'Northgate Joinery',
		'northgatejoinery.co.uk',
		'#4A4A68',
		'suspended'
	)
]);

const ROLE_SEED: ReadonlyArray<{
	role: TenantRole;
	email: string;
	name: string;
	mfa?: boolean;
}> = [
	{
		role: ROLES.SYSTEM_ADMIN,
		email: 'admin@opulentinteriors.co.uk',
		name: 'Priya Nair',
		mfa: true
	},
	{
		role: ROLES.OWNER_MANAGEMENT,
		email: 'owner@opulentinteriors.co.uk',
		name: 'Marcus Bell',
		mfa: true
	},
	{ role: ROLES.SALES, email: 'sales@opulentinteriors.co.uk', name: 'Elena Rossi' },
	{ role: ROLES.DESIGNER, email: 'designer@opulentinteriors.co.uk', name: 'Tom Whitfield' },
	{ role: ROLES.SURVEYOR, email: 'surveyor@opulentinteriors.co.uk', name: 'Aisha Khan' },
	{ role: ROLES.PURCHASING, email: 'purchasing@opulentinteriors.co.uk', name: 'Derek Shaw' },
	{
		role: ROLES.PRODUCTION_MANAGER,
		email: 'production@opulentinteriors.co.uk',
		name: 'Sofia Almeida'
	},
	{ role: ROLES.WORKSHOP, email: 'workshop@opulentinteriors.co.uk', name: 'Callum Reid' },
	{ role: ROLES.INSTALLER, email: 'installer@opulentinteriors.co.uk', name: 'Jake Turner' },
	{ role: ROLES.ACCOUNTS, email: 'accounts@opulentinteriors.co.uk', name: 'Nadia Haddad' }
];

function user(
	id: string,
	tenantIdValue: string | null,
	email: string,
	displayName: string,
	roles: TenantRole[],
	options: { platform?: boolean; mfa?: boolean } = {}
): AppUserRecord {
	const platform = options.platform === true;
	return {
		id,
		tenantId: tenantIdValue,
		email,
		displayName,
		roles: platform ? [] : roles,
		platform,
		mfaEnrolled: options.mfa === true,
		status: 'active',
		permissions: platform ? [...ALL_PLATFORM_PERMISSIONS] : permissionsForRoles(roles),
		password: DEMO_PASSWORD,
		createdAt: CREATED_AT,
		updatedAt: demoDays(2)
	};
}

/** One user per canonical role in Opulent, plus the chooser and platform cases. */
export const DEMO_USERS: readonly AppUserRecord[] = Object.freeze([
	...ROLE_SEED.map((seed) =>
		user(userId('opulent', seed.role), tenantId('opulent'), seed.email, seed.name, [seed.role], {
			mfa: seed.mfa
		})
	),
	user(
		userId('opulent', 'ambiguous'),
		tenantId('opulent'),
		'ambiguous@example.com',
		'Alex Morgan',
		[ROLES.SALES]
	),
	user(
		userId('harbour', 'ambiguous'),
		tenantId('harbour'),
		'ambiguous@example.com',
		'Alex Morgan',
		[ROLES.DESIGNER]
	),
	user(userId('harbour', 'owner'), tenantId('harbour'), 'owner@harbourfinch.co.uk', 'Ruth Finch', [
		ROLES.OWNER_MANAGEMENT
	]),
	user(deterministicUuid('user:platform:staff'), null, 'platform@interio.app', 'Jordan Blake', [], {
		platform: true
	})
]);

export const DEMO_INVITATION: UserInvitationRecord = {
	id: deterministicUuid('invitation:opulent:designer'),
	tenantId: tenantId('opulent'),
	email: 'new.designer@opulentinteriors.co.uk',
	displayName: 'Imogen Clarke',
	role: ROLES.DESIGNER,
	token: deterministicUuid('invitation-token:opulent:designer'),
	createdAt: demoDays(3),
	expiresAt: demoDays(-7),
	acceptedAt: null
};

/** A few platform audit rows so the console has history on first load. */
export const DEMO_PLATFORM_AUDIT: readonly AuditEventRecord[] = Object.freeze([
	{
		id: deterministicUuid('platform-audit:1'),
		scope: 'platform',
		tenantId: tenantId('opulent'),
		actorUserId: deterministicUuid('user:platform:staff'),
		actorEmail: 'platform@interio.app',
		action: 'tenant.created',
		subjectType: 'tenant',
		subjectId: tenantId('opulent'),
		occurredAt: CREATED_AT,
		payload: { slug: 'opulent', plan: 'standard' }
	},
	{
		id: deterministicUuid('platform-audit:2'),
		scope: 'platform',
		tenantId: tenantId('harbour'),
		actorUserId: deterministicUuid('user:platform:staff'),
		actorEmail: 'platform@interio.app',
		action: 'tenant.created',
		subjectType: 'tenant',
		subjectId: tenantId('harbour'),
		occurredAt: demoDays(210),
		payload: { slug: 'harbour', plan: 'standard' }
	},
	{
		id: deterministicUuid('platform-audit:3'),
		scope: 'platform',
		tenantId: tenantId('harbour'),
		actorUserId: deterministicUuid('user:platform:staff'),
		actorEmail: 'platform@interio.app',
		action: 'tenant.branding.updated',
		subjectType: 'tenant',
		subjectId: tenantId('harbour'),
		occurredAt: demoDays(12),
		payload: { fields: ['accent', 'displayName'] }
	},
	{
		id: deterministicUuid('platform-audit:4'),
		scope: 'platform',
		tenantId: tenantId('northgate'),
		actorUserId: deterministicUuid('user:platform:staff'),
		actorEmail: 'platform@interio.app',
		action: 'tenant.suspended',
		subjectType: 'tenant',
		subjectId: tenantId('northgate'),
		occurredAt: demoDays(30),
		payload: { reason: 'Unpaid invoices' }
	}
]);

export function demoUserByEmail(email: string): AppUserRecord[] {
	const normalised = email.trim().toLowerCase();
	return DEMO_USERS.filter((candidate) => candidate.email === normalised);
}
