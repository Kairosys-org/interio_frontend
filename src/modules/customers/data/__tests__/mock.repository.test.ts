import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));

import { session } from '$shared/application/session';
import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import { demoCustomerId, demoProjectId, demoPropertyId } from '$shared/data/demo-record-plan';
import { DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import type {
	AppUserRecord,
	CustomerRecord,
	ProjectRecord,
	PropertyRecord
} from '$shared/data/records';
import { DEDUP_ALREADY_REVIEWED, DEDUP_NOTE_REQUIRED } from '$shared/domain/dedup';
import { isUuid } from '$shared/domain/uuid';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { ApiError } from '$network/errors';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import type { CreateCustomerInput, CustomerDedupConflict } from '../../domain/types';
import {
	mockArchiveCustomer,
	mockCreateCustomer,
	mockGetCustomer,
	mockListCustomerAudit,
	mockListCustomers,
	mockReviewCustomerDedup,
	mockUnarchiveCustomer,
	mockUpdateCustomer
} from '../mock';

const OPULENT = DEMO_TENANTS[0];
const HARBOUR = DEMO_TENANTS[1];
const OWNER = 'owner@opulentinteriors.co.uk';
const SALES = 'sales@opulentinteriors.co.uk';
const HARBOUR_OWNER = 'owner@harbourfinch.co.uk';

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

function createInput(overrides: Partial<CreateCustomerInput> = {}): CreateCustomerInput {
	return {
		caption: 'Bramble Cottage',
		contactName: null,
		email: null,
		phone: null,
		addressLine1: null,
		addressLine2: null,
		town: null,
		postcode: null,
		preferredChannel: 'email',
		...overrides
	};
}

const PROPERTY_FIXTURES: PropertyRecord[] = [
	{
		id: demoPropertyId(1),
		tenantId: OPULENT.id,
		customerId: demoCustomerId(1),
		addressLine1: '1 Oak Street',
		addressLine2: null,
		town: 'Richmond',
		postcode: 'TW9 1AA',
		accessNotes: null,
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(300),
		updatedAt: demoDays(299),
		createdBy: null,
		archivedAt: null
	},
	{
		id: demoPropertyId(2),
		tenantId: OPULENT.id,
		customerId: demoCustomerId(1),
		addressLine1: '2 Elm Road',
		addressLine2: 'Flat 2',
		town: 'Richmond',
		postcode: 'TW9 1AB',
		accessNotes: null,
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(280),
		updatedAt: demoDays(279),
		createdBy: null,
		archivedAt: null
	},
	{
		id: demoPropertyId(3),
		tenantId: OPULENT.id,
		customerId: demoCustomerId(2),
		addressLine1: '3 Cedar Avenue',
		addressLine2: null,
		town: 'Wimbledon',
		postcode: 'SW19 2BB',
		accessNotes: null,
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(270),
		updatedAt: demoDays(269),
		createdBy: null,
		archivedAt: null
	}
];

const PROJECT_FIXTURES: ProjectRecord[] = [
	{
		id: demoProjectId(1),
		tenantId: OPULENT.id,
		customerId: demoCustomerId(1),
		propertyId: demoPropertyId(1),
		caption: 'Kitchen renovation',
		reference: 'OIG-2026-0001',
		projectType: 'kitchen',
		status: 'active',
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(250),
		updatedAt: demoDays(249),
		createdBy: null,
		archivedAt: null
	},
	{
		id: demoProjectId(2),
		tenantId: OPULENT.id,
		customerId: demoCustomerId(2),
		propertyId: demoPropertyId(3),
		caption: 'Principal bedroom',
		reference: 'OIG-2026-0002',
		projectType: 'bedroom',
		status: 'on_hold',
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(240),
		updatedAt: demoDays(239),
		createdBy: null,
		archivedAt: null
	}
];

/** Creates a live duplicate of customer 1 and returns its held id. */
async function createHeldCustomer(): Promise<string> {
	const error = await mockCreateCustomer(
		createInput({ caption: 'A. Smith', postcode: 'TW9 1AA' })
	).catch((cause: unknown) => cause);

	expect(error).toBeInstanceOf(ApiError);
	const details = (error as ApiError).details as CustomerDedupConflict | undefined;
	if (!details) throw new Error('Expected duplicate details on the conflict.');
	return details.heldId;
}

beforeEach(() => {
	(globalThis as { localStorage?: Storage }).localStorage = createMemoryStorage();
	resetMockDb();
	// Tenants and users are owned by the auth seed; the customer seeder is
	// registered by `../mock`. Install the shared demo world explicitly.
	setCollection(
		COLLECTIONS.tenants,
		DEMO_TENANTS.map((tenant) => ({ ...tenant }))
	);
	setCollection(
		COLLECTIONS.appUsers,
		DEMO_USERS.map((user) => ({ ...user }))
	);
	setCollection(
		COLLECTIONS.properties,
		PROPERTY_FIXTURES.map((property) => ({ ...property }))
	);
	setCollection(
		COLLECTIONS.projects,
		PROJECT_FIXTURES.map((project) => ({ ...project }))
	);
	signIn(OWNER);
});

afterEach(() => {
	session.clearSession();
	delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('customer seed', () => {
	it('seeds 24 customers with two held duplicates and one archived row', async () => {
		const page = await mockListCustomers({ pageSize: 100 });

		expect(page.total).toBe(24);
		expect(page.items.every((row) => isUuid(row.id))).toBe(true);

		const records = getCollection<CustomerRecord>(COLLECTIONS.customers);
		expect(records).toHaveLength(24);
		expect(records.filter((row) => row.tenantId === OPULENT.id)).toHaveLength(24);
		expect(records.filter((row) => row.state === 'pending_review')).toHaveLength(2);
		expect(records.filter((row) => row.state === 'archived')).toHaveLength(1);
		expect(records.filter((row) => row.state === 'active')).toHaveLength(21);

		const held = records.filter((row) => row.state === 'pending_review');
		expect(held.map((row) => row.dedupOfId).sort()).toEqual([demoCustomerId(1), demoCustomerId(2)]);

		const archived = records.find((row) => row.state === 'archived');
		expect(archived?.id).toBe(demoCustomerId(22));
		expect(archived?.archivedAt).not.toBeNull();
	});

	it('produces byte-identical customers after reset and reseed', () => {
		const first = JSON.stringify(getCollection(COLLECTIONS.customers));

		resetMockDb();
		const second = JSON.stringify(getCollection(COLLECTIONS.customers));

		expect(second).toBe(first);
	});
});

describe('mockListCustomers', () => {
	it('searches caption, contact name, email, phone and postcode case-insensitively', async () => {
		expect(
			(await mockListCustomers({ search: 'åKESSON' })).items.map((row) => row.caption)
		).toEqual(['Noah Åkesson']);
		expect((await mockListCustomers({ search: 'hartley' })).total).toBe(2);
		expect((await mockListCustomers({ search: '02079460101' })).total).toBe(2);
		expect((await mockListCustomers({ search: 'tw9 1aa' })).total).toBe(2);
		expect((await mockListCustomers({ search: 'no-such-customer' })).total).toBe(0);
	});

	it('filters by state, including the archived row', async () => {
		const pending = await mockListCustomers({ state: 'pending_review' });
		expect(pending.total).toBe(2);
		expect(pending.items.map((row) => row.id).sort()).toEqual([
			demoCustomerId(23),
			demoCustomerId(24)
		]);

		const archived = await mockListCustomers({ state: 'archived' });
		expect(archived.items.map((row) => row.id)).toEqual([demoCustomerId(22)]);

		const combined = await mockListCustomers({ state: 'archived', search: 'rossi' });
		expect(combined.total).toBe(1);

		expect((await mockListCustomers({ state: 'all' })).total).toBe(24);
	});

	it('sorts by caption, state and createdAt with a stable id tie-break', async () => {
		const byCaption = await mockListCustomers({
			sort: 'caption',
			sortDir: 'asc',
			pageSize: 100
		});
		const captions = byCaption.items.map((row) => row.caption);
		expect(captions).toEqual(
			[...captions].sort((first, second) => first.localeCompare(second, 'en-GB'))
		);

		const byState = await mockListCustomers({ sort: 'state', sortDir: 'asc', pageSize: 100 });
		const rank = (state: string) =>
			(['active', 'pending_review', 'archived', 'cancelled'] as string[]).indexOf(state);
		expect(byState.items.map((row) => rank(row.state))).toEqual(
			byState.items.map((row) => rank(row.state)).sort((first, second) => first - second)
		);

		const newestFirst = await mockListCustomers({ pageSize: 100 });
		expect(newestFirst.items[0]?.id).toBe(demoCustomerId(24));
		expect(newestFirst.items.at(-1)?.id).toBe(demoCustomerId(1));
	});

	it('paginates with the shared page shape', async () => {
		const second = await mockListCustomers({ page: 2, pageSize: 5 });

		expect(second.items).toHaveLength(5);
		expect(second.total).toBe(24);
		expect(second.page).toBe(2);
		expect(second.pageSize).toBe(5);
		expect(second.totalPages).toBe(5);
		expect(second.hasMore).toBe(true);

		const last = await mockListCustomers({ page: 5, pageSize: 5 });
		expect(last.items).toHaveLength(4);
		expect(last.hasMore).toBe(false);
	});
});

describe('tenant isolation', () => {
	it('shows no Opulent customers to Harbour and hides other tenants with 404', async () => {
		signIn(HARBOUR_OWNER);

		const page = await mockListCustomers({});
		expect(page.total).toBe(0);
		expect(page.items).toEqual([]);

		await expect(mockGetCustomer(demoCustomerId(1))).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});
		await expect(
			mockUpdateCustomer(demoCustomerId(1), { caption: 'Hijacked' })
		).rejects.toMatchObject({ code: 'not_found', status: 404 });
		await expect(mockArchiveCustomer(demoCustomerId(1))).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});
	});

	it('creates Harbour customers inside Harbour only', async () => {
		signIn(HARBOUR_OWNER);
		const created = await mockCreateCustomer(createInput({ caption: 'Harbour Only Customer' }));
		expect(created.tenantId).toBe(HARBOUR.id);

		signIn(OWNER);
		expect((await mockListCustomers({})).total).toBe(24);
	});
});

