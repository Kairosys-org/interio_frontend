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
import {
	DEDUP_ALREADY_REVIEWED,
	DEDUP_NOTE_REQUIRED,
	DEDUP_TARGET_INVALID,
	DEDUP_TARGET_NOT_FOUND
} from '$shared/domain/dedup';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import type { DedupRecordView, DedupReviewRequest } from '../../domain/types';
import { mockDuplicatesRepository } from '../adapters/mock.repository';

// Register the records-spine seeders so the queue can read the real seeded world.
import '$modules/customers/data/mock';
import '$modules/properties/data/mock';
import '$modules/projects/data/mock';

const OPULENT = DEMO_TENANTS[0];
const SALES = 'sales@opulentinteriors.co.uk';
const DESIGNER = 'designer@opulentinteriors.co.uk';
const PURCHASING = 'purchasing@opulentinteriors.co.uk';
const HARBOUR_OWNER = 'owner@harbourfinch.co.uk';

const HELD_SMITH = demoCustomerId(23);
const HELD_HARTLEY = demoCustomerId(24);

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

function fieldValue(view: DedupRecordView, label: string): string {
	const field = view.fields.find((entry) => entry.label === label);
	if (!field) throw new Error(`Field ${label} is missing from the compare view.`);
	return field.value;
}

function customerFixture(id: string, overrides: Partial<CustomerRecord> = {}): CustomerRecord {
	return {
		id,
		tenantId: OPULENT.id,
		caption: 'Zeta Unique',
		contactName: 'Zeta Unique',
		email: 'zeta@unique.example',
		phone: '020 7946 0999',
		addressLine1: null,
		addressLine2: null,
		town: 'Richmond',
		postcode: 'TW9 1AA',
		preferredChannel: 'email',
		source: 'survey',
		leadUuid: null,
		state: 'pending_review',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(1),
		updatedAt: demoDays(1),
		createdBy: null,
		archivedAt: null,
		...overrides
	};
}

function propertyFixture(id: string, overrides: Partial<PropertyRecord> = {}): PropertyRecord {
	return {
		id,
		tenantId: OPULENT.id,
		customerId: demoCustomerId(1),
		addressLine1: '1 Oak Street',
		addressLine2: null,
		town: 'Richmond',
		postcode: 'TW9 1AA',
		accessNotes: null,
		state: 'pending_review',
		dedupOfId: demoPropertyId(1),
		reviewNote: null,
		createdAt: demoDays(1),
		updatedAt: demoDays(1),
		createdBy: null,
		archivedAt: null,
		...overrides
	};
}

function projectFixture(): ProjectRecord {
	const target = getCollection<ProjectRecord>(COLLECTIONS.projects).find(
		(row) => row.id === demoProjectId(1)
	);
	if (!target) throw new Error('Project 1 is missing from the seed.');
	return {
		...target,
		id: demoProjectId(99),
		state: 'pending_review',
		dedupOfId: target.id,
		reviewNote: null,
		createdAt: demoDays(1),
		updatedAt: demoDays(1)
	};
}

function findCustomer(id: string): CustomerRecord | undefined {
	return getCollection<CustomerRecord>(COLLECTIONS.customers).find((row) => row.id === id);
}

function findProperty(id: string): PropertyRecord | undefined {
	return getCollection<PropertyRecord>(COLLECTIONS.properties).find((row) => row.id === id);
}

function findProject(id: string): ProjectRecord | undefined {
	return getCollection<ProjectRecord>(COLLECTIONS.projects).find((row) => row.id === id);
}

beforeEach(() => {
	(globalThis as { localStorage?: Storage }).localStorage = createMemoryStorage();
	resetMockDb();
	// Tenants and users are owned by the auth seed, which these module mocks do
	// not register; install the shared demo world explicitly.
	setCollection(
		COLLECTIONS.tenants,
		DEMO_TENANTS.map((tenant) => ({ ...tenant }))
	);
	setCollection(
		COLLECTIONS.appUsers,
		DEMO_USERS.map((user) => ({ ...user }))
	);
	signIn(SALES);
});

