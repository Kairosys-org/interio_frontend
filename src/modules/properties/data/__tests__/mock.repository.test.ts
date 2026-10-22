import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));

import { session } from '$shared/application/session';
import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import {
	DEMO_CUSTOMER_PLAN,
	DEMO_PROJECT_PLAN,
	demoCustomerId,
	demoProjectId,
	demoPropertyId
} from '$shared/data/demo-record-plan';
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
import { ApiError, isApiError } from '$network/errors';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import type { CreatePropertyInput } from '../../domain/types';
import {
	mockArchiveProperty,
	mockAuditProperty,
	mockCreateProperty,
	mockGetProperty,
	mockListProperties,
	mockReviewPropertyDedup,
	mockUnarchiveProperty,
	mockUpdateProperty
} from '../mock';

/**
 * Property mock-server tests. The harness mirrors the platform suite: an
 * in-memory `Storage`, the shared demo tenants/users installed explicitly and
 * a Sales session unless a test needs another role.
 */

const OPULENT = DEMO_TENANTS[0];

const DUPLICATE_INPUT: CreatePropertyInput = {
	customerId: demoCustomerId(2),
	addressLine1: '1 Oak Street',
	addressLine2: null,
	town: 'Richmond',
	postcode: 'tw9 1aa',
	accessNotes: null
};

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
		this.rows.set(key, String(value));
	}
}

function installStorage(): void {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		writable: true,
		value: new MemoryStorage()
	});
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

function customerRecords(): CustomerRecord[] {
	return DEMO_CUSTOMER_PLAN.map((plan) => ({
		id: demoCustomerId(plan.n),
		tenantId: OPULENT.id,
		caption: plan.caption,
		contactName: plan.contactName,
		email: plan.email,
		phone: plan.phone,
		addressLine1: null,
		addressLine2: null,
		town: plan.town,
		postcode: plan.postcode,
		preferredChannel: plan.preferredChannel,
		source: 'survey',
		leadUuid: null,
		state: plan.duplicateOf ? 'pending_review' : 'active',
		dedupOfId: plan.duplicateOf ? demoCustomerId(plan.duplicateOf) : null,
		reviewNote: null,
		createdAt: demoDays(200),
		updatedAt: demoDays(100),
		createdBy: null,
		archivedAt: null
	}));
}

function projectRecords(): ProjectRecord[] {
	return DEMO_PROJECT_PLAN.map((plan) => ({
		id: demoProjectId(plan.n),
		tenantId: OPULENT.id,
		customerId: demoCustomerId(plan.customerN),
		propertyId: demoPropertyId(plan.propertyN),
		caption: plan.caption,
		reference: plan.reference,
		projectType: plan.projectType as ProjectRecord['projectType'],
		status: plan.status as ProjectRecord['status'],
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(90 - plan.n),
		updatedAt: demoDays(10),
		createdBy: null,
		archivedAt: null
	}));
}

function installDemoWorld(): void {
	setCollection(
		COLLECTIONS.tenants,
		DEMO_TENANTS.map((tenant) => ({ ...tenant }))
	);
	setCollection(
		COLLECTIONS.appUsers,
		DEMO_USERS.map((user) => ({ ...user }))
	);
	setCollection(COLLECTIONS.customers, customerRecords());
	setCollection(COLLECTIONS.projects, projectRecords());
}

async function expectConflict(operation: Promise<unknown>): Promise<ApiError> {
	try {
		await operation;
	} catch (error) {
		expect(isApiError(error)).toBe(true);
		const apiError = error as ApiError;
		expect(apiError.code).toBe('conflict');
		expect(apiError.status).toBe(409);
		return apiError;
	}
	throw new Error('Expected the operation to conflict, but it resolved.');
}

interface HeldDetails {
	entityType: string;
	heldId: string;
	candidates: Array<{
		id: string;
		entityType: string;
		caption: string;
		matchReasons: string[];
	}>;
}

async function createHeldProperty(): Promise<HeldDetails> {
	const error = await expectConflict(mockCreateProperty(DUPLICATE_INPUT));
	const details = error.details as HeldDetails;
	expect(details.entityType).toBe('property');
	expect(isUuid(details.heldId)).toBe(true);
	return details;
}

