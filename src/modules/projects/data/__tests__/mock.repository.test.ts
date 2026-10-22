import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));

import { session } from '$shared/application/session';
import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import {
	DEMO_CUSTOMER_PLAN,
	DEMO_PROJECT_ASSIGNMENT_PLAN,
	DEMO_PROJECT_PLAN,
	DEMO_PROPERTY_PLAN,
	demoCustomerId,
	demoProjectId,
	demoPropertyId,
	demoSurveyorId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import type {
	AppUserRecord,
	CustomerRecord,
	ProjectRecord,
	ProjectUserRecord,
	PropertyRecord
} from '$shared/data/records';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { deterministicUuid } from '$shared/lib/deterministic';
import { ApiError } from '$network/errors';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import type { CreateProjectInput, DedupReviewInput } from '../../domain/types';
import {
	mockAddProjectAssignment,
	mockArchiveProject,
	mockCreateProject,
	mockGetProject,
	mockListAssignableSurveyors,
	mockListProjectAssignments,
	mockListProjectAudit,
	mockListProjects,
	mockRemoveProjectAssignment,
	mockReviewProjectDedup,
	mockTransitionProject,
	mockUnarchiveProject,
	mockUpdateProject
} from '../mock';

const OPULENT = DEMO_TENANTS[0];
const HARBOUR = DEMO_TENANTS[1];
const SALES_ID = deterministicUuid('user:opulent:sales');
const SURVEYOR_ID = demoSurveyorId('surveyor');
const SURVEYOR_2_ID = demoSurveyorId('surveyor-2');
const DESIGNER_ID = demoSurveyorId('designer');

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
		source: 'other',
		leadUuid: null,
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(90),
		updatedAt: demoDays(5),
		createdBy: SALES_ID,
		archivedAt: null
	}));
}

function propertyRecords(): PropertyRecord[] {
	return DEMO_PROPERTY_PLAN.map((plan) => ({
		id: demoPropertyId(plan.n),
		tenantId: OPULENT.id,
		customerId: demoCustomerId(plan.customerN),
		addressLine1: plan.addressLine1,
		addressLine2: null,
		town: plan.town,
		postcode: plan.postcode,
		accessNotes: plan.n === 1 ? 'Key safe by the side gate.' : null,
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(80),
		updatedAt: demoDays(5),
		createdBy: SALES_ID,
		archivedAt: null
	}));
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof ApiError) return error;
		throw error;
	}
	throw new Error('Expected the call to reject with an ApiError.');
}

function projectIds(ns: readonly number[]): string[] {
	return ns.map((n) => demoProjectId(n));
}

const WIZARD_INPUT: CreateProjectInput = {
	customerId: demoCustomerId(2),
	propertyId: demoPropertyId(2),
	caption: 'Bespoke study',
	projectType: 'other',
	surveyorIds: [SURVEYOR_2_ID]
};

beforeEach(() => {
	(globalThis as { localStorage?: Storage }).localStorage = createMemoryStorage();
	resetMockDb();
	// Auth and the other records modules own these collections; install the
	// shared demo world explicitly so this suite is independent of load order.
	setCollection(
		COLLECTIONS.tenants,
		DEMO_TENANTS.map((tenant) => ({ ...tenant }))
	);
	setCollection(
		COLLECTIONS.appUsers,
		DEMO_USERS.map((user) => ({ ...user }))
	);
	setCollection(COLLECTIONS.customers, customerRecords());
	setCollection(COLLECTIONS.properties, propertyRecords());
});