describe('mockGetCustomer', () => {
	it('returns the customer with property and project summaries from the shared collections', async () => {
		const detail = await mockGetCustomer(demoCustomerId(1));

		expect(detail.customer).toMatchObject({
			id: demoCustomerId(1),
			caption: 'A. Smith',
			email: 'alice.smith@example.com',
			phone: '02079460101',
			postcode: 'TW9 1AA',
			state: 'active'
		});
		expect(detail.properties.map((row) => row.id)).toEqual([demoPropertyId(1), demoPropertyId(2)]);
		expect(detail.projects.map((row) => row.id)).toEqual([demoProjectId(1)]);
		expect(detail.projects[0]).toMatchObject({
			reference: 'OIG-2026-0001',
			projectType: 'kitchen',
			status: 'active'
		});
	});

	it('returns 404 for an unknown id', async () => {
		await expect(mockGetCustomer('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});
	});
});

describe('mockCreateCustomer', () => {
	it('normalises caption, email, phone and postcode before storing', async () => {
		signIn(SALES);
		const created = await mockCreateCustomer(
			createInput({
				caption: '  Bramble   Cottage ',
				contactName: '  Nina   Bramble ',
				email: ' NINA@BrambleCottage.Example ',
				phone: '020 7946 0999',
				postcode: 'tw9 1aa',
				preferredChannel: 'email'
			})
		);

		expect(created).toMatchObject({
			caption: 'Bramble Cottage',
			contactName: 'Nina Bramble',
			email: 'nina@bramblecottage.example',
			phone: '02079460999',
			postcode: 'TW9 1AA',
			state: 'active',
			source: 'survey',
			dedupOfId: null,
			reviewNote: null,
			archivedAt: null,
			tenantId: OPULENT.id
		});
		expect(isUuid(created.id)).toBe(true);
		expect(created.createdBy).toBe(DEMO_USERS.find((user) => user.email === SALES)?.id);

		const audit = await mockListCustomerAudit(created.id);
		expect(audit.find((row) => row.action === 'create')?.payload).toMatchObject({ held: false });
	});

	it('rejects an empty caption with a 400 validation error', async () => {
		await expect(mockCreateCustomer(createInput({ caption: '   ' }))).rejects.toMatchObject({
			code: 'validation',
			status: 400,
			fieldErrors: { caption: 'Enter a customer caption.' }
		});
	});

	it('holds a duplicate as pending_review, persists it and returns 409 with candidates', async () => {
		const error = await mockCreateCustomer(
			createInput({ caption: '  a.  smith ', postcode: 'tw9 1aa' })
		).catch((cause: unknown) => cause);

		expect(error).toBeInstanceOf(ApiError);
		const apiError = error as ApiError;
		expect(apiError).toMatchObject({ code: 'conflict', status: 409 });
		expect(apiError.message).toContain('A. Smith');

		const details = apiError.details as CustomerDedupConflict;
		expect(details.entityType).toBe('customer');
		expect(isUuid(details.heldId)).toBe(true);
		expect(details.candidates[0]).toMatchObject({
			id: demoCustomerId(1),
			entityType: 'customer',
			caption: 'A. Smith'
		});
		expect(details.candidates[0]?.matchReasons).toContain('Postcode matches');

		const held = getCollection<CustomerRecord>(COLLECTIONS.customers).find(
			(row) => row.id === details.heldId
		);
		expect(held).toMatchObject({
			state: 'pending_review',
			dedupOfId: demoCustomerId(1),
			tenantId: OPULENT.id,
			caption: 'a. smith'
		});

		const audit = await mockListCustomerAudit(details.heldId);
		expect(audit.find((row) => row.action === 'create')?.payload).toMatchObject({ held: true });
	});
});

describe('mockReviewCustomerDedup', () => {
	it('requires a note to confirm the record is distinct', async () => {
		const heldId = await createHeldCustomer();

		await expect(
			mockReviewCustomerDedup(heldId, {
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: '   '
			})
		).rejects.toMatchObject({
			code: 'validation',
			status: 400,
			fieldErrors: { reviewNote: DEDUP_NOTE_REQUIRED }
		});

		const reviewed = await mockReviewCustomerDedup(heldId, {
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: '  Different branch of the family. '
		});
		expect(reviewed).toMatchObject({
			state: 'active',
			dedupOfId: null,
			reviewNote: 'Different branch of the family.'
		});

		const audit = await mockListCustomerAudit(heldId);
		expect(audit.find((row) => row.action === 'dedup_review')?.payload).toMatchObject({
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: 'Different branch of the family.'
		});

		await expect(
			mockReviewCustomerDedup(heldId, {
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: 'Again'
			})
		).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: DEDUP_ALREADY_REVIEWED
		});
	});

	it('links a held row to an existing customer and cancels it', async () => {
		const heldId = await createHeldCustomer();

		const linked = await mockReviewCustomerDedup(heldId, {
			decision: 'link_to_existing',
			targetId: demoCustomerId(2),
			reviewNote: 'Same household.'
		});
		expect(linked).toMatchObject({
			state: 'cancelled',
			dedupOfId: demoCustomerId(2),
			reviewNote: 'Same household.'
		});

		const audit = await mockListCustomerAudit(heldId);
		expect(audit.find((row) => row.action === 'dedup_review')?.payload).toMatchObject({
			decision: 'link_to_existing',
			targetId: demoCustomerId(2),
			reviewNote: 'Same household.'
		});

		await expect(
			mockReviewCustomerDedup(heldId, {
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: 'Too late'
			})
		).rejects.toMatchObject({ code: 'conflict', status: 409 });
	});

	it('rejects self-linking and an unknown target', async () => {
		const heldId = await createHeldCustomer();

		await expect(
			mockReviewCustomerDedup(heldId, {
				decision: 'link_to_existing',
				targetId: heldId,
				reviewNote: ''
			})
		).rejects.toMatchObject({ code: 'validation', status: 400 });

		await expect(
			mockReviewCustomerDedup(heldId, {
				decision: 'link_to_existing',
				targetId: '00000000-0000-4000-8000-000000000000',
				reviewNote: ''
			})
		).rejects.toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('mockUpdateCustomer', () => {
	it('normalises changes and audits the changed field names', async () => {
		const updated = await mockUpdateCustomer(demoCustomerId(2), {
			caption: '  The   Hartley  Household ',
			email: ' JAMES.Hartley@Hartley.Example ',
			postcode: 'sw19 2bb'
		});

		expect(updated).toMatchObject({
			caption: 'The Hartley Household',
			email: 'james.hartley@hartley.example',
			postcode: 'SW19 2BB'
		});

		const audit = await mockListCustomerAudit(demoCustomerId(2));
		const row = audit.find((event) => event.action === 'update');
		expect(row?.payload).toMatchObject({
			changedFields: expect.arrayContaining(['caption', 'email'])
		});
	});

	it('blocks editing a held duplicate', async () => {
		const heldId = await createHeldCustomer();

		await expect(
			mockUpdateCustomer(heldId, { caption: 'Edited while held' })
		).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: 'Review this duplicate before editing it.'
		});
	});

	it('blocks editing an archived customer', async () => {
		await expect(mockUpdateCustomer(demoCustomerId(22), { caption: 'Nope' })).rejects.toMatchObject(
			{ code: 'conflict', status: 409 }
		);
	});
});

describe('archive and unarchive', () => {
	it('archives an active customer, audits it and restores it', async () => {
		const archived = await mockArchiveCustomer(demoCustomerId(1));
		expect(archived.state).toBe('archived');
		expect(archived.archivedAt).not.toBeNull();

		const archiveAudit = await mockListCustomerAudit(demoCustomerId(1));
		expect(archiveAudit.find((row) => row.action === 'archive')?.payload).toMatchObject({
			previousState: 'active'
		});

		const restored = await mockUnarchiveCustomer(demoCustomerId(1));
		expect(restored.state).toBe('active');
		expect(restored.archivedAt).toBeNull();

		const unarchiveAudit = await mockListCustomerAudit(demoCustomerId(1));
		expect(unarchiveAudit.some((row) => row.action === 'unarchive')).toBe(true);
	});

	it('blocks archiving a held or already archived customer', async () => {
		const heldId = await createHeldCustomer();

		await expect(mockArchiveCustomer(heldId)).rejects.toMatchObject({
			code: 'conflict',
			status: 409
		});
		await expect(mockArchiveCustomer(demoCustomerId(22))).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: 'This customer is already archived.'
		});
	});

	it('denies archive to a role without customer.archive', async () => {
		signIn(SALES);

		await expect(mockArchiveCustomer(demoCustomerId(1))).rejects.toMatchObject({
			code: 'forbidden',
			status: 403
		});
	});
});
