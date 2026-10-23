import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));
vi.mock('$shared/application/connectivity.svelte', () => ({ isOnline: () => false }));

import { session } from '$shared/application/session';
import { COLLECTIONS } from '$shared/data/collections';
import {
	demoProjectId,
	demoSurveyId,
	demoSurveyMeasurementId,
	demoSurveyorId
} from '$shared/data/demo-record-plan';
import { demoDays } from '$shared/data/demo-clock';
import { DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import type { AppUserRecord, ProjectUserRecord, SyncOperationRecord } from '$shared/data/records';
import { deterministicUuid } from '$shared/lib/deterministic';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import { getSurveysRepository } from '../repository-provider';

/**
 * Offline seam tests (phase-2 §5.4): a write while the browser is offline
 * still lands locally and records exactly one outbox operation with the row
 * version captured before the write. The mobile shell owns draining; this
 * module never pushes.
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
		this.rows.set(key, String(value));
	}
}

function sessionUserFrom(record: AppUserRecord): SessionUser {
	const tenantRecord = DEMO_TENANTS.find((candidate) => candidate.id === record.tenantId);
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

beforeEach(() => {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		writable: true,
		value: new MemoryStorage()
	});
	resetMockDb();
	setCollection(
		COLLECTIONS.tenants,
		DEMO_TENANTS.map((tenant) => ({ ...tenant }))
	);
	setCollection(
		COLLECTIONS.appUsers,
		DEMO_USERS.map((user) => ({ ...user }))
	);
	const projectUsers: ProjectUserRecord[] = [
		{
			id: deterministicUuid('project-user:offline:1'),
			tenantId: DEMO_TENANTS[0].id,
			projectId: demoProjectId(1),
			userId: demoSurveyorId('surveyor'),
			assignedAt: demoDays(60),
			assignedBy: null
		}
	];
	setCollection(COLLECTIONS.projectUsers, projectUsers);
	const surveyor = DEMO_USERS.find((user) => user.email === 'surveyor@opulentinteriors.co.uk');
	if (!surveyor) throw new Error('Surveyor demo user is missing.');
	session.setUser(sessionUserFrom(surveyor));
});

afterEach(() => {
	session.clearSession();
	delete (globalThis as { localStorage?: Storage }).localStorage;
});

function outbox(): SyncOperationRecord[] {
	return getCollection<SyncOperationRecord>(COLLECTIONS.syncOperations);
}

describe('offline survey writes', () => {
	it('applies the measurement edit locally and queues one operation', async () => {
		const repository = getSurveysRepository();
		const measurementId = demoSurveyMeasurementId(1, 1, 1, 2);

		const updated = await repository.updateMeasurement(measurementId, { valueMm: 4810 });
		expect(updated.valueMm).toBe(4810);

		const rows = outbox();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			entity: 'measurement',
			op: 'update',
			localId: measurementId,
			baseUpdatedAt: '2026-10-20T09:00:00.000Z',
			state: 'queued',
			attempts: 0
		});
		expect(rows[0].payload.valueMm).toBe(4810);

		// The local read sees the offline write immediately.
		const detail = await repository.get(demoSurveyId(1, 1));
		const measurement = detail.rooms
			.flatMap((tree) => tree.measurements)
			.find((row) => row.id === measurementId);
		expect(measurement?.valueMm).toBe(4810);
	});

	it('queues a survey transition with its target status', async () => {
		const repository = getSurveysRepository();
		await repository.transition(demoSurveyId(1, 1), {
			action: 'start'
		});

		const operation = outbox()[0];
		expect(operation).toMatchObject({
			entity: 'survey',
			op: 'transition',
			localId: demoSurveyId(1, 1),
			baseUpdatedAt: '2026-10-20T09:00:00.000Z'
		});
		expect(operation.payload).toMatchObject({
			action: 'start',
			to: 'in_progress'
		});
	});

	it('queues a room creation with the final row values', async () => {
		const repository = getSurveysRepository();
		const room = await repository.createRoom(demoSurveyId(1, 1), {
			caption: 'Pantry',
			roomType: 'kitchen',
			shapeNotes: 'Narrow.'
		});

		expect(outbox()).toHaveLength(1);
		expect(outbox()[0]).toMatchObject({
			entity: 'room',
			op: 'create',
			localId: room.id,
			baseUpdatedAt: null
		});
		expect(outbox()[0].payload).toMatchObject({ caption: 'Pantry', id: room.id });
	});
});