afterEach(() => {
	session.clearSession();
	delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('projects seed', () => {
	it('seeds 18 plan projects with references, statuses and surveyors', () => {
		signIn('sales@opulentinteriors.co.uk');
		const projects = getCollection<ProjectRecord>(COLLECTIONS.projects);
		const assignments = getCollection<ProjectUserRecord>(COLLECTIONS.projectUsers);

		expect(projects).toHaveLength(18);
		expect(projects.map((project) => project.id)).toEqual(
			DEMO_PROJECT_PLAN.map((plan) => demoProjectId(plan.n))
		);
		expect(projects.map((project) => project.status)).toEqual(
			DEMO_PROJECT_PLAN.map((plan) => plan.status)
		);
		expect(projects.map((project) => project.reference)).toEqual(
			DEMO_PROJECT_PLAN.map((plan) => plan.reference)
		);
		expect(assignments).toHaveLength(DEMO_PROJECT_ASSIGNMENT_PLAN.length);
		for (const project of projects) {
			expect(assignments.some((assignment) => assignment.projectId === project.id)).toBe(true);
			expect(project.tenantId).toBe(OPULENT.id);
			expect(project.state).toBe('active');
		}
	});

	it('produces byte-identical data on two consecutive resets', () => {
		const first = JSON.stringify({
			projects: getCollection<ProjectRecord>(COLLECTIONS.projects),
			assignments: getCollection<ProjectUserRecord>(COLLECTIONS.projectUsers)
		});

		resetMockDb();

		const second = JSON.stringify({
			projects: getCollection<ProjectRecord>(COLLECTIONS.projects),
			assignments: getCollection<ProjectUserRecord>(COLLECTIONS.projectUsers)
		});

		expect(second).toBe(first);
	});
});

describe('mockListProjects', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('joins customer caption, property address and surveyor names', async () => {
		const page = await mockListProjects({});

		expect(page.total).toBe(18);
		expect(page.page).toBe(1);
		expect(page.pageSize).toBe(20);
		expect(page.items.map((row) => row.id)).toEqual(
			projectIds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
		);

		const first = page.items[0];
		expect(first).toMatchObject({
			caption: 'Kitchen renovation',
			reference: 'OIG-2026-0001',
			customerCaption: 'A. Smith',
			propertyAddress: '1 Oak Street, Richmond, TW9 1AA',
			surveyorNames: ['Aisha Khan']
		});
	});

	it('searches caption, reference, customer caption and property address', async () => {
		expect(
			(await mockListProjects({ search: 'Kitchen renovation' })).items.map((r) => r.id)
		).toEqual(projectIds([1]));
		expect((await mockListProjects({ search: 'OIG-2026-0004' })).items.map((r) => r.id)).toEqual(
			projectIds([4])
		);
		expect((await mockListProjects({ search: 'Bramble' })).items.map((r) => r.id)).toEqual(
			projectIds([3])
		);
		expect((await mockListProjects({ search: '9 Chestnut Rise' })).items.map((r) => r.id)).toEqual(
			projectIds([9])
		);
		expect((await mockListProjects({ search: 'no-such-project' })).total).toBe(0);
	});

	it('filters by type, status and assigned surveyor', async () => {
		expect((await mockListProjects({ type: 'kitchen' })).items.map((r) => r.id)).toEqual(
			projectIds([1, 6, 9, 16])
		);
		expect((await mockListProjects({ status: 'on_hold' })).items.map((r) => r.id)).toEqual(
			projectIds([4, 10, 16])
		);
		expect((await mockListProjects({ surveyorId: SURVEYOR_ID })).items.map((r) => r.id)).toEqual(
			projectIds([1, 7, 10, 13])
		);
		expect(
			(await mockListProjects({ type: 'kitchen', status: 'active' })).items.map((r) => r.id)
		).toEqual(projectIds([1, 9]));
	});

	it('sorts by caption, reference and createdAt', async () => {
		const captionAsc = await mockListProjects({ sort: 'caption', sortDir: 'asc' });
		expect(captionAsc.items.map((row) => row.caption)).toEqual(
			[...captionAsc.items.map((row) => row.caption)].sort((a, b) => a.localeCompare(b, 'en-GB'))
		);

		const referenceAsc = await mockListProjects({ sort: 'reference', sortDir: 'asc' });
		expect(referenceAsc.items.map((row) => row.id)).toEqual(
			projectIds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
		);

		const createdAtAsc = await mockListProjects({ sort: 'createdAt', sortDir: 'asc' });
		expect(createdAtAsc.items[0]?.id).toBe(demoProjectId(18));
	});

	it('paginates like a server', async () => {
		const first = await mockListProjects({ page: 1, pageSize: 5 });
		const last = await mockListProjects({ page: 4, pageSize: 5 });

		expect(first.items).toHaveLength(5);
		expect(first.totalPages).toBe(4);
		expect(first.hasMore).toBe(true);
		expect(last.items).toHaveLength(3);
		expect(last.hasMore).toBe(false);
	});

	it('scopes `mine` to the caller’s assignments only', async () => {
		signIn('surveyor@opulentinteriors.co.uk');
		const mine = await mockListProjects({ scope: 'mine' });
		expect(mine.items.map((row) => row.id)).toEqual(projectIds([1, 7, 10, 13]));

		signIn('sales@opulentinteriors.co.uk');
		const none = await mockListProjects({ scope: 'mine' });
		expect(none.total).toBe(0);
	});

	it('never returns another tenant’s projects', async () => {
		signIn('owner@harbourfinch.co.uk');
		const page = await mockListProjects({});
		expect(page.total).toBe(0);
	});
});

describe('mockGetProject', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('returns the hub with the 15-stage pipeline and gate ids', async () => {
		const hub = await mockGetProject(demoProjectId(1));

		expect(hub.project.id).toBe(demoProjectId(1));
		expect(hub.customer).toMatchObject({
			caption: 'A. Smith',
			email: 'alice.smith@example.com'
		});
		expect(hub.property).toMatchObject({
			addressLine1: '1 Oak Street',
			accessNotes: 'Key safe by the side gate.'
		});
		expect(hub.assignments).toHaveLength(1);
		expect(hub.assignments[0]).toMatchObject({
			userName: 'Aisha Khan',
			userEmail: 'surveyor@opulentinteriors.co.uk',
			assignedByName: 'Elena Rossi'
		});
		expect(hub.counts).toEqual({ surveys: 0, designs: 0, quotes: 0, orders: 0, job: false });

		expect(hub.stages.map((stage) => stage.id)).toEqual([
			'project_setup',
			'survey',
			'design',
			'quote',
			'approval',
			'order',
			'engineering',
			'procurement',
			'validation',
			'export',
			'part_tracking',
			'assembly',
			'installation',
			'payment',
			'aftercare'
		]);
		expect(hub.stages.map((stage) => stage.gateId)).toEqual([
			null,
			'G8',
			'G1',
			'G2',
			'G3',
			'G4',
			null,
			null,
			'G5',
			'G6',
			null,
			null,
			'G7',
			null,
			null
		]);
		expect(hub.stages[0]?.state).toBe('passed');
		expect(hub.stages[1]?.state).toBe('current');
		expect(hub.stages.slice(2).every((stage) => stage.state === 'future')).toBe(true);
		expect(hub.gates).toEqual([]);
	});

	it('marks setup and survey passed on a completed project', async () => {
		const hub = await mockGetProject(demoProjectId(6));
		expect(hub.stages[0]?.state).toBe('passed');
		expect(hub.stages[1]?.state).toBe('passed');
		expect(hub.stages.slice(2).every((stage) => stage.state === 'future')).toBe(true);
	});

	it('leaves every stage after setup in the future for a cancelled project', async () => {
		const hub = await mockGetProject(demoProjectId(11));
		expect(hub.stages[0]?.state).toBe('passed');
		expect(hub.stages.slice(1).every((stage) => stage.state === 'future')).toBe(true);
	});

	it('raises a warning gate for a project on hold', async () => {
		const hub = await mockGetProject(demoProjectId(4));
		expect(hub.gates).toEqual([
			{
				id: 'on_hold',
				title: 'Project on hold',
				state: 'warning',
				reasons: []
			}
		]);
	});

	it('blocks an active project with no surveyor assigned', async () => {
		const created = await mockCreateProject({
			customerId: demoCustomerId(1),
			propertyId: demoPropertyId(1),
			caption: 'Cellar conversion',
			projectType: 'whole_house',
			surveyorIds: []
		});

		const hub = await mockGetProject(created.id);
		expect(hub.assignments).toEqual([]);
		expect(hub.stages[1]?.state).toBe('blocking');
		expect(hub.gates).toEqual([
			{
				id: 'assignment',
				title: 'Assign a surveyor',
				state: 'blocking',
				reasons: ['A project needs at least one surveyor before surveys can start.']
			}
		]);
	});

	it('returns 404 for a project in another tenant', async () => {
		signIn('owner@harbourfinch.co.uk');
		const error = await captureError(mockGetProject(demoProjectId(1)));
		expect(error).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('mockCreateProject', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('creates an active project with surveyor assignments and audits', async () => {
		const created = await mockCreateProject(WIZARD_INPUT);

		expect(created).toMatchObject({
			customerId: demoCustomerId(2),
			propertyId: demoPropertyId(2),
			caption: 'Bespoke study',
			projectType: 'other',
			status: 'active',
			state: 'active',
			reference: 'OPULENT-2026-0019'
		});
		expect(created.tenantId).toBe(OPULENT.id);

		const assignments = await mockListProjectAssignments(created.id);
		expect(assignments).toHaveLength(1);
		expect(assignments[0]).toMatchObject({
			userId: SURVEYOR_2_ID,
			userName: "Liam O'Connor",
			assignedBy: SALES_ID
		});

		const hub = await mockGetProject(created.id);
		expect(hub.stages[1]?.state).toBe('current');
		expect(hub.gates).toEqual([]);

		const audit = await mockListProjectAudit(created.id);
		expect(audit.map((row) => row.action).sort()).toEqual(['assignment_add', 'create']);
		expect(audit.find((row) => row.action === 'create')?.payload).toMatchObject({
			reference: 'OPULENT-2026-0019',
			surveyorIds: [SURVEYOR_2_ID]
		});
	});

	it('rejects a user who does not hold the Surveyor role, naming the id', async () => {
		const error = await captureError(
			mockCreateProject({ ...WIZARD_INPUT, surveyorIds: [DESIGNER_ID] })
		);

		expect(error).toMatchObject({ code: 'validation', status: 400 });
		expect(error.message).toContain(DESIGNER_ID);
		expect(error.message).toContain('Surveyor');
		expect(error.fieldErrors).toMatchObject({ surveyorIds: expect.stringContaining(DESIGNER_ID) });
	});

	it('rejects a property that belongs to another customer', async () => {
		const error = await captureError(
			mockCreateProject({
				...WIZARD_INPUT,
				customerId: demoCustomerId(1),
				propertyId: demoPropertyId(3)
			})
		);

		expect(error).toMatchObject({ code: 'validation', status: 400 });
		expect(error.fieldErrors).toMatchObject({
			propertyId: 'Choose a property that belongs to the selected customer.'
		});
	});

	it('holds a duplicate as pending_review and returns 409 with candidates', async () => {
		const error = await captureError(
			mockCreateProject({
				customerId: demoCustomerId(1),
				propertyId: demoPropertyId(1),
				caption: 'Kitchen renovation',
				projectType: 'kitchen',
				surveyorIds: [SURVEYOR_ID]
			})
		);

		expect(error).toMatchObject({ code: 'conflict', status: 409 });
		const details = error.details as {
			entityType: string;
			heldId: string;
			candidates: Array<{ id: string; matchReasons: string[] }>;
		};
		expect(details.entityType).toBe('project');
		expect(details.candidates[0]).toMatchObject({
			id: demoProjectId(1),
			matchReasons: ['Same property', 'Same project type', 'Caption matches']
		});

		const held = getCollection<ProjectRecord>(COLLECTIONS.projects).find(
			(project) => project.id === details.heldId
		);
		expect(held).toMatchObject({
			state: 'pending_review',
			dedupOfId: demoProjectId(1)
		});
		expect(
			getCollection<ProjectUserRecord>(COLLECTIONS.projectUsers).some(
				(row) => row.projectId === details.heldId
			)
		).toBe(false);

		const audit = await mockListProjectAudit(details.heldId);
		expect(audit.find((row) => row.action === 'create')?.payload).toEqual({ held: true });
	});

	it('requires project.create permission', async () => {
		signIn('surveyor@opulentinteriors.co.uk');
		const error = await captureError(mockCreateProject(WIZARD_INPUT));
		expect(error).toMatchObject({ code: 'forbidden', status: 403 });
	});
});

describe('mockUpdateProject', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('updates the caption and type, auditing the changed fields', async () => {
		const updated = await mockUpdateProject(demoProjectId(1), {
			caption: 'Kitchen and pantry refurb',
			projectType: 'whole_house'
		});

		expect(updated).toMatchObject({
			caption: 'Kitchen and pantry refurb',
			projectType: 'whole_house'
		});

		const audit = await mockListProjectAudit(demoProjectId(1));
		expect(audit.find((row) => row.action === 'update')?.payload).toEqual({
			fields: ['caption', 'projectType']
		});
	});

	it('rejects an empty caption', async () => {
		const error = await captureError(mockUpdateProject(demoProjectId(1), { caption: '   ' }));
		expect(error).toMatchObject({ code: 'validation', status: 400 });
		expect(error.fieldErrors).toMatchObject({ caption: 'Enter a project caption.' });
	});

	it('blocks edits while the project is pending duplicate review', async () => {
		const duplicate = await captureError(
			mockCreateProject({
				customerId: demoCustomerId(1),
				propertyId: demoPropertyId(1),
				caption: 'Kitchen renovation',
				projectType: 'kitchen',
				surveyorIds: []
			})
		);
		const heldId = (duplicate.details as { heldId: string }).heldId;

		const error = await captureError(mockUpdateProject(heldId, { caption: 'Renamed' }));
		expect(error).toMatchObject({ code: 'conflict', status: 409 });
		expect(error.message).toContain('duplicate review');
	});

	it('blocks edits on an archived project until it is restored', async () => {
		await mockArchiveProject(demoProjectId(2));
		const error = await captureError(mockUpdateProject(demoProjectId(2), { caption: 'Renamed' }));
		expect(error).toMatchObject({ code: 'conflict', status: 409 });
		expect(error.message).toContain('Restore');
	});
});

describe('mockTransitionProject', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('puts a project on hold with a reason and shows the warning gate', async () => {
		const held = await mockTransitionProject(demoProjectId(1), {
			status: 'on_hold',
			reason: 'Waiting for the building survey'
		});
		expect(held.status).toBe('on_hold');

		const hub = await mockGetProject(demoProjectId(1));
		expect(hub.gates).toEqual([
			{
				id: 'on_hold',
				title: 'Project on hold',
				state: 'warning',
				reasons: ['Waiting for the building survey']
			}
		]);

		const audit = await mockListProjectAudit(demoProjectId(1));
		expect(
			audit.find((row) => row.action === 'state_transition' && row.payload?.to === 'on_hold')
				?.payload
		).toEqual({
			from: 'active',
			to: 'on_hold',
			reason: 'Waiting for the building survey'
		});
	});

	it('resumes from hold and clears the reason gate', async () => {
		await mockTransitionProject(demoProjectId(1), {
			status: 'on_hold',
			reason: 'Awaiting drawings'
		});
		const resumed = await mockTransitionProject(demoProjectId(1), { status: 'active' });

		expect(resumed.status).toBe('active');
		const hub = await mockGetProject(demoProjectId(1));
		expect(hub.gates).toEqual([]);

		const audit = await mockListProjectAudit(demoProjectId(1));
		expect(
			audit.find((row) => row.action === 'state_transition' && row.payload?.to === 'active')
				?.payload
		).toEqual({ from: 'on_hold', to: 'active', reason: null });
	});

	it('requires a non-empty reason for on_hold and cancelled', async () => {
		const hold = await captureError(
			mockTransitionProject(demoProjectId(1), { status: 'on_hold', reason: '  ' })
		);
		expect(hold).toMatchObject({ code: 'validation', status: 400 });
		expect(hold.fieldErrors).toMatchObject({ reason: expect.stringContaining('reason') });

		const cancel = await captureError(
			mockTransitionProject(demoProjectId(12), { status: 'cancelled' })
		);
		expect(cancel).toMatchObject({ code: 'validation', status: 400 });
		expect(cancel.fieldErrors).toMatchObject({ reason: expect.stringContaining('cancelling') });

		const cancelled = await mockTransitionProject(demoProjectId(12), {
			status: 'cancelled',
			reason: 'Customer withdrew'
		});
		expect(cancelled.status).toBe('cancelled');
	});

	it('refuses illegal moves with a sentence naming the legal next states', async () => {
		const completed = await mockTransitionProject(demoProjectId(2), { status: 'completed' });
		expect(completed.status).toBe('completed');

		const fromCompleted = await captureError(
			mockTransitionProject(demoProjectId(2), { status: 'active' })
		);
		expect(fromCompleted).toMatchObject({ code: 'conflict', status: 409 });
		expect(fromCompleted.message).toContain('legal next states');
		expect(fromCompleted.message).toContain('final');

		const fromOnHold = await captureError(
			mockTransitionProject(demoProjectId(4), { status: 'completed' })
		);
		expect(fromOnHold.message).toContain('on hold');
		expect(fromOnHold.message).toContain('active or cancelled');

		const fromCancelled = await captureError(
			mockTransitionProject(demoProjectId(11), { status: 'active' })
		);
		expect(fromCancelled.message).toContain('cancelled');
		expect(fromCancelled.message).toContain('final');
	});

	it('treats completed and cancelled as terminal', async () => {
		await mockTransitionProject(demoProjectId(3), { status: 'completed' });
		const errors = [
			await captureError(mockTransitionProject(demoProjectId(3), { status: 'cancelled' })),
			await captureError(mockTransitionProject(demoProjectId(11), { status: 'cancelled' }))
		];
		for (const error of errors) {
			expect(error).toMatchObject({ code: 'conflict', status: 409 });
		}
	});

	it('blocks status changes on an archived project', async () => {
		await mockArchiveProject(demoProjectId(5));
		const error = await captureError(
			mockTransitionProject(demoProjectId(5), { status: 'completed' })
		);
		expect(error).toMatchObject({ code: 'conflict', status: 409 });
		expect(error.message).toContain('Restore');
	});
});

describe('mockArchiveProject / mockUnarchiveProject', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('archives and restores a project, auditing both actions', async () => {
		const archived = await mockArchiveProject(demoProjectId(2));
		expect(archived.state).toBe('archived');
		expect(archived.archivedAt).not.toBeNull();

		const archiveAudit = await mockListProjectAudit(demoProjectId(2));
		expect(archiveAudit.some((row) => row.action === 'archive')).toBe(true);

		const restored = await mockUnarchiveProject(demoProjectId(2));
		expect(restored.state).toBe('active');
		expect(restored.archivedAt).toBeNull();

		const unarchiveAudit = await mockListProjectAudit(demoProjectId(2));
		expect(unarchiveAudit.some((row) => row.action === 'unarchive')).toBe(true);
	});

	it('refuses double archive and unarchiving an active project', async () => {
		await mockArchiveProject(demoProjectId(2));
		const again = await captureError(mockArchiveProject(demoProjectId(2)));
		expect(again).toMatchObject({ code: 'conflict', status: 409 });

		const notArchived = await captureError(mockUnarchiveProject(demoProjectId(3)));
		expect(notArchived).toMatchObject({ code: 'conflict', status: 409 });
	});

	it('blocks archiving a pending_review project', async () => {
		const duplicate = await captureError(
			mockCreateProject({
				customerId: demoCustomerId(1),
				propertyId: demoPropertyId(1),
				caption: 'Kitchen renovation',
				projectType: 'kitchen',
				surveyorIds: []
			})
		);
		const heldId = (duplicate.details as { heldId: string }).heldId;

		const error = await captureError(mockArchiveProject(heldId));
		expect(error).toMatchObject({ code: 'conflict', status: 409 });
		expect(error.message).toContain('duplicate review');
	});

	it('requires project.archive permission', async () => {
		signIn('surveyor@opulentinteriors.co.uk');
		const error = await captureError(mockArchiveProject(demoProjectId(1)));
		expect(error).toMatchObject({ code: 'forbidden', status: 403 });
	});
});