afterEach(() => {
	session.clearSession();
	delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('mockListDedupQueue', () => {
	it('lists the two seeded held customers newest first', async () => {
		const queue = await mockDuplicatesRepository.list();

		expect(queue.map((item) => item.held.id)).toEqual([HELD_HARTLEY, HELD_SMITH]);
		expect(queue.every((item) => item.held.entityType === 'customer')).toBe(true);
		expect(queue.map((item) => item.held.state)).toEqual(['pending_review', 'pending_review']);
	});

	it('computes the same-tenant candidates and match reasons for each held row', async () => {
		const queue = await mockDuplicatesRepository.list();
		const hartley = queue.find((item) => item.held.id === HELD_HARTLEY);
		const smith = queue.find((item) => item.held.id === HELD_SMITH);

		expect(hartley?.candidates.map((candidate) => candidate.id)).toEqual([demoCustomerId(2)]);
		expect(hartley?.candidates[0]?.matchReasons).toEqual(['Postcode matches', 'Email matches']);
		expect(hartley?.candidates[0]?.entityType).toBe('customer');

		expect(smith?.candidates.map((candidate) => candidate.id)).toEqual([demoCustomerId(1)]);
		expect(smith?.candidates[0]?.matchReasons).toEqual(['Postcode matches', 'Phone matches']);

		// The held row is never its own candidate.
		for (const item of queue) {
			expect(item.candidates.some((candidate) => candidate.id === item.held.id)).toBe(false);
		}
	});

	it('renders every compared field with the fixed labels and an em dash for empty values', async () => {
		const queue = await mockDuplicatesRepository.list();
		const smith = queue.find((item) => item.held.id === HELD_SMITH);
		if (!smith) throw new Error('Expected the held A. Smith row in the queue.');

		expect(smith.held.fields.map((field) => field.label)).toEqual([
			'Caption',
			'Contact',
			'Email',
			'Phone',
			'Address',
			'Town',
			'Postcode',
			'Preferred channel',
			'State'
		]);
		expect(fieldValue(smith.held, 'Caption')).toBe('A. Smith');
		expect(fieldValue(smith.held, 'Contact')).toBe('Alice Smith');
		expect(fieldValue(smith.held, 'Email')).toBe('—');
		expect(fieldValue(smith.held, 'Address')).toBe('—');
		expect(fieldValue(smith.held, 'Postcode')).toBe('TW9 1AA');
		expect(fieldValue(smith.held, 'Preferred channel')).toBe('email');
		expect(fieldValue(smith.held, 'State')).toBe('pending_review');
	});

	it('includes held property and project rows with their own labels and candidates', async () => {
		const heldProperty = propertyFixture(demoPropertyId(90));
		const heldProject = projectFixture();
		setCollection(COLLECTIONS.properties, [
			...getCollection<PropertyRecord>(COLLECTIONS.properties),
			heldProperty
		]);
		setCollection(COLLECTIONS.projects, [
			...getCollection<ProjectRecord>(COLLECTIONS.projects),
			heldProject
		]);

		const queue = await mockDuplicatesRepository.list();

		const propertyItem = queue.find((item) => item.held.id === heldProperty.id);
		expect(propertyItem?.held.entityType).toBe('property');
		expect(propertyItem?.held.fields.map((field) => field.label)).toEqual([
			'Address line 1',
			'Address line 2',
			'Town',
			'Postcode',
			'Access notes',
			'State'
		]);
		expect(fieldValue(propertyItem!.held, 'Address line 2')).toBe('—');
		expect(propertyItem?.candidates.map((candidate) => candidate.id)).toContain(demoPropertyId(1));
		expect(propertyItem?.candidates[0]?.matchReasons).toEqual([
			'Postcode matches',
			'Address line 1 matches'
		]);

		const projectItem = queue.find((item) => item.held.id === heldProject.id);
		expect(projectItem?.held.entityType).toBe('project');
		expect(projectItem?.held.fields.map((field) => field.label)).toEqual([
			'Caption',
			'Reference',
			'Type',
			'Status',
			'Property',
			'State'
		]);
		expect(fieldValue(projectItem!.held, 'Property')).toContain('1 Oak Street');
		expect(projectItem?.candidates.map((candidate) => candidate.id)).toContain(demoProjectId(1));
		expect(projectItem?.candidates[0]?.matchReasons).toEqual([
			'Same property',
			'Same project type',
			'Caption matches'
		]);
	});

	it('keeps a held row with no candidate and ignores archived look-alikes', async () => {
		const orphan = customerFixture(demoCustomerId(90));
		const archivedLookAlike = customerFixture(demoCustomerId(91), {
			state: 'archived',
			dedupOfId: null,
			archivedAt: demoDays(2)
		});
		setCollection(COLLECTIONS.customers, [
			...getCollection<CustomerRecord>(COLLECTIONS.customers),
			orphan,
			archivedLookAlike
		]);

		const queue = await mockDuplicatesRepository.list();
		const item = queue.find((entry) => entry.held.id === orphan.id);

		expect(item).toBeDefined();
		expect(item?.candidates).toEqual([]);
	});

	it('is tenant-scoped: another tenant sees an empty queue', async () => {
		signIn(HARBOUR_OWNER);

		await expect(mockDuplicatesRepository.list()).resolves.toEqual([]);
		await expect(mockDuplicatesRepository.audit('customer', HELD_SMITH)).resolves.toEqual([]);
	});

	it('requires customer.view for the queue', async () => {
		signIn(PURCHASING);

		await expect(mockDuplicatesRepository.list()).rejects.toMatchObject({
			code: 'forbidden',
			status: 403
		});
	});
});

describe('mockReviewDedup - confirm_distinct', () => {
	it('requires a written note', async () => {
		await expect(
			mockDuplicatesRepository.review({
				entityType: 'customer',
				id: HELD_SMITH,
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: '   '
			})
		).rejects.toMatchObject({
			code: 'validation',
			status: 400,
			fieldErrors: { reviewNote: DEDUP_NOTE_REQUIRED }
		});

		expect(findCustomer(HELD_SMITH)?.state).toBe('pending_review');
	});

	it('activates the held row, removes it from the queue and audits the decision', async () => {
		const result = await mockDuplicatesRepository.review({
			entityType: 'customer',
			id: HELD_SMITH,
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: '  Different branch of the family. '
		});

		expect(result).toEqual({
			entityType: 'customer',
			heldId: HELD_SMITH,
			targetId: null,
			decision: 'confirm_distinct'
		});

		expect(findCustomer(HELD_SMITH)).toMatchObject({
			state: 'active',
			dedupOfId: null,
			reviewNote: 'Different branch of the family.'
		});

		const queue = await mockDuplicatesRepository.list();
		expect(queue.some((item) => item.held.id === HELD_SMITH)).toBe(false);

		const audit = await mockDuplicatesRepository.audit('customer', HELD_SMITH);
		expect(audit.find((row) => row.action === 'dedup_review')?.payload).toMatchObject({
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: 'Different branch of the family.'
		});
	});

	it('rejects a second review with 409', async () => {
		await mockDuplicatesRepository.review({
			entityType: 'customer',
			id: HELD_SMITH,
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: 'First review.'
		});

		await expect(
			mockDuplicatesRepository.review({
				entityType: 'customer',
				id: HELD_SMITH,
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: 'Second review.'
			})
		).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: DEDUP_ALREADY_REVIEWED
		});
	});

	it('activates a project held row', async () => {
		const heldProject = projectFixture();
		setCollection(COLLECTIONS.projects, [
			...getCollection<ProjectRecord>(COLLECTIONS.projects),
			heldProject
		]);

		const result = await mockDuplicatesRepository.review({
			entityType: 'project',
			id: heldProject.id,
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: 'A second kitchen for the same house.'
		});

		expect(result.entityType).toBe('project');
		expect(findProject(heldProject.id)).toMatchObject({
			state: 'active',
			dedupOfId: null,
			reviewNote: 'A second kitchen for the same house.'
		});
	});
});

