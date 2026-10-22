import { get } from 'svelte/store';
import type { ZodError } from 'zod';
import { sessionStore } from '$shared/application/session';
import { COLLECTIONS } from '$shared/data/collections';
import { demoDays, demoNow } from '$shared/data/demo-clock';
import type {
	AppUserRecord,
	AuditEventRecord,
	TenantRecord,
	UserInvitationRecord
} from '$shared/data/records';
import { PLATFORM_PERMISSIONS } from '$shared/domain/permissions';
import { ROLES } from '$shared/domain/roles';
import type { SessionUser, TenantStatus } from '$shared/domain/user';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { requirePermission } from '$network/guard';
import { getCollection, registerSeeder, updateCollection } from '$network/mock-backend';
import type { Paginated } from '$network/types';
import type {
	CreateTenantInput,
	PlatformAuditListParams,
	PlatformAuditRow,
	TenantDetail,
	TenantListParams,
	TenantListRow,
	TenantTransitionInput,
	TenantTransitionTarget
} from '../domain/types';
import {
	fieldErrorsFrom,
	tenantFormSchema,
	TENANT_TRANSITION_TARGETS
} from '../domain/validations';
import { seedPlatformAudit } from './seed';

/** The mock backend behaves like the server: every call is authorised first. */
registerSeeder(seedPlatformAudit);

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const RECENT_AUDIT_LIMIT = 5;
const INVITATION_TTL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const PLATFORM_DENIED_MESSAGE = 'You do not have access to the platform console.';
const TENANT_NOT_FOUND_MESSAGE = 'Tenant not found.';

function unauthorized(): ApiError {
	return new ApiError({
		code: ApiErrorCode.UNAUTHORIZED,
		status: 401,
		message: 'Sign in to use the platform console.'
	});
}

function platformDenied(): ApiError {
	return new ApiError({
		code: ApiErrorCode.FORBIDDEN,
		status: 403,
		message: PLATFORM_DENIED_MESSAGE
	});
}

function notFound(message = TENANT_NOT_FOUND_MESSAGE): ApiError {
	return new ApiError({ code: ApiErrorCode.NOT_FOUND, status: 404, message });
}

function conflict(message: string): ApiError {
	return new ApiError({ code: ApiErrorCode.CONFLICT, status: 409, message });
}

function validation(message: string, fieldErrors?: Record<string, string>): ApiError {
	return new ApiError({
		code: ApiErrorCode.VALIDATION,
		status: 400,
		message,
		fieldErrors
	});
}

/**
 * Belt-and-braces authorisation for the mock server.
 *
 * 1. No session → 401, exactly like an unauthenticated request.
 * 2. A tenant session (or a platform user missing the scope) → 403 with the
 *    platform message, before any tenant data is read.
 * 3. Only then the shared guard runs, so a forged permission array alone can
 *    never widen access.
 */
function requirePlatform(permission: string): SessionUser {
	const session = get(sessionStore);
	const user = session.user;

	if (!user) throw unauthorized();
	if (user.platform !== true || !user.permissions.includes(permission)) throw platformDenied();

	requirePermission(permission);
	return user;
}

/**
 * Newest first. Runtime events created in the same demo-clock instant keep
 * insertion order (the later append wins), which is how an append-only audit
 * stream reads when timestamps tie.
 */
function sortNewestFirst(events: AuditEventRecord[]): AuditEventRecord[] {
	return events
		.map((event, index) => ({ event, index }))
		.sort(
			(first, second) =>
				second.event.occurredAt.localeCompare(first.event.occurredAt) || second.index - first.index
		)
		.map(({ event }) => event);
}

function matches(value: string | null | undefined, needle: string): boolean {
	return typeof value === 'string' && value.toLowerCase().includes(needle);
}

function countActiveUsers(tenantId: string, users: readonly AppUserRecord[]): number {
	// Invitations are not accounts yet: only accepted, enabled members count.
	return users.filter((user) => user.tenantId === tenantId && user.status === 'active').length;
}

function tenantToRow(tenant: TenantRecord, users: readonly AppUserRecord[]): TenantListRow {
	return {
		id: tenant.id,
		slug: tenant.slug,
		legalName: tenant.legalName,
		displayName: tenant.displayName,
		status: tenant.status,
		userCount: countActiveUsers(tenant.id, users),
		createdAt: tenant.createdAt
	};
}

function toAuditRow(event: AuditEventRecord, tenants: readonly TenantRecord[]): PlatformAuditRow {
	const subject = event.tenantId
		? tenants.find((tenant) => tenant.id === event.tenantId)
		: undefined;
	return {
		id: event.id,
		action: event.action,
		actorEmail: event.actorEmail,
		subjectTenantId: event.tenantId,
		subjectTenantName: subject ? subject.displayName : null,
		occurredAt: event.occurredAt,
		payload: event.payload ? { ...event.payload } : null
	};
}

