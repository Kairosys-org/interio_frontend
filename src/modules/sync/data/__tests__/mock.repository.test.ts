import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));

import { session } from '$shared/application/session';
import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import {
	demoAssetId,
	demoCustomerId,
	demoProjectId,
	demoPropertyId,
	demoSurveyId,
	demoSurveyMeasurementId,
	demoSurveyorId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import type {
	AppUserRecord,
	ProjectRecord,
	ProjectUserRecord,
	SurveyMeasurementRecord
} from '$shared/data/records';
import { deterministicUuid } from '$shared/lib/deterministic';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { ApiError, ApiErrorCode, isApiError } from '$network/errors';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import { seedAssets } from '$modules/assets/data/seed';
import { seedSurveys } from '$modules/surveys/data/seed';
import { enqueueOutbox } from '../outbox';
import {
	mockClearSent,
	mockLocalIdFor,
	mockPendingCounts,
	mockPull,
	mockPush,
	mockResolveConflict,
	mockRetry,
	mockSyncOperation,
	mockSyncOperations
} from '../mock';

/**
 * Sync mock-transport tests (phase-2 §5.3/§5.4): the seeded conflict, the
 * deterministic transient failure, idempotent replay, conflict resolution and
 * the project/assignment-filtered pull.
 */

const OPULENT = DEMO_TENANTS[0];
const SURVEYOR_EMAIL = 'surveyor@opulentinteriors.co.uk';
const SURVEYOR_2_EMAIL = 'liam.oconnor@opulentinteriors.co.uk';
const CONFLICT_KEY = '0199c6f4-8a2b-7c4d-9e6f-1a2b3c4d5e6f';
const ASSET_KEY = '0199c6f4-8a2b-7c4d-9e6f-2b3c4d5e6f70';
const CONFLICT_MEASUREMENT = demoSurveyMeasurementId(1, 1, 1, 1);

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
		id: deterministicUuid(`project-user:sync:${entry.projectN}`),
		tenantId: OPULENT.id,
		projectId: demoProjectId(entry.projectN),
		userId: entry.userId,
		assignedAt: demoDays(60),
		assignedBy: null
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
	setCollection(COLLECTIONS.projects, projectRecords());
	setCollection(COLLECTIONS.projectUsers, assignmentRecords());

	for (const [name, rows] of Object.entries(seedSurveys())) {
		setCollection(name, rows);
	}
	for (const [name, rows] of Object.entries(seedAssets())) {
		setCollection(name, rows);
	}
}