describe('mockReviewDedup - link_to_existing', () => {
	it('cancels the held customer, keeps the target and audits both values', async () => {
		const result = await mockDuplicatesRepository.review({
			entityType: 'customer',
			id: HELD_SMITH,
			decision: 'link_to_existing',
			targetId: demoCustomerId(2),
			reviewNote: 'Same person, second enquiry.'
		});

		expect(result).toEqual({
			entityType: 'customer',
			heldId: HELD_SMITH,
			targetId: demoCustomerId(2),
			decision: 'link_to_existing'
		});
		expect(findCustomer(HELD_SMITH)).toMatchObject({
			state: 'cancelled',
			dedupOfId: demoCustomerId(2),
			reviewNote: 'Same person, second enquiry.'
		});

		const queue = await mockDuplicatesRepository.list();
		expect(queue.some((item) => item.held.id === HELD_SMITH)).toBe(false);

		const audit = await mockDuplicatesRepository.audit('customer', HELD_SMITH);
		expect(audit.find((row) => row.action === 'dedup_review')?.payload).toMatchObject({
			decision: 'link_to_existing',
			targetId: demoCustomerId(2),
			reviewNote: 'Same person, second enquiry.'
		});
	});

	it('cancels a held property', async () => {
		const heldProperty = propertyFixture(demoPropertyId(90));
		setCollection(COLLECTIONS.properties, [
			...getCollection<PropertyRecord>(COLLECTIONS.properties),
			heldProperty
		]);

		await mockDuplicatesRepository.review({
			entityType: 'property',
			id: heldProperty.id,
			decision: 'link_to_existing',
			targetId: demoPropertyId(1),
			reviewNote: 'Same address.'
		});

		expect(findProperty(heldProperty.id)).toMatchObject({
			state: 'cancelled',
			dedupOfId: demoPropertyId(1)
		});
	});

	it('rejects linking to itself with a 400 field error', async () => {
		await expect(
			mockDuplicatesRepository.review({
				entityType: 'customer',
				id: HELD_SMITH,
				decision: 'link_to_existing',
				targetId: HELD_SMITH,
				reviewNote: ''
			})
		).rejects.toMatchObject({
			code: 'validation',
			status: 400,
			fieldErrors: { targetId: DEDUP_TARGET_INVALID }
		});
	});

	it('rejects an unknown target with 404 and an unknown held id with 404', async () => {
		await expect(
			mockDuplicatesRepository.review({
				entityType: 'customer',
				id: HELD_SMITH,
				decision: 'link_to_existing',
				targetId: demoCustomerId(99),
				reviewNote: ''
			})
		).rejects.toMatchObject({
			code: 'not_found',
			status: 404,
			message: DEDUP_TARGET_NOT_FOUND
		});

		await expect(
			mockDuplicatesRepository.review({
				entityType: 'customer',
				id: demoCustomerId(99),
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: 'No such held row.'
			})
		).rejects.toMatchObject({ code: 'not_found', status: 404 });
	});

	it('cannot link a held row in another tenant', async () => {
		signIn(HARBOUR_OWNER);

		await expect(
			mockDuplicatesRepository.review({
				entityType: 'customer',
				id: HELD_SMITH,
				decision: 'link_to_existing',
				targetId: demoCustomerId(2),
				reviewNote: ''
			})
		).rejects.toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('mockReviewDedup - permissions', () => {
	it('lets a Designer read the queue but denies the review with 403', async () => {
		signIn(DESIGNER);

		const queue = await mockDuplicatesRepository.list();
		expect(queue).toHaveLength(2);

		const request: DedupReviewRequest = {
			entityType: 'customer',
			id: HELD_SMITH,
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: 'Designer should not resolve this.'
		};
		await expect(mockDuplicatesRepository.review(request)).rejects.toMatchObject({
			code: 'forbidden',
			status: 403
		});

		expect(findCustomer(HELD_SMITH)?.state).toBe('pending_review');
	});

	it('denies a property review to a role without property.update', async () => {
		const heldProperty = propertyFixture(demoPropertyId(90));
		setCollection(COLLECTIONS.properties, [
			...getCollection<PropertyRecord>(COLLECTIONS.properties),
			heldProperty
		]);
		signIn(DESIGNER);

		await expect(
			mockDuplicatesRepository.review({
				entityType: 'property',
				id: heldProperty.id,
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: 'Designer cannot review properties.'
			})
		).rejects.toMatchObject({ code: 'forbidden', status: 403 });
	});
});

describe('mockListDedupAudit', () => {
	it('returns the newest-first tenant audit trail for a held object', async () => {
		await mockDuplicatesRepository.review({
			entityType: 'customer',
			id: HELD_HARTLEY,
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: 'Wrong Hartley branch.'
		});

		const audit = await mockDuplicatesRepository.audit('customer', HELD_HARTLEY);

		expect(audit).toHaveLength(1);
		expect(audit[0]).toMatchObject({
			action: 'dedup_review',
			subjectType: 'customer',
			subjectId: HELD_HARTLEY
		});
	});
});