describe('mockReviewProjectDedup', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	async function createHeldProject(): Promise<string> {
		const error = await captureError(
			mockCreateProject({
				customerId: demoCustomerId(1),
				propertyId: demoPropertyId(1),
				caption: 'Kitchen renovation',
				projectType: 'kitchen',
				surveyorIds: []
			})
		);
		return (error.details as { heldId: string }).heldId;
	}

	it('requires a note to confirm a project is distinct', async () => {
		const heldId = await createHeldProject();

		const missing = await captureError(
			mockReviewProjectDedup(heldId, {
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: ' '
			})
		);
		expect(missing).toMatchObject({ code: 'validation', status: 400 });
		expect(missing.message).toBe('Add a note explaining why this is a different record.');

		const reviewed = await mockReviewProjectDedup(heldId, {
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: 'The other job covers the pantry only.'
		});
		expect(reviewed.state).toBe('active');
		expect(reviewed.reviewNote).toBe('The other job covers the pantry only.');

		const audit = await mockListProjectAudit(heldId);
		expect(audit.find((row) => row.action === 'dedup_review')?.payload).toMatchObject({
			decision: 'confirm_distinct',
			reviewNote: 'The other job covers the pantry only.'
		});

		const repeat = await captureError(
			mockReviewProjectDedup(heldId, {
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: 'Second review'
			})
		);
		expect(repeat).toMatchObject({ code: 'conflict', status: 409 });
	});

	it('links a held project to the existing record and closes it', async () => {
		const heldId = await createHeldProject();
		const input: DedupReviewInput = {
			decision: 'link_to_existing',
			targetId: demoProjectId(1),
			reviewNote: 'Same job, created twice.'
		};

		const linked = await mockReviewProjectDedup(heldId, input);
		expect(linked.state).toBe('cancelled');
		expect(linked.dedupOfId).toBe(demoProjectId(1));
		expect(linked.reviewNote).toBe('Same job, created twice.');

		const audit = await mockListProjectAudit(heldId);
		expect(audit.find((row) => row.action === 'dedup_review')?.payload).toMatchObject({
			decision: 'link_to_existing',
			targetId: demoProjectId(1)
		});
	});

	it('rejects a missing or unknown link target', async () => {
		const heldId = await createHeldProject();
		const missing = await captureError(
			mockReviewProjectDedup(heldId, {
				decision: 'link_to_existing',
				targetId: null,
				reviewNote: 'Link it'
			})
		);
		expect(missing).toMatchObject({ code: 'validation', status: 400 });

		const unknown = await captureError(
			mockReviewProjectDedup(heldId, {
				decision: 'link_to_existing',
				targetId: deterministicUuid('project:missing'),
				reviewNote: 'Link it'
			})
		);
		expect(unknown).toMatchObject({ code: 'not_found', status: 404 });
	});

	it('refuses to review a project that is not held', async () => {
		const error = await captureError(
			mockReviewProjectDedup(demoProjectId(1), {
				decision: 'confirm_distinct',
				targetId: null,
				reviewNote: 'Not a duplicate'
			})
		);
		expect(error).toMatchObject({ code: 'conflict', status: 409 });
	});
});