function toTenantDetail(tenant: TenantRecord, tenants: readonly TenantRecord[]): TenantDetail {
	const users = getCollection<AppUserRecord>(COLLECTIONS.appUsers);
	const recentAudit = sortNewestFirst(
		getCollection<AuditEventRecord>(COLLECTIONS.platformAuditEvents).filter(
			(event) => event.tenantId === tenant.id
		)
	)
		.slice(0, RECENT_AUDIT_LIMIT)
		.map((event) => toAuditRow(event, tenants));

	return {
		...tenantToRow(tenant, users),
		branding: tenant.branding ? { ...tenant.branding } : null,
		defaultCurrency: tenant.defaultCurrency,
		vatNumber: tenant.vatNumber,
		referencePattern: tenant.referencePattern,
		emailDomain: tenant.emailDomain,
		recentAudit
	};
}

function mapZodError(error: ZodError): ApiError {
	return validation('Check the highlighted fields and try again.', fieldErrorsFrom(error));
}

function paginate<T>(
	items: T[],
	page: number | undefined,
	pageSize: number | undefined
): Paginated<T> {
	const size = Math.min(
		MAX_PAGE_SIZE,
		Math.max(1, Math.floor(pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE)
	);
	const current = Math.max(1, Math.floor(page ?? 1) || 1);
	const total = items.length;
	const start = (current - 1) * size;
	return {
		items: items.slice(start, start + size),
		page: current,
		pageSize: size,
		total,
		totalPages: total === 0 ? 0 : Math.ceil(total / size)
	};
}

function appendAudit(event: AuditEventRecord): void {
	updateCollection<AuditEventRecord>(COLLECTIONS.platformAuditEvents, (rows) => [...rows, event]);
}

function displayNameFromEmail(email: string): string {
	const localPart = email.split('@')[0] ?? email;
	const words = localPart.split(/[._-]+/).filter((word) => word.length > 0);
	if (words.length === 0) return localPart;
	return words
		.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
		.join(' ');
}

export async function mockListTenants(
	params: TenantListParams = {}
): Promise<Paginated<TenantListRow>> {
	requirePlatform(PLATFORM_PERMISSIONS.PLATFORM_TENANT_VIEW);

	const tenants = getCollection<TenantRecord>(COLLECTIONS.tenants);
	const users = getCollection<AppUserRecord>(COLLECTIONS.appUsers);
	const search = params.search?.trim().toLowerCase() ?? '';
	const status: TenantStatus | 'all' = params.status ?? 'all';

	const rows = tenants
		.filter((tenant) => status === 'all' || tenant.status === status)
		.filter(
			(tenant) =>
				search.length === 0 ||
				matches(tenant.legalName, search) ||
				matches(tenant.slug, search) ||
				matches(tenant.displayName, search)
		)
		.map((tenant) => tenantToRow(tenant, users))
		.sort((first, second) => first.legalName.localeCompare(second.legalName, 'en-GB'));

	return paginate(rows, params.page, params.pageSize);
}

export async function mockGetTenant(id: string): Promise<TenantDetail> {
	requirePlatform(PLATFORM_PERMISSIONS.PLATFORM_TENANT_VIEW);

	const tenants = getCollection<TenantRecord>(COLLECTIONS.tenants);
	const tenant = tenants.find((row) => row.id === id);
	if (!tenant) throw notFound();
	return toTenantDetail(tenant, tenants);
}

export async function mockCreateTenant(input: CreateTenantInput): Promise<TenantDetail> {
	const actor = requirePlatform(PLATFORM_PERMISSIONS.PLATFORM_TENANT_CREATE);

	const parsed = tenantFormSchema.safeParse({
		legalName: input.legalName,
		slug: input.slug,
		displayName: input.displayName,
		accent: input.accent,
		defaultCurrency: input.defaultCurrency,
		vatNumber: input.vatNumber,
		referencePattern: input.referencePattern,
		emailDomain: input.emailDomain,
		adminEmail: input.adminEmail
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const values = parsed.data;
	const tenants = getCollection<TenantRecord>(COLLECTIONS.tenants);
	const slug = values.slug.toLowerCase();

	if (tenants.some((tenant) => tenant.slug.toLowerCase() === slug)) {
		throw conflict('That slug is already in use.');
	}

	const emailDomain = values.emailDomain ? values.emailDomain.toLowerCase() : null;
	if (
		emailDomain !== null &&
		tenants.some((tenant) => (tenant.emailDomain ?? '').toLowerCase() === emailDomain)
	) {
		throw conflict('That email domain is already in use.');
	}

	const now = demoNow().toISOString();
	const createdAt = demoDays(0);
	const record: TenantRecord = {
		id: newUuid(),
		slug,
		legalName: values.legalName,
		displayName: values.displayName ?? values.legalName,
		status: 'active',
		branding: values.accent ? { accent: values.accent } : null,
		defaultCurrency: values.defaultCurrency,
		vatNumber: values.vatNumber ?? null,
		referencePattern: values.referencePattern ?? null,
		emailDomain,
		createdAt,
		updatedAt: now
	};

	updateCollection<TenantRecord>(COLLECTIONS.tenants, (rows) => [...rows, record]);

	const invitation: UserInvitationRecord = {
		id: newUuid(),
		tenantId: record.id,
		email: values.adminEmail,
		displayName: displayNameFromEmail(values.adminEmail),
		role: ROLES.SYSTEM_ADMIN,
		token: newUuid(),
		createdAt,
		expiresAt: new Date(demoNow().getTime() + INVITATION_TTL_DAYS * DAY_MS).toISOString(),
		acceptedAt: null
	};
	updateCollection<UserInvitationRecord>(COLLECTIONS.userInvitations, (rows) => [
		...rows,
		invitation
	]);

	appendAudit({
		id: newUuid(),
		scope: 'platform',
		tenantId: record.id,
		actorUserId: actor.id,
		actorEmail: actor.email,
		action: 'tenant.created',
		subjectType: 'tenant',
		subjectId: record.id,
		occurredAt: now,
		payload: { slug: record.slug, adminEmail: values.adminEmail }
	});

	return toTenantDetail(record, [...tenants, record]);
}

export async function mockTransitionTenant(
	id: string,
	input: TenantTransitionInput
): Promise<TenantDetail> {
	const actor = requirePlatform(PLATFORM_PERMISSIONS.PLATFORM_TENANT_SUSPEND);

	if (!(TENANT_TRANSITION_TARGETS as readonly string[]).includes(input.to)) {
		throw validation('Choose a valid tenant state.');
	}

	const target: TenantTransitionTarget = input.to;
	const tenants = getCollection<TenantRecord>(COLLECTIONS.tenants);
	const tenant = tenants.find((row) => row.id === id);
	if (!tenant) throw notFound();

	if (tenant.status === 'offboarded') {
		throw conflict('This tenant is offboarded and cannot change state.');
	}
	if (tenant.status === target) {
		throw conflict(`This tenant is already ${target}.`);
	}

	const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
	if (target === 'active') {
		if (reason.length > 200) throw validation('Keep the reason to 200 characters or fewer.');
	} else if (reason.length < 3 || reason.length > 200) {
		throw validation('Enter a reason of at least 3 characters.', {
			reason: 'Enter a reason of at least 3 characters.'
		});
	}

	const now = demoNow().toISOString();
	const updated: TenantRecord = { ...tenant, status: target, updatedAt: now };
	updateCollection<TenantRecord>(COLLECTIONS.tenants, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);

	const action: Record<TenantTransitionTarget, string> = {
		active: 'tenant.reactivated',
		suspended: 'tenant.suspended',
		offboarded: 'tenant.offboarded'
	};

	appendAudit({
		id: newUuid(),
		scope: 'platform',
		tenantId: updated.id,
		actorUserId: actor.id,
		actorEmail: actor.email,
		action: action[target],
		subjectType: 'tenant',
		subjectId: updated.id,
		occurredAt: now,
		payload: { reason }
	});

	const nextTenants = tenants.map((row) => (row.id === updated.id ? updated : row));
	return toTenantDetail(updated, nextTenants);
}

export async function mockListPlatformAudit(
	params: PlatformAuditListParams = {}
): Promise<Paginated<PlatformAuditRow>> {
	requirePlatform(PLATFORM_PERMISSIONS.PLATFORM_AUDIT_VIEW);

	const tenants = getCollection<TenantRecord>(COLLECTIONS.tenants);
	const search = params.search?.trim().toLowerCase() ?? '';

	const rows = sortNewestFirst(
		getCollection<AuditEventRecord>(COLLECTIONS.platformAuditEvents).filter((event) =>
			params.tenantId ? event.tenantId === params.tenantId : true
		)
	)
		.map((event) => toAuditRow(event, tenants))
		.filter(
			(row) =>
				search.length === 0 ||
				matches(row.action, search) ||
				matches(row.actorEmail, search) ||
				matches(row.subjectTenantName, search)
		);

	return paginate(rows, params.page, params.pageSize);
}
