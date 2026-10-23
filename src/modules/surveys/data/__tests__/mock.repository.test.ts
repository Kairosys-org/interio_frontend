import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));

import { session } from '$shared/application/session';
import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import {
	demoCustomerId,
	demoProjectId,
	demoPropertyId,
	demoSurveyId,
	demoSurveyMeasurementId,
	demoSurveyNoteId,
	demoSurveyRoomId,
	demoSurveyorId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import type {
	AppUserRecord,
	AuditEventRecord,
	CustomerRecord,
	ProjectRecord,
	ProjectUserRecord,
	PropertyRecord,
	SurveyMeasurementRecord,
	SurveyNoteRecord,
	SurveyRoomRecord
} from '$shared/data/records';
import { deterministicUuid } from '$shared/lib/deterministic';
import { isUuid } from '$shared/domain/uuid';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import type { CreateMeasurementInput } from '../../domain/types';
import { ApiError, ApiErrorCode, isApiError } from '$network/errors';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import {
	mockCreateMeasurement,
	mockCreateNote,
	mockCriticalMeasurements,
	mockGetSurvey,
	mockListSurveys,
	mockReviseNote,
	mockSurveyAudit,
	mockSurveyChecklist,
	mockTransitionSurvey,
	mockUpdateMeasurement,
	mockUpdateRoom,
	mockVerifyMeasurement
} from '../mock';

/**
 * Survey mock-server tests (phase-2 §5.4). Harness mirrors the properties
 * suite: in-memory storage, demo tenants/users installed explicitly, a seeded
 * survey tree and a signed-in surveyor.
 */

const OPULENT = DEMO_TENANTS[0];
const SURVEYOR_EMAIL = 'surveyor@opulentinteriors.co.uk';
const PM_EMAIL = 'production@opulentinteriors.co.uk';
const IN_PROGRESS = demoSurveyId(1, 1);
const VERIFIED = demoSurveyId(1, 2);
const SUBMITTED = demoSurveyId(2, 1);

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
	return [1, 2, 3].map((n) => ({
		id: demoCustomerId(n),
		tenantId: OPULENT.id,
		caption: `Customer ${n}`,
		contactName: `Contact ${n}`,
		email: `customer${n}@example.com`,
		phone: null,
		addressLine1: `${n} Demo Street`,
		addressLine2: null,
		town: 'London',
		postcode: `N1 ${n}AA`,
		preferredChannel: 'email',
		source: 'survey',
		leadUuid: null,
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(100),
		updatedAt: demoDays(10),
		createdBy: null,
		archivedAt: null
	}));
}

function propertyRecords(): PropertyRecord[] {
	return [1, 2, 3].map((n) => ({
		id: demoPropertyId(n),
		tenantId: OPULENT.id,
		customerId: demoCustomerId(n),
		addressLine1: `${n} Demo Street`,
		addressLine2: null,
		town: 'London',
		postcode: `N1 ${n}AA`,
		accessNotes: null,
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(100),
		updatedAt: demoDays(10),
		createdBy: null,
		archivedAt: null
	}));
}

function projectRecords(): ProjectRecord[] {
	return [1, 2, 3].map((n) => ({
		id: demoProjectId(n),
		tenantId: OPULENT.id,
		customerId: demoCustomerId(n),
		propertyId: demoPropertyId(n),
		caption: `Project ${n}`,
		reference: `OIG-2026-000${n}`,
		projectType: 'kitchen',
		status: 'active',
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: demoDays(100),
		updatedAt: demoDays(10),
		createdBy: null,
		archivedAt: null
	}));
}

function assignmentRecords(): ProjectUserRecord[] {
	return [
		{ projectN: 1, userId: demoSurveyorId('surveyor') },
		{ projectN: 2, userId: demoSurveyorId('surveyor-2') },
		{ projectN: 3, userId: demoSurveyorId('surveyor-3') }
	].map((entry) => ({
		id: deterministicUuid(`project-user:${entry.projectN}:test`),
		tenantId: OPULENT.id,
		projectId: demoProjectId(entry.projectN),
		userId: entry.userId,
		assignedAt: demoDays(60),
		assignedBy: null
	}));
}

