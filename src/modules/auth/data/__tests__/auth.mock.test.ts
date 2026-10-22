import { beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '$shared/data/collections';
import { DEMO_INVITATION, DEMO_PASSWORD, MFA_CODE } from '$shared/data/demo-seed';
import type {
	AppUserRecord,
	AuditEventRecord,
	TenantRecord,
	UserInvitationRecord
} from '$shared/data/records';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, isApiError } from '$network/errors';
import { getCollection, resetMockDb, updateCollection } from '$network/mock-backend';
import { getAccessToken, getRefreshToken } from '$network/token-storage';
import {
	mockAcceptInvitation,
	mockGetInvitation,
	mockLogin,
	mockLogout,
	mockMe,
	mockVerifyMfa
} from '../mock';

/**
 * Node test for the auth mock server. `localStorage` is stubbed before the
 * mock backend touches it; `resetMockDb()` gives every test the same seed.
 */

class MemoryStorage implements Storage {
	private readonly rows = new Map<string, string>();

	get length(): number {
		return this.rows.size;
	}

	clear(): void {
		this.rows.clear();
	}

	getItem(key: string): string | null {
		return this.rows.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.rows.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.rows.delete(key);
	}

	setItem(key: string, value: string): void {
		this.rows.set(key, value);
	}
}

function installStorage(): void {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		writable: true,
		value: new MemoryStorage()
	});
}

async function expectApiError(
	operation: Promise<unknown>,
	expected: { status: number; code: string; message: string }
): Promise<ApiError> {
	try {
		await operation;
	} catch (error) {
		expect(isApiError(error)).toBe(true);
		const apiError = error as ApiError;
		expect(apiError.status).toBe(expected.status);
		expect(apiError.code).toBe(expected.code);
		expect(apiError.message).toBe(expected.message);
		return apiError;
	}
	throw new Error('Expected the operation to fail, but it resolved.');
}

function seededUser(email: string): AppUserRecord {
	const user = getCollection<AppUserRecord>(COLLECTIONS.appUsers).find(
		(candidate) => candidate.email === email
	);
	if (!user) throw new Error(`Missing seeded user ${email}`);
	return user;
}

beforeEach(() => {
	installStorage();
	resetMockDb();
});

describe('auth mock login', () => {
	it('asks for a workspace when one email belongs to two tenants', async () => {
		const result = await mockLogin({
			email: 'AMBIGUOUS@example.com ',
			password: DEMO_PASSWORD
		});

		expect(result.status).toBe('workspace_required');
		if (result.status !== 'workspace_required') return;
		expect(result.tenants).toHaveLength(2);
		expect(result.tenants.map((tenant) => tenant.slug).sort()).toEqual(['harbour', 'opulent']);
		expect(result.tenants[0].legalName.length).toBeGreaterThan(0);
		expect(result.tenants[0].displayName.length).toBeGreaterThan(0);
	});

	it('signs in directly once a workspace slug is supplied', async () => {
		const result = await mockLogin({
			email: 'ambiguous@example.com',
			password: DEMO_PASSWORD,
			tenantSlug: 'harbour'
		});

		expect(result.status).toBe('authenticated');
		if (result.status !== 'authenticated') return;
		expect(result.user.tenant?.slug).toBe('harbour');
		expect(result.user.roles).toEqual(['designer']);
		expect(result.token).toBe(`mock-token:${result.user.id}`);
		expect(getAccessToken()).toBe(result.token);
	});

	it('rejects a wrong password without revealing the account', async () => {
		await expectApiError(
			mockLogin({ email: 'sales@opulentinteriors.co.uk', password: 'not-the-password' }),
			{
				status: 401,
				code: 'unauthorized',
				message: 'Email or password is incorrect.'
			}
		);
		expect(getAccessToken()).toBeNull();
	});

	it('rejects an unknown workspace slug with the generic message', async () => {
		await expectApiError(
			mockLogin({
				email: 'ambiguous@example.com',
				password: DEMO_PASSWORD,
				tenantSlug: 'does-not-exist'
			}),
			{
				status: 401,
				code: 'unauthorized',
				message: 'Email or password is incorrect.'
			}
		);
	});

	it('offers the workspace step to an email that resolves to no tenant, listing active tenants only', async () => {
		const result = await mockLogin({
			email: 'stranger@example.com',
			password: 'not-a-real-password'
		});

		expect(result.status).toBe('workspace_required');
		if (result.status !== 'workspace_required') return;
		expect(result.tenants.map((tenant) => tenant.slug).sort()).toEqual(['harbour', 'opulent']);
		expect(getAccessToken()).toBeNull();

		// Choosing a workspace still fails with the generic credential message.
		await expectApiError(
			mockLogin({
				email: 'stranger@example.com',
				password: 'not-a-real-password',
				tenantSlug: 'opulent'
			}),
			{ status: 401, code: 'unauthorized', message: 'Email or password is incorrect.' }
		);
	});
});

