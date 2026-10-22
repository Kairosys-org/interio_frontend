import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));

import { session } from '$shared/application/session';
import { COLLECTIONS } from '$shared/data/collections';
import { DEMO_INVITATION, DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import { demoNow } from '$shared/data/demo-clock';
import type { AppUserRecord, UserInvitationRecord } from '$shared/data/records';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { ApiError } from '$network/errors';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import type { CreateTenantInput } from '../../domain/types';
import {
	mockCreateTenant,
	mockGetTenant,
	mockListPlatformAudit,
	mockListTenants,
	mockTransitionTenant
} from '../mock';

const DAY_MS = 24 * 60 * 60 * 1000;
const PLATFORM_DENIED_MESSAGE = 'You do not have access to the platform console.';
const OPULENT = DEMO_TENANTS[0];
const HARBOUR = DEMO_TENANTS[1];
const NORTHGATE = DEMO_TENANTS[2];

type StorageLike = Storage;

function createMemoryStorage(): StorageLike {
	const values = new Map<string, string>();
	return {
		get length() {
			return values.size;
		},
		clear() {
			values.clear();
		},
		getItem(key: string) {
			return values.has(key) ? (values.get(key) ?? null) : null;
		},
		key(index: number) {
			return Array.from(values.keys())[index] ?? null;
		},
		removeItem(key: string) {
			values.delete(key);
		},
		setItem(key: string, value: string) {
			values.set(key, String(value));
		}
	};
}

function sessionUserFrom(record: AppUserRecord): SessionUser {
	const tenantRecord = record.tenantId
		? (DEMO_TENANTS.find((candidate) => candidate.id === record.tenantId) ?? null)
		: null;
	const tenant: TenantIdentity | null = tenantRecord
		? {
				id: tenantRecord.id,
				slug: tenantRecord.slug,
				legalName: tenantRecord.legalName,
				status: tenantRecord.status,
				branding: tenantRecord.branding
			}
		: null;

	return {
		id: record.id,
		email: record.email,
		displayName: record.displayName,
		roles: record.roles,
		permissions: record.permissions,
		tenant,
		platform: record.platform,
		mfaEnrolled: record.mfaEnrolled
	};
}

function signIn(email: string): SessionUser {
	const record = DEMO_USERS.find((candidate) => candidate.email === email);
	if (!record) throw new Error(`Demo user ${email} is missing from the seed.`);
	const user = sessionUserFrom(record);
	session.setUser(user);
	return user;
}

async function expectPlatformDenied(promise: Promise<unknown>): Promise<void> {
	await expect(promise).rejects.toBeInstanceOf(ApiError);
	await expect(promise).rejects.toMatchObject({
		code: 'forbidden',
		status: 403,
		message: PLATFORM_DENIED_MESSAGE
	});
}

const CREATE_INPUT: CreateTenantInput = {
	legalName: 'Marlow Atelier Ltd',
	slug: 'marlow-atelier',
	displayName: 'Marlow Atelier',
	accent: '#336655',
	defaultCurrency: 'EUR',
	vatNumber: 'GB123456789',
	referencePattern: 'MAR-{YYYY}-{NNNN}',
	emailDomain: 'marlowatelier.co.uk',
	adminEmail: 'jane.doe@marlowatelier.co.uk'
};

function platformInvitations(email: string): UserInvitationRecord[] {
	return getCollection<UserInvitationRecord>(COLLECTIONS.userInvitations).filter(
		(invitation) => invitation.email === email
	);
}

beforeEach(() => {
	(globalThis as { localStorage?: Storage }).localStorage = createMemoryStorage();
	resetMockDb();
	// The auth seed owns these three collections; the platform seed owns the
	// audit stream. Install the shared demo world explicitly so this suite is
	// independent of whichever module seeders have loaded.
	setCollection(
		COLLECTIONS.tenants,
		DEMO_TENANTS.map((tenant) => ({ ...tenant }))
	);
	setCollection(
		COLLECTIONS.appUsers,
		DEMO_USERS.map((user) => ({ ...user }))
	);
	setCollection(COLLECTIONS.userInvitations, [{ ...DEMO_INVITATION }]);
});

afterEach(() => {
	session.clearSession();
	delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('platform server-side authorisation (phase gate)', () => {
	it('denies every platform method to a tenant session with 403 forbidden', async () => {
		signIn('sales@opulentinteriors.co.uk');

		await expectPlatformDenied(mockListTenants({}));
		await expectPlatformDenied(mockGetTenant(OPULENT.id));
		await expectPlatformDenied(mockCreateTenant(CREATE_INPUT));
		await expectPlatformDenied(
			mockTransitionTenant(OPULENT.id, { to: 'suspended', reason: 'Denial probe' })
		);
		await expectPlatformDenied(mockListPlatformAudit({}));
	});

	it('denies a platform user who lacks the tenant scope', async () => {
		const platformUser = signIn('platform@interio.app');
		session.setUser({ ...platformUser, permissions: [] });

		await expectPlatformDenied(mockListTenants({}));
		await expectPlatformDenied(mockListPlatformAudit({}));
	});

	it('rejects an anonymous call with 401 unauthorized', async () => {
		await expect(mockListTenants({})).rejects.toMatchObject({
			code: 'unauthorized',
			status: 401
		});
	});
});

describe('mockListTenants', () => {
	beforeEach(() => {
		signIn('platform@interio.app');
	});

	it('lists all seeded tenants sorted by legal name with active user counts', async () => {
		const page = await mockListTenants({});

		expect(page.total).toBe(DEMO_TENANTS.length);
		expect(page.page).toBe(1);
		expect(page.pageSize).toBe(25);
		expect(page.items.map((row) => row.legalName)).toEqual(
			[...DEMO_TENANTS]
				.map((tenant) => tenant.legalName)
				.sort((a, b) => a.localeCompare(b, 'en-GB'))
		);

		const opulent = page.items.find((row) => row.id === OPULENT.id);
		expect(opulent?.userCount).toBe(
			DEMO_USERS.filter((user) => user.tenantId === OPULENT.id && user.status === 'active').length
		);
	});

	it('filters by search across legal name, display name and slug', async () => {
		const byName = await mockListTenants({ search: 'Harbour' });
		expect(byName.items.map((row) => row.id)).toEqual([HARBOUR.id]);

		const bySlug = await mockListTenants({ search: 'northgate' });
		expect(bySlug.items.map((row) => row.id)).toEqual([NORTHGATE.id]);

		const none = await mockListTenants({ search: 'no-such-studio' });
		expect(none.total).toBe(0);
		expect(none.items).toEqual([]);
	});

	it('filters by tenant status and paginates', async () => {
		const suspended = await mockListTenants({ status: 'suspended' });
		expect(suspended.items.map((row) => row.id)).toEqual([NORTHGATE.id]);

		const active = await mockListTenants({ status: 'active' });
		expect(active.items.map((row) => row.id)).toEqual([HARBOUR.id, OPULENT.id]);

		const firstPage = await mockListTenants({ page: 1, pageSize: 2 });
		const secondPage = await mockListTenants({ page: 2, pageSize: 2 });
		expect(firstPage.items).toHaveLength(2);
		expect(firstPage.totalPages).toBe(2);
		expect(secondPage.items).toHaveLength(1);
		expect(secondPage.items[0]?.id).toBe(OPULENT.id);
	});
});

describe('mockGetTenant', () => {
	beforeEach(() => {
		signIn('platform@interio.app');
	});

	it('returns the tenant configuration and its five most recent audit rows', async () => {
		const detail = await mockGetTenant(OPULENT.id);

		expect(detail).toMatchObject({
			id: OPULENT.id,
			slug: 'opulent',
			status: 'active',
			defaultCurrency: 'GBP',
			emailDomain: 'opulentinteriors.co.uk',
			branding: OPULENT.branding
		});
		expect(detail.recentAudit).toHaveLength(1);
		expect(detail.recentAudit[0]).toMatchObject({
			action: 'tenant.created',
			subjectTenantId: OPULENT.id,
			subjectTenantName: OPULENT.displayName
		});
	});

	it('returns 404 for an unknown tenant id', async () => {
		await expect(mockGetTenant('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});
	});
});

describe('mockCreateTenant', () => {
	beforeEach(() => {
		signIn('platform@interio.app');
	});

	it('creates an active tenant, a first-admin invitation and an audit row', async () => {
		const created = await mockCreateTenant(CREATE_INPUT);

		expect(created).toMatchObject({
			slug: 'marlow-atelier',
			legalName: 'Marlow Atelier Ltd',
			displayName: 'Marlow Atelier',
			status: 'active',
			userCount: 0,
			branding: { accent: '#336655' },
			defaultCurrency: 'EUR',
			vatNumber: 'GB123456789',
			referencePattern: 'MAR-{YYYY}-{NNNN}',
			emailDomain: 'marlowatelier.co.uk'
		});
		expect(created.recentAudit[0]).toMatchObject({
			action: 'tenant.created',
			actorEmail: 'platform@interio.app',
			subjectTenantId: created.id,
			payload: { slug: 'marlow-atelier', adminEmail: 'jane.doe@marlowatelier.co.uk' }
		});

		const tenants = getCollection(COLLECTIONS.tenants);
		expect(tenants).toHaveLength(DEMO_TENANTS.length + 1);

		const [invitation] = platformInvitations('jane.doe@marlowatelier.co.uk');
		expect(invitation).toMatchObject({
			tenantId: created.id,
			displayName: 'Jane Doe',
			role: 'system_admin',
			acceptedAt: null
		});
		expect(invitation?.token).toBeTruthy();
		expect(new Date(invitation?.expiresAt ?? '').getTime() - demoNow().getTime()).toBe(14 * DAY_MS);
	});

	it('falls back to the legal name when no display name is given', async () => {
		const created = await mockCreateTenant({
			...CREATE_INPUT,
			slug: 'legal-name-only',
			displayName: undefined,
			accent: undefined,
			emailDomain: undefined
		});

		expect(created.displayName).toBe('Marlow Atelier Ltd');
		expect(created.branding).toBeNull();
		expect(created.emailDomain).toBeNull();
	});

	it('rejects a duplicate slug with 409 conflict', async () => {
		await expect(mockCreateTenant({ ...CREATE_INPUT, slug: 'opulent' })).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: 'That slug is already in use.'
		});
	});

	it('rejects a duplicate email domain with 409 conflict', async () => {
		await expect(
			mockCreateTenant({ ...CREATE_INPUT, emailDomain: 'OpulentInteriors.co.uk' })
		).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: 'That email domain is already in use.'
		});
	});

	it('rejects invalid input with 400 validation and field errors', async () => {
		await expect(
			mockCreateTenant({ ...CREATE_INPUT, slug: 'Not A Slug', adminEmail: 'not-an-email' })
		).rejects.toMatchObject({
			code: 'validation',
			status: 400,
			fieldErrors: {
				slug: 'Use lowercase letters, numbers and hyphens.',
				adminEmail: 'Enter a valid email address.'
			}
		});
	});
});

describe('mockTransitionTenant', () => {
	beforeEach(() => {
		signIn('platform@interio.app');
	});

	it('suspends and reactivates a tenant, auditing both transitions', async () => {
		const suspended = await mockTransitionTenant(OPULENT.id, {
			to: 'suspended',
			reason: 'Unpaid invoices'
		});
		expect(suspended.status).toBe('suspended');
		expect(suspended.recentAudit[0]).toMatchObject({
			action: 'tenant.suspended',
			payload: { reason: 'Unpaid invoices' }
		});

		const reactivated = await mockTransitionTenant(OPULENT.id, {
			to: 'active',
			reason: 'Payment received'
		});
		expect(reactivated.status).toBe('active');
		expect(reactivated.recentAudit[0]).toMatchObject({
			action: 'tenant.reactivated',
			payload: { reason: 'Payment received' }
		});
	});

	it('rejects a same-state transition with 409 conflict', async () => {
		await expect(
			mockTransitionTenant(NORTHGATE.id, { to: 'suspended', reason: 'Still suspended' })
		).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: 'This tenant is already suspended.'
		});
	});

	it('treats offboarded as terminal', async () => {
		const offboarded = await mockTransitionTenant(HARBOUR.id, {
			to: 'offboarded',
			reason: 'Contract ended'
		});
		expect(offboarded.status).toBe('offboarded');

		await expect(
			mockTransitionTenant(HARBOUR.id, { to: 'active', reason: 'Try to reactivate' })
		).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: 'This tenant is offboarded and cannot change state.'
		});
	});

	it('requires a reason of at least three characters to suspend or offboard', async () => {
		await expect(
			mockTransitionTenant(OPULENT.id, { to: 'suspended', reason: '  ' })
		).rejects.toMatchObject({ code: 'validation', status: 400 });

		await expect(
			mockTransitionTenant(OPULENT.id, { to: 'offboarded', reason: 'no' })
		).rejects.toMatchObject({ code: 'validation', status: 400 });
	});
});

