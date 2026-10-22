import { COLLECTIONS } from '$shared/data/collections';
import { DEMO_PASSWORD, MFA_CODE } from '$shared/data/demo-seed';
import type {
	AppUserRecord,
	AuditEventRecord,
	TenantRecord,
	UserInvitationRecord
} from '$shared/data/records';
import { permissionsForRoles } from '$shared/domain/permissions';
import { ROLE_LABELS } from '$shared/domain/roles';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, registerSeeder, updateCollection } from '$network/mock-backend';
import {
	clearTokens,
	getAccessToken,
	setAccessToken,
	setRefreshToken
} from '$network/token-storage';
import type {
	AcceptInvitationInput,
	AuthSession,
	DemoAccount,
	InvitationPreview,
	LoginInput,
	LoginResult,
	MfaVerifyInput,
	TenantChoice
} from '../domain/types';
import { seededInvitations, seededTenants, seededUsers } from './seed';

/**
 * Auth mock logic (architecture §4.6).
 *
 * Behaves like a small server: every read goes through `getCollection`, so
 * rows created by the platform console are visible here, and every write goes
 * through `updateCollection` so seed objects are never mutated in place.
 */

registerSeeder(() => ({
	[COLLECTIONS.tenants]: [...seededTenants],
	[COLLECTIONS.appUsers]: [...seededUsers],
	[COLLECTIONS.userInvitations]: [...seededInvitations]
}));

const TOKEN_PREFIX = 'mock-token:';
const GENERIC_AUTH_MESSAGE = 'Email or password is incorrect.';
const TENANT_UNAVAILABLE_MESSAGE = 'This workspace is not available. Contact your administrator.';
const INVALID_CODE_MESSAGE = 'That code is not valid.';
const EXPIRED_SESSION_MESSAGE = 'Your session has expired.';
const LOCKOUT_MESSAGE = 'Too many sign-in attempts. Try again in 15 minutes.';
const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

/** Pending MFA challenges live in memory only, like a short-lived server record. */
const pendingChallenges = new Map<string, { userId: string }>();

interface AuditInput {
	tenantId: string | null;
	actorUserId: string | null;
	actorEmail: string;
	action: string;
	subjectType: string;
	subjectId: string | null;
	payload?: Record<string, unknown> | null;
}

/**
 * Append-only tenant audit trail (R3, architecture §4.9). Runtime events use
 * the real clock; only seed data is pinned to the demo clock.
 */
function recordAudit(input: AuditInput): void {
	const event: AuditEventRecord = {
		id: newUuid(),
		scope: 'tenant',
		tenantId: input.tenantId,
		actorUserId: input.actorUserId,
		actorEmail: input.actorEmail,
		action: input.action,
		subjectType: input.subjectType,
		subjectId: input.subjectId,
		occurredAt: new Date().toISOString(),
		payload: input.payload ?? null
	};
	updateCollection<AuditEventRecord>(COLLECTIONS.auditEvents, (rows) => [...rows, event]);
}

function readAuditEvents(): AuditEventRecord[] {
	return getCollection<AuditEventRecord>(COLLECTIONS.auditEvents);
}

function recentFailureCount(email: string): number {
	const normalised = normalisedEmail(email);
	const cutoff = Date.now() - LOCKOUT_WINDOW_MS;
	return readAuditEvents().filter(
		(event) =>
			event.action === 'login_failure' &&
			normalisedEmail(event.actorEmail) === normalised &&
			Date.parse(event.occurredAt) >= cutoff
	).length;
}

/**
 * N5 / S34: ten failed attempts inside fifteen minutes lock the account out
 * until the oldest failure leaves the window. The lockout is global per email,
 * not per workspace, so guessing across tenants cannot reset the counter.
 */
function assertNotLocked(email: string, user: AppUserRecord | null = null): void {
	if (recentFailureCount(email) < LOCKOUT_THRESHOLD) return;
	recordAudit({
		tenantId: user?.tenantId ?? null,
		actorUserId: user?.id ?? null,
		actorEmail: email,
		action: 'denied',
		subjectType: 'session',
		subjectId: user?.id ?? null,
		payload: { reason: 'locked_out', windowMinutes: LOCKOUT_WINDOW_MS / 60_000 }
	});
	throw new ApiError({
		code: ApiErrorCode.RATE_LIMITED,
		message: LOCKOUT_MESSAGE,
		status: 429
	});
}