describe('project assignments (S1)', () => {
	beforeEach(() => {
		signIn('sales@opulentinteriors.co.uk');
	});

	it('lists every active Surveyor and flags the assigned ones', async () => {
		const surveyors = await mockListAssignableSurveyors(demoProjectId(1));

		expect(surveyors).toHaveLength(6);
		expect(surveyors.map((surveyor) => surveyor.displayName)).toEqual([
			'Aisha Khan',
			'Harriet Wells',
			"Liam O'Connor",
			'Mei Tan',
			'Noah Adeyemi',
			'Sofia Marchetti'
		]);
		expect(surveyors.find((surveyor) => surveyor.id === SURVEYOR_ID)).toMatchObject({
			assigned: true
		});
		expect(surveyors.find((surveyor) => surveyor.id === SURVEYOR_2_ID)).toMatchObject({
			assigned: false
		});
		expect(surveyors.some((surveyor) => surveyor.id === DESIGNER_ID)).toBe(false);
	});

	it('adds a surveyor and audits the assignment', async () => {
		const assignment = await mockAddProjectAssignment(demoProjectId(1), {
			userId: SURVEYOR_2_ID
		});

		expect(assignment).toMatchObject({
			projectId: demoProjectId(1),
			userId: SURVEYOR_2_ID,
			userName: "Liam O'Connor",
			assignedBy: SALES_ID
		});

		const audit = await mockListProjectAudit(demoProjectId(1));
		expect(audit.find((row) => row.action === 'assignment_add')?.payload).toEqual({
			userId: SURVEYOR_2_ID
		});
	});

	it('rejects a duplicate assignment with 409', async () => {
		const error = await captureError(
			mockAddProjectAssignment(demoProjectId(1), { userId: SURVEYOR_ID })
		);
		expect(error).toMatchObject({ code: 'conflict', status: 409 });
	});

	it('rejects a non-surveyor and an invalid id with 400', async () => {
		const nonSurveyor = await captureError(
			mockAddProjectAssignment(demoProjectId(1), { userId: DESIGNER_ID })
		);
		expect(nonSurveyor).toMatchObject({ code: 'validation', status: 400 });
		expect(nonSurveyor.message).toContain(DESIGNER_ID);

		const invalid = await captureError(
			mockAddProjectAssignment(demoProjectId(1), { userId: 'not-a-uuid' })
		);
		expect(invalid).toMatchObject({ code: 'validation', status: 400 });
		expect(invalid.fieldErrors).toMatchObject({ userId: 'Choose a surveyor.' });
	});

	it('removes an assignment, keeps the audit note and re-blocks the hub', async () => {
		await mockRemoveProjectAssignment(demoProjectId(1), SURVEYOR_ID);

		const assignments = await mockListProjectAssignments(demoProjectId(1));
		expect(assignments).toEqual([]);

		const hub = await mockGetProject(demoProjectId(1));
		expect(hub.stages[1]?.state).toBe('blocking');
		expect(hub.gates[0]).toMatchObject({ id: 'assignment', state: 'blocking' });

		const audit = await mockListProjectAudit(demoProjectId(1));
		expect(audit.find((row) => row.action === 'assignment_remove')?.payload).toEqual({
			userId: SURVEYOR_ID,
			note: 'Existing surveys are kept; new surveys are blocked for this surveyor.'
		});
	});

	it('returns 404 when removing a surveyor who is not assigned', async () => {
		const error = await captureError(mockRemoveProjectAssignment(demoProjectId(1), SURVEYOR_2_ID));
		expect(error).toMatchObject({ code: 'not_found', status: 404 });
	});

	it('requires project.update to change assignments', async () => {
		signIn('surveyor@opulentinteriors.co.uk');
		const error = await captureError(
			mockAddProjectAssignment(demoProjectId(1), { userId: SURVEYOR_2_ID })
		);
		expect(error).toMatchObject({ code: 'forbidden', status: 403 });
	});
});