describe('auth mock audit and lockout', () => {
	it('writes a login_success row for an authenticated session', async () => {
		const login = await mockLogin({
			email: 'sales@opulentinteriors.co.uk',
			password: DEMO_PASSWORD
		});
		expect(login.status).toBe('authenticated');
		if (login.status !== 'authenticated') return;

		const events = getCollection<AuditEventRecord>(COLLECTIONS.auditEvents);
		const success = events.filter((event) => event.action === 'login_success');
		expect(success).toHaveLength(1);
		expect(success[0].actorUserId).toBe(login.user.id);
		expect(success[0].actorEmail).toBe('sales@opulentinteriors.co.uk');
		expect(success[0].tenantId).toBe(login.user.tenant?.id);
		expect(success[0].scope).toBe('tenant');
	});

	it('writes a login_failure row without storing the attempted password', async () => {
		await expectApiError(
			mockLogin({ email: 'sales@opulentinteriors.co.uk', password: 'wrong-password-1' }),
			{ status: 401, code: 'unauthorized', message: 'Email or password is incorrect.' }
		);

		const failures = getCollection<AuditEventRecord>(COLLECTIONS.auditEvents).filter(
			(event) => event.action === 'login_failure'
		);
		expect(failures).toHaveLength(1);
		expect(failures[0].actorEmail).toBe('sales@opulentinteriors.co.uk');
		expect(failures[0].actorUserId).toBe(seededUser('sales@opulentinteriors.co.uk').id);
		expect(JSON.stringify(failures[0])).not.toContain('wrong-password-1');
	});

	it('locks the account after ten failed attempts inside fifteen minutes', async () => {
		for (let attempt = 0; attempt < 10; attempt += 1) {
			await expectApiError(
				mockLogin({ email: 'sales@opulentinteriors.co.uk', password: `wrong-${attempt}` }),
				{ status: 401, code: 'unauthorized', message: 'Email or password is incorrect.' }
			);
		}

		await expectApiError(
			mockLogin({ email: 'sales@opulentinteriors.co.uk', password: DEMO_PASSWORD }),
			{
				status: 429,
				code: 'rate_limited',
				message: 'Too many sign-in attempts. Try again in 15 minutes.'
			}
		);
		expect(getAccessToken()).toBeNull();

		const events = getCollection<AuditEventRecord>(COLLECTIONS.auditEvents);
		expect(events.filter((event) => event.action === 'login_failure')).toHaveLength(10);
		expect(
			events.some(
				(event) =>
					event.action === 'denied' &&
					(event.payload as { reason?: string } | null)?.reason === 'locked_out'
			)
		).toBe(true);
	});
});

describe('auth mock MFA', () => {
	it('requires MFA, rejects a wrong code, then completes the session', async () => {
		const login = await mockLogin({
			email: 'admin@opulentinteriors.co.uk',
			password: DEMO_PASSWORD
		});
		expect(login.status).toBe('mfa_required');
		if (login.status !== 'mfa_required') return;

		await expectApiError(mockVerifyMfa({ challengeId: login.challengeId, code: '000000' }), {
			status: 400,
			code: 'validation',
			message: 'That code is not valid.'
		});

		const failedCode = getCollection<AuditEventRecord>(COLLECTIONS.auditEvents).filter(
			(event) => event.action === 'login_failure'
		);
		expect(failedCode).toHaveLength(1);
		expect((failedCode[0].payload as { reason?: string } | null)?.reason).toBe('invalid_mfa_code');

		const session = await mockVerifyMfa({ challengeId: login.challengeId, code: MFA_CODE });
		expect(session.user.email).toBe('admin@opulentinteriors.co.uk');
		expect(session.token).toBe(`mock-token:${session.user.id}`);
		expect(getAccessToken()).toBe(session.token);

		const success = getCollection<AuditEventRecord>(COLLECTIONS.auditEvents).filter(
			(event) => event.action === 'login_success'
		);
		expect(success).toHaveLength(1);
		expect(success[0].actorUserId).toBe(session.user.id);

		// The challenge is single-use.
		await expectApiError(mockVerifyMfa({ challengeId: login.challengeId, code: MFA_CODE }), {
			status: 400,
			code: 'validation',
			message: 'That code is not valid.'
		});
	});
});