function recordLoginFailure(
	email: string,
	reason: 'invalid_credentials' | 'unknown_account' | 'invalid_mfa_code',
	user: AppUserRecord | null = null
): void {
	recordAudit({
		tenantId: user?.tenantId ?? null,
		actorUserId: user?.id ?? null,
		actorEmail: normalisedEmail(email),
		action: 'login_failure',
		subjectType: 'session',
		subjectId: user?.id ?? null,
		payload: { reason }
	});
}

function recordLoginSuccess(user: AppUserRecord): void {
	recordAudit({
		tenantId: user.tenantId,
		actorUserId: user.id,
		actorEmail: user.email,
		action: 'login_success',
		subjectType: 'session',
		subjectId: user.id,
		payload: { platform: user.platform }
	});
}

function unauthorized(message = GENERIC_AUTH_MESSAGE): ApiError {
	return new ApiError({
		code: ApiErrorCode.UNAUTHORIZED,
		message,
		status: 401
	});
}

function forbidden(message = TENANT_UNAVAILABLE_MESSAGE): ApiError {
	return new ApiError({
		code: ApiErrorCode.FORBIDDEN,
		message,
		status: 403
	});
}

function notFound(message: string): ApiError {
	return new ApiError({
		code: ApiErrorCode.NOT_FOUND,
		message,
		status: 404
	});
}

function conflict(message: string, status = 409): ApiError {
	return new ApiError({
		code: ApiErrorCode.CONFLICT,
		message,
		status
	});
}

function validation(message: string): ApiError {
	return new ApiError({
		code: ApiErrorCode.VALIDATION,
		message,
		status: 400
	});
}

function normalisedEmail(email: string): string {
	return email.trim().toLowerCase();
}

function readUsers(): AppUserRecord[] {
	return getCollection<AppUserRecord>(COLLECTIONS.appUsers);
}

function readTenants(): TenantRecord[] {
	return getCollection<TenantRecord>(COLLECTIONS.tenants);
}

function readInvitations(): UserInvitationRecord[] {
	return getCollection<UserInvitationRecord>(COLLECTIONS.userInvitations);
}

function findTenant(tenantId: string | null): TenantRecord | null {
	if (!tenantId) return null;
	return readTenants().find((tenant) => tenant.id === tenantId) ?? null;
}

function usersByEmail(email: string): AppUserRecord[] {
	const normalised = normalisedEmail(email);
	return readUsers().filter((user) => normalisedEmail(user.email) === normalised);
}

function toTenantIdentity(tenant: TenantRecord | null): TenantIdentity | null {
	if (!tenant) return null;
	return {
		id: tenant.id,
		slug: tenant.slug,
		legalName: tenant.legalName,
		status: tenant.status,
		branding: tenant.branding
	};
}

function toTenantChoice(tenant: TenantRecord): TenantChoice {
	return {
		id: tenant.id,
		slug: tenant.slug,
		legalName: tenant.legalName,
		displayName: tenant.displayName
	};
}

function toSessionUser(user: AppUserRecord): SessionUser {
	const tenant = user.platform ? null : findTenant(user.tenantId);
	return {
		id: user.id,
		email: user.email,
		displayName: user.displayName,
		roles: [...user.roles],
		permissions: [...user.permissions],
		tenant: toTenantIdentity(tenant),
		platform: user.platform,
		mfaEnrolled: user.mfaEnrolled
	};
}

/**
 * Tenant status is checked before a session exists. Platform staff belong to
 * no tenant and are never blocked by tenant state.
 */
function assertTenantAvailable(user: AppUserRecord): TenantRecord | null {
	if (user.platform) return null;
	const tenant = findTenant(user.tenantId);
	if (!tenant || tenant.status !== 'active') {
		recordAudit({
			tenantId: user.tenantId,
			actorUserId: user.id,
			actorEmail: user.email,
			action: 'denied',
			subjectType: 'tenant',
			subjectId: user.tenantId,
			payload: { reason: tenant ? 'tenant_unavailable' : 'tenant_missing' }
		});
		throw forbidden();
	}
	return tenant;
}