describe('tenant scoping', () => {
	it('refuses project data to an anonymous caller', async () => {
		const error = await captureError(mockListProjects({}));
		expect(error).toMatchObject({ code: 'unauthorized', status: 401 });
	});

	it('refuses project data to a platform user', async () => {
		signIn('platform@interio.app');
		const error = await captureError(mockListProjects({}));
		expect(error).toMatchObject({ code: 'forbidden', status: 403 });
	});

	it('returns 404 when a harbour user asks for an opulent project', async () => {
		signIn('owner@harbourfinch.co.uk');
		const error = await captureError(mockGetProject(demoProjectId(1)));
		expect(error).toMatchObject({ code: 'not_found', status: 404 });
	});

	it('keeps the tenant from the session, never from input', async () => {
		signIn('sales@opulentinteriors.co.uk');
		const created = await mockCreateProject(WIZARD_INPUT);
		const record = getCollection<ProjectRecord>(COLLECTIONS.projects).find(
			(project) => project.id === created.id
		);
		expect(record?.tenantId).toBe(OPULENT.id);
		expect(record?.tenantId).not.toBe(HARBOUR.id);
	});

	it('never leaks another tenant’s assignments into the assignable list', async () => {
		signIn('owner@harbourfinch.co.uk');
		const error = await captureError(mockListAssignableSurveyors(demoProjectId(1)));
		expect(error).toMatchObject({ code: 'not_found', status: 404 });
	});
});