function heldRecord(heldId: string): PropertyRecord | undefined {
	return getCollection<PropertyRecord>(COLLECTIONS.properties).find((row) => row.id === heldId);
}

beforeEach(() => {
	installStorage();
	resetMockDb();
	installDemoWorld();
});

afterEach(() => {
	session.clearSession();
	delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('property seed', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('seeds exactly 40 deterministic properties, one archived', async () => {
		const page = await mockListProperties({ pageSize: 100 });
		const properties = getCollection<PropertyRecord>(COLLECTIONS.properties);
		const archived = properties.filter((property) => property.state === 'archived');

		expect(page.total).toBe(40);
		expect(properties).toHaveLength(40);
		expect(archived).toHaveLength(1);
		expect(archived[0]?.id).toBe(demoPropertyId(40));
		expect(archived[0]?.archivedAt).not.toBeNull();
		expect(properties.every((property) => property.tenantId === OPULENT.id)).toBe(true);
		expect(new Set(properties.map((property) => property.id)).size).toBe(40);
		expect(properties.every((property) => isUuid(property.id))).toBe(true);
	});

	it('gives property 1 a long access note and property 2 empty optionals', async () => {
		const first = await mockGetProperty(demoPropertyId(1));
		const second = await mockGetProperty(demoPropertyId(2));

		expect((first.property.accessNotes ?? '').length).toBeGreaterThan(400);
		expect(second.property.addressLine2).toBeNull();
		expect(second.property.accessNotes).toBeNull();
	});
});

describe('mockListProperties', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('joins the customer caption and searches across address and customer', async () => {
		const byCustomer = await mockListProperties({ search: 'A. Smith' });
		expect(byCustomer.total).toBe(2);
		expect(byCustomer.items.every((row) => row.customerCaption === 'A. Smith')).toBe(true);

		const byStreet = await mockListProperties({ search: 'oak street' });
		expect(byStreet.total).toBe(4);
		expect(
			byStreet.items.every((row) => row.addressLine1.toLowerCase().includes('oak street'))
		).toBe(true);

		const byPostcode = await mockListProperties({ search: 'TW9 1AA' });
		expect(byPostcode.items.every((row) => row.postcode === 'TW9 1AA')).toBe(true);
		expect(byPostcode.total).toBe(5);
	});

	it('filters by customer, state and sorts with a stable fallback', async () => {
		const forCustomer = await mockListProperties({ customerId: demoCustomerId(2) });
		expect(forCustomer.total).toBe(2);
		expect(forCustomer.items.every((row) => row.customerId === demoCustomerId(2))).toBe(true);

		const archived = await mockListProperties({ state: 'archived' });
		expect(archived.items.map((row) => row.id)).toEqual([demoPropertyId(40)]);

		const byAddress = await mockListProperties({ sort: 'addressLine1', sortDir: 'asc' });
		const addresses = byAddress.items.map((row) => row.addressLine1);
		expect(
			[...addresses].sort((first, second) =>
				first.localeCompare(second, 'en-GB', { numeric: true })
			)
		).toEqual(addresses);
	});

	it('paginates newest-created first by default', async () => {
		const firstPage = await mockListProperties({ page: 1, pageSize: 10 });
		const secondPage = await mockListProperties({ page: 2, pageSize: 10 });

		expect(firstPage.total).toBe(40);
		expect(firstPage.totalPages).toBe(4);
		expect(firstPage.items).toHaveLength(10);
		expect(firstPage.items[0]?.id).toBe(demoPropertyId(1));
		expect(secondPage.page).toBe(2);
		expect(secondPage.items[0]?.id).toBe(demoPropertyId(11));
	});

	it('renders a missing customer as Unknown customer instead of throwing', async () => {
		setCollection(
			COLLECTIONS.customers,
			customerRecords().filter((customer) => customer.id !== demoCustomerId(1))
		);

		const page = await mockListProperties({ pageSize: 100 });
		const orphaned = page.items.filter((row) => row.customerId === demoCustomerId(1));

		expect(orphaned).toHaveLength(2);
		expect(orphaned.every((row) => row.customerCaption === 'Unknown customer')).toBe(true);
	});
});