function startSession(user: AppUserRecord): AuthSession {
	const token = `${TOKEN_PREFIX}${user.id}`;
	setAccessToken(token);
	setRefreshToken(token);
	return { token, user: toSessionUser(user) };
}

function beginAuthentication(user: AppUserRecord): LoginResult {
	if (user.mfaEnrolled) {
		const challengeId = newUuid();
		pendingChallenges.set(challengeId, { userId: user.id });
		return { status: 'mfa_required', challengeId };
	}
	const session = startSession(user);
	recordLoginSuccess(user);
	return { status: 'authenticated', token: session.token, user: session.user };
}

function userIdFromToken(token: string | null): string | null {
	if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
	const userId = token.slice(TOKEN_PREFIX.length).trim();
	return userId.length > 0 ? userId : null;
}

function requireUsableInvitation(token: string): UserInvitationRecord {
	const invitation = readInvitations().find((row) => row.token === token);
	if (!invitation) throw notFound('This invitation could not be found.');
	if (invitation.acceptedAt) throw conflict('This invitation has already been used.');
	const expiresAt = Date.parse(invitation.expiresAt);
	if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
		throw conflict('This invitation has expired.', 410);
	}
	return invitation;
}

function invitationPreview(invitation: UserInvitationRecord): InvitationPreview {
	const tenant = findTenant(invitation.tenantId);
	if (!tenant) throw notFound('This invitation could not be found.');
	return {
		token: invitation.token,
		email: invitation.email,
		tenantName: tenant.displayName || tenant.legalName,
		role: invitation.role,
		expiresAt: invitation.expiresAt
	};
}

export async function mockLogin(input: LoginInput): Promise<LoginResult> {
	const candidates = usersByEmail(input.email);
	assertNotLocked(input.email, candidates[0] ?? null);

	const tenantSlug = input.tenantSlug?.trim();

	/*
	 * TEN-01: an email that resolves to no tenant still gets the workspace step
	 * (the invite path starts there). Selecting a workspace then fails with the
	 * generic credential message, so no account existence leaks.
	 */
	if (candidates.length === 0) {
		if (tenantSlug) {
			recordLoginFailure(input.email, 'unknown_account');
			throw unauthorized();
		}
		const tenants = readTenants()
			.filter((tenant) => tenant.status === 'active')
			.map(toTenantChoice);
		if (tenants.length === 0) throw unauthorized();
		return { status: 'workspace_required', tenants };
	}

	if (tenantSlug) {
		const user = candidates.find((candidate) => {
			const tenant = findTenant(candidate.tenantId);
			return tenant?.slug === tenantSlug;
		});
		// An unknown workspace is never revealed as "exists but not yours".
		if (!user) {
			recordLoginFailure(input.email, 'unknown_account', candidates[0]);
			throw unauthorized();
		}
		if (user.password !== input.password) {
			recordLoginFailure(input.email, 'invalid_credentials', user);
			throw unauthorized();
		}
		assertTenantAvailable(user);
		return beginAuthentication(user);
	}

	if (candidates.length > 1) {
		const byTenant = new Map<string, TenantChoice>();
		for (const candidate of candidates) {
			const tenant = findTenant(candidate.tenantId);
			if (tenant) byTenant.set(tenant.id, toTenantChoice(tenant));
		}
		if (byTenant.size > 1) {
			return { status: 'workspace_required', tenants: [...byTenant.values()] };
		}
	}

	const user = candidates[0];
	if (user.password !== input.password) {
		recordLoginFailure(input.email, 'invalid_credentials', user);
		throw unauthorized();
	}
	assertTenantAvailable(user);
	return beginAuthentication(user);
}