describe('auth mock session', () => {
	it('round-trips /auth/me from the stored token', async () => {
		const login = await mockLogin({
			email: 'sales@opulentinteriors.co.uk',
			password: DEMO_PASSWORD
		});
		expect(login.status).toBe('authenticated');
		if (login.status !== 'authenticated') return;

		const me = await mockMe();
		expect(me.id).toBe(login.user.id);
		expect(me.email).toBe('sales@opulentinteriors.co.uk');
		expect(me.tenant?.slug).toBe('opulent');
		expect(me.tenant?.branding?.accent).toBe('#8A5A2B');
		expect(me.permissions.length).toBeGreaterThan(0);
		expect(me.mfaEnrolled).toBe(false);
	});

	it('clears both tokens on logout and then expires the session', async () => {
		const login = await mockLogin({
			email: 'sales@opulentinteriors.co.uk',
			password: DEMO_PASSWORD
		});
		expect(login.status).toBe('authenticated');

		await mockLogout();
		expect(getAccessToken()).toBeNull();
		expect(getRefreshToken()).toBeNull();
		await expectApiError(mockMe(), {
			status: 401,
			code: 'unauthorized',
			message: 'Your session has expired.'
		});
	});
});

describe('auth mock invitations', () => {
	it('previews an invitation and accepts it once, creating exactly one user', async () => {
		const before = getCollection<AppUserRecord>(COLLECTIONS.appUsers).length;

		const preview = await mockGetInvitation(DEMO_INVITATION.token);
		expect(preview.email).toBe(DEMO_INVITATION.email);
		expect(preview.tenantName).toBe('Opulent Interiors');
		expect(preview.role).toBe('designer');
		expect(preview.expiresAt).toBe(DEMO_INVITATION.expiresAt);

		const session = await mockAcceptInvitation({
			token: DEMO_INVITATION.token,
			displayName: 'Imogen Clarke',
			password: 'A-long-password-1'
		});

		expect(session.user.email).toBe(DEMO_INVITATION.email);
		expect(session.user.roles).toEqual(['designer']);
		expect(session.user.tenant?.slug).toBe('opulent');
		expect(session.user.permissions.length).toBeGreaterThan(0);
		expect(getCollection<AppUserRecord>(COLLECTIONS.appUsers)).toHaveLength(before + 1);

		const invitation = getCollection<UserInvitationRecord>(COLLECTIONS.userInvitations).find(
			(row) => row.token === DEMO_INVITATION.token
		);
		expect(invitation?.acceptedAt).not.toBeNull();

		const accepted = getCollection<AuditEventRecord>(COLLECTIONS.auditEvents).filter(
			(event) => event.action === 'invite_accept'
		);
		expect(accepted).toHaveLength(1);
		expect(accepted[0].subjectId).toBe(session.user.id);
		expect(accepted[0].tenantId).toBe(session.user.tenant?.id);
		expect((accepted[0].payload as { role?: string } | null)?.role).toBe('designer');

		await expectApiError(mockGetInvitation(DEMO_INVITATION.token), {
			status: 409,
			code: 'conflict',
			message: 'This invitation has already been used.'
		});
	});

	it('returns 404 for an unknown invitation token', async () => {
		await expectApiError(mockGetInvitation('not-a-real-token'), {
			status: 404,
			code: 'not_found',
			message: 'This invitation could not be found.'
		});
	});
});

describe('auth mock tenant status', () => {
	it('rejects a user whose workspace is suspended', async () => {
		const tenants = getCollection<TenantRecord>(COLLECTIONS.tenants);
		const northgate = tenants.find((tenant) => tenant.slug === 'northgate');
		expect(northgate?.status).toBe('suspended');
		if (!northgate) return;

		const template = seededUser('sales@opulentinteriors.co.uk');
		updateCollection<AppUserRecord>(COLLECTIONS.appUsers, (rows) => [
			...rows,
			{
				...template,
				id: newUuid(),
				tenantId: northgate.id,
				email: 'blocked@northgatejoinery.co.uk',
				displayName: 'Blocked Colleague'
			}
		]);

		await expectApiError(
			mockLogin({ email: 'blocked@northgatejoinery.co.uk', password: DEMO_PASSWORD }),
			{
				status: 403,
				code: 'forbidden',
				message: 'This workspace is not available. Contact your administrator.'
			}
		);

		const denied = getCollection<AuditEventRecord>(COLLECTIONS.auditEvents).filter(
			(event) => event.action === 'denied'
		);
		expect(denied).toHaveLength(1);
		expect(denied[0].tenantId).toBe(northgate.id);
		expect((denied[0].payload as { reason?: string } | null)?.reason).toBe('tenant_unavailable');
	});
});