function measurement(): SurveyMeasurementRecord {
	const row = getCollection<SurveyMeasurementRecord>(COLLECTIONS.surveyMeasurements).find(
		(candidate) => candidate.id === CONFLICT_MEASUREMENT
	);
	if (!row) throw new Error('Conflict measurement fixture is missing.');
	return row;
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

describe('sync seed and pending counts', () => {
	it('starts with a queued conflict and a queued asset state', async () => {
		const counts = await mockPendingCounts();
		expect(counts.queued).toBe(2);
		expect(counts.unsent).toBe(2);
		expect(counts.assetsPending).toBe(1);
		expect(counts.assetsFailed).toBe(1);

		const operations = await mockSyncOperations();
		expect(operations.map((operation) => operation.idempotencyKey)).toEqual([
			CONFLICT_KEY,
			ASSET_KEY
		]);
	});

	it('keeps the conflict fixture in the spec shape', async () => {
		const operation = await mockSyncOperation(CONFLICT_KEY);
		expect(operation).toMatchObject({
			entity: 'measurement',
			op: 'update',
			localId: CONFLICT_MEASUREMENT,
			payload: { valueMm: 2450 },
			state: 'queued',
			baseUpdatedAt: demoDays(30),
			createdAt: demoDays(29)
		});
	});
});

describe('push: conflict, transient failure and replay', () => {
	it('keeps the server value on a moved row and names both versions', async () => {
		const result = await mockPush();

		expect(result.conflicts).toBe(1);
		expect(result.failed).toBe(1);
		expect(result.applied).toBe(0);

		const conflict = result.results.find((entry) => entry.idempotencyKey === CONFLICT_KEY);
		expect(conflict?.state).toBe('conflict');
		expect(conflict?.conflict?.server.valueMm).toBe(2400);
		expect(conflict?.conflict?.local.valueMm).toBe(2450);
		expect(conflict?.conflict?.serverUpdatedAt).toBe(demoDays(2));
		expect(conflict?.conflict?.fields).toContain('valueMm');

		expect(measurement().valueMm).toBe(2400);
		expect((await mockSyncOperation(CONFLICT_KEY)).state).toBe('conflict');
	});

	it('fails an asset-state op once, then applies it on the next push', async () => {
		await mockPush();
		expect((await mockSyncOperation(ASSET_KEY)).state).toBe('failed');
		expect((await mockPendingCounts()).assetsUploading).toBe(0);

		const second = await mockPush();
		expect(second.failed).toBe(0);
		expect(second.applied).toBe(1);
		expect((await mockSyncOperation(ASSET_KEY)).state).toBe('sent');

		const asset = await mockPendingCounts();
		expect(asset.assetsUploading).toBe(1);
		expect(asset.assetsPending).toBe(0);
	});

	it('never duplicates an operation with the same idempotency key', async () => {
		const before = (await mockSyncOperations()).length;
		const operation = await mockSyncOperation(CONFLICT_KEY);

		enqueueOutbox({
			entity: 'measurement',
			op: 'update',
			localId: CONFLICT_MEASUREMENT,
			payload: { valueMm: 2450 },
			baseUpdatedAt: demoDays(30),
			idempotencyKey: CONFLICT_KEY
		});

		const after = await mockSyncOperations();
		expect(after).toHaveLength(before);
		expect(after.filter((row) => row.idempotencyKey === CONFLICT_KEY)).toHaveLength(1);
		expect((await mockSyncOperation(CONFLICT_KEY)).id).toBe(operation.id);

		const result = await mockPush();
		expect(result.results.filter((entry) => entry.idempotencyKey === CONFLICT_KEY)).toHaveLength(1);
	});
});

describe('conflict resolution', () => {
	it('accepts the server version without changing the row', async () => {
		await mockPush();
		const resolved = await mockResolveConflict(CONFLICT_KEY, { decision: 'accept_server' });

		expect(resolved.state).toBe('sent');
		expect(resolved.conflict).toBeNull();
		expect(measurement().valueMm).toBe(2400);
	});

	it('re-applies the chosen local fields after an explicit re-queue', async () => {
		await mockPush();
		const requeued = await mockResolveConflict(CONFLICT_KEY, {
			decision: 'reapply_local',
			fields: ['valueMm']
		});

		expect(requeued.state).toBe('queued');
		expect(requeued.conflict).toBeNull();
		expect(requeued.payload).toEqual({ valueMm: 2450 });
		expect(requeued.baseUpdatedAt).toBe(demoDays(2));

		const pushed = await mockPush();
		expect(pushed.conflicts).toBe(0);
		expect(pushed.applied).toBe(2);
		expect(measurement().valueMm).toBe(2450);
		expect(measurement().updatedAt > demoDays(2)).toBe(true);
		expect((await mockSyncOperation(CONFLICT_KEY)).state).toBe('sent');
	});

	it('refuses to retry a conflict and to resolve a non-conflict', async () => {
		await expectApiError(
			mockResolveConflict(CONFLICT_KEY, { decision: 'accept_server' }),
			ApiErrorCode.STATE_CONFLICT
		);

		await mockPush();
		await expectApiError(mockRetry(CONFLICT_KEY), ApiErrorCode.STATE_CONFLICT);
	});

	it('re-queues a failed operation for retry', async () => {
		await mockPush();
		expect((await mockSyncOperation(ASSET_KEY)).state).toBe('failed');

		const retried = await mockRetry(ASSET_KEY);
		expect(retried.state).toBe('queued');
		expect(retried.lastError).toBeNull();
	});
});

describe('pull and housekeeping', () => {
	it('pulls only the requested project, parents before children, then advances the cursor', async () => {
		const result = await mockPull({ projectId: demoProjectId(1) });
		const entities = result.changes.map((change) => change.entity);

		expect(result.changes.length).toBeGreaterThan(0);
		expect(entities.indexOf('survey')).toBeLessThan(entities.indexOf('room'));
		expect(entities.indexOf('room')).toBeLessThan(entities.indexOf('measurement'));
		expect(result.changes.some((change) => change.id === demoSurveyId(2, 1))).toBe(false);
		expect(result.cursor).toBeTruthy();

		const next = await mockPull({ projectId: demoProjectId(1), since: result.cursor });
		expect(next.changes).toHaveLength(0);
		expect(next.cursor).toBe(result.cursor);
	});

	it('hides another surveyor’s project from a capture-only pull', async () => {
		signIn(SURVEYOR_2_EMAIL);
		const result = await mockPull({ projectId: demoProjectId(1) });
		expect(result.changes).toHaveLength(0);

		const all = await mockPull();
		const surveyChanges = all.changes.filter((change) => change.entity === 'survey');
		expect(surveyChanges.some((change) => change.id === demoSurveyId(1, 1))).toBe(false);
		expect(surveyChanges.some((change) => change.id === demoSurveyId(2, 1))).toBe(true);
	});

	it('clears sent rows only and resolves local ids', async () => {
		await mockPush();
		await mockResolveConflict(CONFLICT_KEY, { decision: 'accept_server' });

		expect(await mockLocalIdFor(CONFLICT_KEY)).toBe(CONFLICT_MEASUREMENT);
		expect(await mockClearSent()).toBe(1);
		expect(await mockSyncOperations()).toHaveLength(1);
		expect((await mockSyncOperation(ASSET_KEY)).state).toBe('failed');
		expect(await mockLocalIdFor(ASSET_KEY)).toBe(demoAssetId('live:utility:queued'));
	});
});