function measurementInput(overrides: Partial<CreateMeasurementInput> = {}): CreateMeasurementInput {
	return {
		surveyRoomId: demoSurveyRoomId(1, 1, 1),
		targetType: 'ceiling_height',
		valueMm: 2500,
		source: 'laser',
		...overrides
	};
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
	setCollection(COLLECTIONS.properties, propertyRecords());
	setCollection(COLLECTIONS.projects, projectRecords());
	setCollection(COLLECTIONS.projectUsers, assignmentRecords());
}

async function expectApiError(operation: Promise<unknown>, code: string): Promise<ApiError> {
	try {
		await operation;
	} catch (error) {
		expect(isApiError(error)).toBe(true);
		const apiError = error as ApiError;
		expect(apiError.code).toBe(code);
		return apiError;
	}
	throw new Error(`Expected an ApiError with code ${code}.`);
}

beforeEach(() => {
	installStorage();
	resetMockDb();
	installDemoWorld();
	signIn(SURVEYOR_EMAIL);
});

afterEach(() => {
	session.clearSession();
	delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('survey seed', () => {
	it('lists only the signed-in surveyor’s assigned surveys by default', async () => {
		const page = await mockListSurveys({});

		expect(page.total).toBe(2);
		expect(page.items.map((row) => row.id).sort()).toEqual([IN_PROGRESS, VERIFIED].sort());
		expect(page.items.every((row) => row.projectId === demoProjectId(1))).toBe(true);
		const live = page.items.find((row) => row.id === IN_PROGRESS);
		expect(live?.criticalUnverifiedCount).toBe(3);
		expect(live?.roomCount).toBe(5);
		expect(live?.surveyorName).toBe('Aisha Khan');
	});

	it('returns the complete in-progress tree with the spec fixtures', async () => {
		const detail = await mockGetSurvey(IN_PROGRESS);

		expect(detail.rooms).toHaveLength(5);
		expect(detail.survey.status).toBe('in_progress');
		expect(detail.counts.measurements).toBe(18);
		expect(detail.counts.criticalUnverified).toBe(3);
		expect(detail.rooms.some((tree) => tree.room.ceilingHeightMm === null)).toBe(true);

		const unattached = detail.rooms
			.flatMap((tree) => tree.openings)
			.find((opening) => opening.unattached);
		expect(unattached?.surveyWallId).toBeNull();

		const lidar = detail.rooms
			.flatMap((tree) => tree.measurements)
			.find((measurement) => measurement.source === 'lidar');
		expect(lidar?.deviceInfo).toBe('Leica BLK2GO');
	});

	it('keeps the conflict fixture at 2400 mm, critical and unverified', async () => {
		const measurements = getCollection<SurveyMeasurementRecord>(COLLECTIONS.surveyMeasurements);
		const fixture = measurements.find((row) => row.id === demoSurveyMeasurementId(1, 1, 1, 1));

		expect(fixture).toMatchObject({
			targetType: 'ceiling_height',
			valueMm: 2400,
			isManufacturingCritical: true,
			verifiedAt: null,
			updatedAt: demoDays(2)
		});
	});
});

describe('submit checklist and G8', () => {
	it('names every blocking reason, and keeps room photos non-blocking', async () => {
		const checklist = await mockSurveyChecklist(IN_PROGRESS);

		expect(checklist.canSubmit).toBe(false);
		expect(checklist.blockingReasons.some((reason) => reason.includes('Rear hall'))).toBe(true);
		const photos = checklist.items.find((item) => item.id === 'room_photos');
		expect(photos?.blocking).toBe(false);
		expect(checklist.criticalUnverified).toHaveLength(3);
	});

	it('blocks submit with gate_blocked until the missing ceiling is captured', async () => {
		const error = await expectApiError(
			mockTransitionSurvey(IN_PROGRESS, { action: 'submit' }),
			ApiErrorCode.GATE_BLOCKED
		);
		const detail = error.details as { gate: string; blocking_reasons: string[] };
		expect(detail.gate).toBe('submit');
		expect(detail.blocking_reasons.some((reason) => reason.includes('Rear hall'))).toBe(true);

		await mockUpdateRoom((await mockGetSurvey(IN_PROGRESS)).rooms[4].room.id, {
			ceilingHeightMm: 2400
		});

		const after = await mockSurveyChecklist(IN_PROGRESS);
		expect(after.canSubmit).toBe(true);
		const submitted = await mockTransitionSurvey(IN_PROGRESS, { action: 'submit' });
		expect(submitted.status).toBe('submitted');
		expect(submitted.submittedAt).not.toBeNull();
	});

	it('blocks verify until every critical measurement is verified (G8)', async () => {
		await mockUpdateRoom((await mockGetSurvey(IN_PROGRESS)).rooms[4].room.id, {
			ceilingHeightMm: 2400
		});
		await mockTransitionSurvey(IN_PROGRESS, { action: 'submit' });
		const error = await expectApiError(
			mockTransitionSurvey(IN_PROGRESS, { action: 'verify' }),
			ApiErrorCode.GATE_BLOCKED
		);
		const detail = error.details as {
			gate: string;
			blocking_reasons: string[];
			critical_unverified_ids: string[];
		};
		expect(detail.gate).toBe('verify');
		const unverified = (await mockCriticalMeasurements(IN_PROGRESS)).filter(
			(measurement) => measurement.verifiedAt === null
		);
		expect([...detail.critical_unverified_ids].sort()).toEqual(
			unverified.map((measurement) => measurement.id).sort()
		);

		for (const measurement of await mockCriticalMeasurements(IN_PROGRESS)) {
			if (measurement.verifiedAt === null) {
				await mockVerifyMeasurement(measurement.id, { method: 're_measure' });
			}
		}

		const verified = await mockTransitionSurvey(IN_PROGRESS, { action: 'verify' });
		expect(verified.status).toBe('verified');
		expect(verified.verifiedBy).toBeTruthy();
	});

	it('requires a verification method', async () => {
		const measurement = await mockCriticalMeasurements(IN_PROGRESS);
		const error = await expectApiError(
			mockVerifyMeasurement(measurement[0].id, {
				method: undefined as never
			}),
			ApiErrorCode.VALIDATION
		);
		expect(error.fieldErrors?.method).toBeTruthy();
	});
});

describe('transitions and immutability', () => {
	it('reopens with an audit trail and clears every verification', async () => {
		signIn(PM_EMAIL);
		const detail = await mockGetSurvey(VERIFIED);
		expect(detail.survey.status).toBe('verified');

		const reopened = await mockTransitionSurvey(VERIFIED, {
			action: 'reopen',
			reason: 'Client changed the wardrobe run.'
		});
		expect(reopened.status).toBe('submitted');
		expect(reopened.reopenCount).toBe(1);
		expect(reopened.verifiedAt).toBeNull();

		const roomIds = new Set(
			getCollection<SurveyRoomRecord>(COLLECTIONS.surveyRooms)
				.filter((room) => room.surveyId === VERIFIED)
				.map((room) => room.id)
		);
		const stillVerified = getCollection<SurveyMeasurementRecord>(
			COLLECTIONS.surveyMeasurements
		).filter((row) => roomIds.has(row.surveyRoomId) && row.verifiedAt !== null);
		expect(stillVerified).toHaveLength(0);

		const audit = await mockSurveyAudit(VERIFIED);
		expect(audit.some((row) => row.action === 'reopen')).toBe(true);
	});

	it('refuses to edit a verified survey without a reopen', async () => {
		const detail = await mockGetSurvey(VERIFIED);
		const error = await expectApiError(
			mockUpdateRoom(detail.rooms[0].room.id, { caption: 'Renamed' }),
			ApiErrorCode.STATE_CONFLICT
		);
		expect(error.message).toContain('Reopen the survey');
	});

	it('is idempotent for a repeated submission', async () => {
		await mockUpdateRoom((await mockGetSurvey(IN_PROGRESS)).rooms[4].room.id, {
			ceilingHeightMm: 2400
		});
		await mockTransitionSurvey(IN_PROGRESS, { action: 'submit' });
		const second = await mockTransitionSurvey(IN_PROGRESS, { action: 'submit' });
		expect(second.status).toBe('submitted');
	});

	it('refuses an illegal transition from a verified survey back to submitted', async () => {
		const error = await expectApiError(
			mockTransitionSurvey(VERIFIED, { action: 'submit' }),
			ApiErrorCode.STATE_CONFLICT
		);
		expect(error.status).toBe(409);
	});
});

describe('measurements and notes', () => {
	it('clears verification when a verified value is edited', async () => {
		const measurement = (await mockGetSurvey(IN_PROGRESS)).rooms[0].measurements.find(
			(row) => row.id === demoSurveyMeasurementId(1, 1, 1, 2)
		);
		expect(measurement?.verifiedAt).not.toBeNull();

		const updated = await mockUpdateMeasurement(measurement!.id, { valueMm: 4810 });
		expect(updated.valueMm).toBe(4810);
		expect(updated.verifiedAt).toBeNull();
		expect(updated.verifiedBy).toBeNull();

		const audit = await mockSurveyAudit(IN_PROGRESS);
		expect(audit.some((row) => row.action === 'measurement_reverify_required')).toBe(true);
	});

	it('refuses a custom measurement without a caption', async () => {
		const error = await expectApiError(
			mockCreateMeasurement(
				IN_PROGRESS,
				measurementInput({ targetType: 'other', targetCaption: null })
			),
			ApiErrorCode.VALIDATION
		);
		expect(error.fieldErrors?.targetCaption).toBeTruthy();
	});

	it('appends note revisions without mutating the original', async () => {
		const original = getCollection<SurveyNoteRecord>(COLLECTIONS.surveyNotes).find(
			(row) => row.id === demoSurveyNoteId(1, 1, 2)
		);
		expect(original?.revision).toBe(1);

		const revision = await mockReviseNote(original!.id, {
			body: 'Corrected: out of square by 6 mm.'
		});
		expect(revision.revision).toBe(2);
		expect(revision.supersedesNoteId).toBe(original!.id);

		const rows = getCollection<SurveyNoteRecord>(COLLECTIONS.surveyNotes);
		const unchanged = rows.find((row) => row.id === original!.id);
		expect(unchanged?.body).toBe(original!.body);
		expect(rows.filter((row) => row.supersedesNoteId === original!.id)).toHaveLength(1);
	});

	it('creates a room-level note and validates the room belongs to the survey', async () => {
		const note = await mockCreateNote(IN_PROGRESS, {
			category: 'observation',
			body: 'Skirting is proud of the wall by 4 mm.',
			surveyRoomId: (await mockGetSurvey(IN_PROGRESS)).rooms[1].room.id
		});
		expect(isUuid(note.id)).toBe(true);
		expect(note.surveyId).toBe(IN_PROGRESS);
	});
});

describe('scoping and tenancy', () => {
	it('hides other surveyors’ surveys from a capture-only user', async () => {
		const page = await mockListSurveys({ scope: 'all' });
		expect(page.items.every((row) => row.id !== SUBMITTED)).toBe(true);

		await expectApiError(mockGetSurvey(SUBMITTED), ApiErrorCode.NOT_FOUND);
	});

	it('lets the other assigned surveyor see the submitted survey', async () => {
		signIn('liam.oconnor@opulentinteriors.co.uk');
		const page = await mockListSurveys({});
		expect(page.items.map((row) => row.id)).toEqual([SUBMITTED]);
	});

	it('never leaks rows across tenants', async () => {
		signIn('owner@harbourfinch.co.uk');
		const page = await mockListSurveys({});
		expect(page.total).toBe(0);
		await expectApiError(mockGetSurvey(IN_PROGRESS), ApiErrorCode.NOT_FOUND);
	});

	it('records an audit event for every state change', async () => {
		await mockCreateNote(IN_PROGRESS, {
			category: 'general',
			body: 'Audit check.'
		});
		const audit = await mockSurveyAudit(IN_PROGRESS);
		expect(audit.length).toBeGreaterThan(0);
		const events = getCollection<AuditEventRecord>(COLLECTIONS.auditEvents);
		expect(events.length).toBeGreaterThan(0);
		expect(events.every((event) => event.subjectType === 'survey')).toBe(true);
	});
});