describe('mockGetProperty', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('returns the customer summary and projects joined by property id', async () => {
		const detail = await mockGetProperty(demoPropertyId(1));

		expect(detail.property.id).toBe(demoPropertyId(1));
		expect(detail.customer).toMatchObject({
			id: demoCustomerId(1),
			caption: 'A. Smith',
			email: 'alice.smith@example.com',
			phone: '020 7946 0101',
			state: 'active'
		});
		expect(detail.projects).toHaveLength(1);
		expect(detail.projects[0]).toMatchObject({
			id: demoProjectId(1),
			caption: 'Kitchen renovation',
			reference: 'OIG-2026-0001',
			projectType: 'kitchen',
			status: 'active'
		});

		const other = await mockGetProperty(demoPropertyId(2));
		expect(other.projects.map((project) => project.id)).toEqual([demoProjectId(2)]);
	});

	it('returns 404 for an unknown id and a null customer when the row is gone', async () => {
		await expect(mockGetProperty('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});

		setCollection(
			COLLECTIONS.customers,
			customerRecords().filter((customer) => customer.id !== demoCustomerId(1))
		);
		const detail = await mockGetProperty(demoPropertyId(1));
		expect(detail.customer).toBeNull();
	});
});

describe('tenant isolation', () => {
	it('shows no Opulent properties to a Harbour session and 404s cross-tenant reads', async () => {
		signIn('owner@harbourfinch.co.uk');

		const page = await mockListProperties({});
		expect(page.total).toBe(0);
		expect(page.items).toEqual([]);

		await expect(mockGetProperty(demoPropertyId(1))).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});

		await expect(
			mockCreateProperty({
				customerId: demoCustomerId(1),
				addressLine1: '1 Harbour Street',
				addressLine2: null,
				town: 'Poole',
				postcode: 'BH15 1AA',
				accessNotes: null
			})
		).rejects.toMatchObject({ code: 'validation', status: 400 });
	});
});

describe('mockCreateProperty', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('normalises the address and creates an active property', async () => {
		const created = await mockCreateProperty({
			customerId: demoCustomerId(3),
			addressLine1: '  99   New    Street ',
			addressLine2: ' Flat  3 ',
			town: '  Richmond ',
			postcode: ' sw1a  1aa ',
			accessNotes: '  Ring the bell.  '
		});

		expect(created).toMatchObject({
			tenantId: OPULENT.id,
			customerId: demoCustomerId(3),
			addressLine1: '99 New Street',
			addressLine2: 'Flat 3',
			town: 'Richmond',
			postcode: 'SW1A 1AA',
			accessNotes: 'Ring the bell.',
			state: 'active',
			dedupOfId: null,
			archivedAt: null
		});
		expect(isUuid(created.id)).toBe(true);
		expect(heldRecord(created.id)?.state).toBe('active');
	});

	it('rejects a customer that is not in the tenant with 400 validation', async () => {
		await expect(
			mockCreateProperty({
				...DUPLICATE_INPUT,
				customerId: '00000000-0000-4000-8000-000000000000'
			})
		).rejects.toMatchObject({
			code: 'validation',
			status: 400,
			fieldErrors: { customerId: 'Choose an active customer for this property.' }
		});
	});

	it('holds a duplicate as pending_review, audits it and returns 409 details', async () => {
		const details = await createHeldProperty();
		const held = heldRecord(details.heldId);

		expect(held?.state).toBe('pending_review');
		expect(held?.dedupOfId).toBe(demoPropertyId(1));
		expect(details.candidates[0]).toMatchObject({
			id: demoPropertyId(1),
			entityType: 'property',
			caption: '1 Oak Street',
			matchReasons: ['Postcode matches', 'Address line 1 matches']
		});

		const audit = await mockAuditProperty(details.heldId);
		expect(audit[0]).toMatchObject({ action: 'create', payload: { held: true } });
	});
});