describe('mockListPlatformAudit', () => {
	beforeEach(() => {
		signIn('platform@interio.app');
	});

	it('lists the seeded audit stream newest first', async () => {
		const page = await mockListPlatformAudit({});

		expect(page.total).toBe(4);
		const timestamps = page.items.map((row) => row.occurredAt);
		expect([...timestamps].sort((a, b) => b.localeCompare(a))).toEqual(timestamps);
		expect(page.items.map((row) => row.action)).toContain('tenant.suspended');
	});

	it('filters by tenant, search and payload subject name', async () => {
		const byTenant = await mockListPlatformAudit({ tenantId: NORTHGATE.id });
		expect(byTenant.total).toBe(1);
		expect(byTenant.items[0]).toMatchObject({
			action: 'tenant.suspended',
			subjectTenantName: NORTHGATE.displayName,
			payload: { reason: 'Unpaid invoices' }
		});

		const byAction = await mockListPlatformAudit({ search: 'suspended' });
		expect(byAction.items.map((row) => row.action)).toEqual(['tenant.suspended']);

		const byActor = await mockListPlatformAudit({ search: 'platform@interio.app' });
		expect(byActor.total).toBe(4);

		const byName = await mockListPlatformAudit({ search: 'Opulent' });
		expect(byName.items.map((row) => row.subjectTenantId)).toEqual([OPULENT.id]);
	});

	it('includes newly created tenants and paginates the stream', async () => {
		await mockCreateTenant(CREATE_INPUT);

		const page = await mockListPlatformAudit({ pageSize: 2 });
		expect(page.total).toBe(5);
		expect(page.totalPages).toBe(3);
		expect(page.items).toHaveLength(2);
		expect(page.items[0]?.action).toBe('tenant.created');
		expect(page.items[0]?.payload).toMatchObject({ slug: 'marlow-atelier' });
	});
});