export async function mockVerifyMfa(input: MfaVerifyInput): Promise<AuthSession> {
	const challenge = pendingChallenges.get(input.challengeId);
	if (!challenge) throw validation(INVALID_CODE_MESSAGE);

	const user = readUsers().find((candidate) => candidate.id === challenge.userId);
	if (!user) {
		pendingChallenges.delete(input.challengeId);
		throw unauthorized(EXPIRED_SESSION_MESSAGE);
	}

	assertNotLocked(user.email, user);

	if (input.code.trim() !== MFA_CODE) {
		recordLoginFailure(user.email, 'invalid_mfa_code', user);
		throw validation(INVALID_CODE_MESSAGE);
	}

	assertTenantAvailable(user);
	pendingChallenges.delete(input.challengeId);
	const session = startSession(user);
	recordLoginSuccess(user);
	return session;
}

export async function mockMe(): Promise<SessionUser> {
	const userId = userIdFromToken(getAccessToken());
	if (!userId) throw unauthorized(EXPIRED_SESSION_MESSAGE);

	const user = readUsers().find((candidate) => candidate.id === userId);
	if (!user || user.status !== 'active') throw unauthorized(EXPIRED_SESSION_MESSAGE);

	assertTenantAvailable(user);
	return toSessionUser(user);
}

export async function mockLogout(): Promise<void> {
	const user = readUsers().find((candidate) => candidate.id === userIdFromToken(getAccessToken()));
	if (user) {
		recordAudit({
			tenantId: user.tenantId,
			actorUserId: user.id,
			actorEmail: user.email,
			action: 'logout',
			subjectType: 'session',
			subjectId: user.id,
			payload: null
		});
	}
	clearTokens();
}

export async function mockGetInvitation(token: string): Promise<InvitationPreview> {
	return invitationPreview(requireUsableInvitation(token));
}

export async function mockAcceptInvitation(input: AcceptInvitationInput): Promise<AuthSession> {
	const invitation = requireUsableInvitation(input.token);
	const tenant = findTenant(invitation.tenantId);
	if (!tenant) throw notFound('This invitation could not be found.');
	if (tenant.status !== 'active') throw forbidden();

	const now = new Date().toISOString();
	const user: AppUserRecord = {
		id: newUuid(),
		tenantId: invitation.tenantId,
		email: invitation.email,
		displayName: input.displayName.trim() || invitation.displayName,
		roles: [invitation.role],
		platform: false,
		mfaEnrolled: false,
		status: 'active',
		permissions: permissionsForRoles([invitation.role]),
		password: input.password,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<AppUserRecord>(COLLECTIONS.appUsers, (rows) => [...rows, user]);
	updateCollection<UserInvitationRecord>(COLLECTIONS.userInvitations, (rows) =>
		rows.map((row) => (row.id === invitation.id ? { ...row, acceptedAt: now } : row))
	);
	recordAudit({
		tenantId: invitation.tenantId,
		actorUserId: user.id,
		actorEmail: user.email,
		action: 'invite_accept',
		subjectType: 'app_user',
		subjectId: user.id,
		payload: { role: invitation.role, invitationId: invitation.id }
	});

	return startSession(user);
}

/**
 * Demo-only affordance. Reads the canonical seed rather than live rows so the
 * list stays stable even after invitations and platform-created users exist.
 */
export async function mockListDemoAccounts(): Promise<DemoAccount[]> {
	const grouped = new Map<string, AppUserRecord[]>();
	for (const user of seededUsers) {
		const key = normalisedEmail(user.email);
		grouped.set(key, [...(grouped.get(key) ?? []), user]);
	}

	return [...grouped.values()].map((users) => {
		const primary = users[0];
		const firstRole = primary.roles[0];
		const isPlatform = users.some((user) => user.platform);
		const needsMfa = users.some((user) => user.mfaEnrolled);
		const tenantIds = new Set(
			users.map((user) => user.tenantId).filter((tenantId): tenantId is string => tenantId !== null)
		);

		let note = 'Signs in directly';
		if (needsMfa) note = `MFA required — code ${MFA_CODE}`;
		else if (tenantIds.size > 1) note = 'Two workspaces — you will choose after sign-in';
		else if (isPlatform) note = 'Platform console';

		return {
			email: primary.email,
			password: DEMO_PASSWORD,
			roleLabel: isPlatform ? 'Platform staff' : firstRole ? ROLE_LABELS[firstRole] : 'Team member',
			note
		};
	});
}