describe('dedup review', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('requires a note for confirm_distinct and then reactivates the row', async () => {
		const details = await createHeldProperty();

		await expect(
			mockReviewPropertyDedup(details.heldId, {
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: '   '
			})
		).rejects.toMatchObject({
			code: 'validation',
			status: 400,
			fieldErrors: { reviewNote: DEDUP_NOTE_REQUIRED }
		});

		const reviewed = await mockReviewPropertyDedup(details.heldId, {
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: ' A separate property at the same address. '
		});

		expect(reviewed.state).toBe('active');
		expect(reviewed.dedupOfId).toBeNull();
		expect(reviewed.reviewNote).toBe('A separate property at the same address.');

		const audit = await mockAuditProperty(details.heldId);
		expect(audit.map((row) => row.action)).toContain('dedup_review');
	});

	it('links to an existing property, cancels the held row and blocks a repeat review', async () => {
		const details = await createHeldProperty();

		const reviewed = await mockReviewPropertyDedup(details.heldId, {
			decision: 'link_to_existing',
			targetId: demoPropertyId(1),
			reviewNote: ''
		});

		expect(reviewed.state).toBe('cancelled');
		expect(reviewed.dedupOfId).toBe(demoPropertyId(1));

		await expect(
			mockReviewPropertyDedup(details.heldId, {
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: 'Try again.'
			})
		).rejects.toMatchObject({ code: 'conflict', status: 409, message: DEDUP_ALREADY_REVIEWED });
	});

	it('rejects a link target outside the tenant', async () => {
		const details = await createHeldProperty();

		await expect(
			mockReviewPropertyDedup(details.heldId, {
				decision: 'link_to_existing',
				targetId: '00000000-0000-4000-8000-000000000000',
				reviewNote: ''
			})
		).rejects.toMatchObject({ code: 'validation', status: 400 });
	});
});

describe('mockUpdateProperty', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('normalises the changed fields and audits them', async () => {
		const updated = await mockUpdateProperty(demoPropertyId(2), {
			town: '  New    Town ',
			accessNotes: '  Leave keys with the neighbour. '
		});

		expect(updated.town).toBe('New Town');
		expect(updated.accessNotes).toBe('Leave keys with the neighbour.');

		const audit = await mockAuditProperty(demoPropertyId(2));
		expect(audit[0]).toMatchObject({
			action: 'update',
			payload: { fields: ['town', 'accessNotes'] }
		});
	});

	it('blocks editing a pending_review or archived property with 409', async () => {
		const details = await createHeldProperty();

		await expect(mockUpdateProperty(details.heldId, { town: 'Ealing' })).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: 'This property is awaiting duplicate review and cannot be edited.'
		});

		await expect(mockUpdateProperty(demoPropertyId(40), { town: 'Ealing' })).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: 'This property is archived. Unarchive it before editing.'
		});
	});
});

describe('archive and unarchive', () => {
	beforeEach(() => {
		signIn('owner@opulentinteriors.co.uk');
	});

	it('archives and restores a property, auditing both moves', async () => {
		const archived = await mockArchiveProperty(demoPropertyId(2));
		expect(archived.state).toBe('archived');
		expect(archived.archivedAt).not.toBeNull();

		const archivedList = await mockListProperties({ state: 'archived' });
		expect(archivedList.items.map((row) => row.id)).toEqual([
			demoPropertyId(2),
			demoPropertyId(40)
		]);

		const restored = await mockUnarchiveProperty(demoPropertyId(2));
		expect(restored.state).toBe('active');
		expect(restored.archivedAt).toBeNull();

		const audit = await mockAuditProperty(demoPropertyId(2));
		expect(audit.map((row) => row.action)).toEqual(
			expect.arrayContaining(['archive', 'unarchive'])
		);
	});

	it('blocks archiving a held duplicate or an already archived row', async () => {
		const details = await createHeldProperty();

		await expect(mockArchiveProperty(details.heldId)).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: 'Review the duplicate match before archiving this property.'
		});
		await expect(mockArchiveProperty(demoPropertyId(40))).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: 'This property is already archived.'
		});
	});

	it('denies archive to a Sales session', async () => {
		signIn('sales@opulentinteriors.co.uk');
		await expect(mockArchiveProperty(demoPropertyId(2))).rejects.toMatchObject({
			code: 'forbidden',
			status: 403
		});
	});
});

describe('determinism', () => {
	it('produces identical seed rows after two resets', async () => {
		signIn('sales@opulentinteriors.co.uk');

		const snapshot = async () => {
			resetMockDb();
			installDemoWorld();
			const page = await mockListProperties({ pageSize: 100 });
			return page.items;
		};

		expect(await snapshot()).toEqual(await snapshot());
	});
});
