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
	demoSurveyRoomId,
	demoSurveyorId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import type { AppUserRecord, ProjectRecord, ProjectUserRecord } from '$shared/data/records';
import { deterministicUuid } from '$shared/lib/deterministic';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { ApiError, ApiErrorCode, isApiError } from '$network/errors';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import { seedSurveys } from '$modules/surveys/data/seed';
import { MAX_ASSET_SIZE_BYTES, type InitAssetInput } from '../../domain/types';
import {
	mockAssetSignedUrl,
	mockCompleteAsset,
	mockGetAsset,
	mockInitAsset,
	mockListAssets,
	mockSetAssetState
} from '../mock';

/**
 * Asset mock-server tests (phase-2 §5.4). The harness installs the survey seed
 * as foreign keys so owner resolution and inherited permissions are real, not
 * stubbed; the asset seeder registers itself when `../mock` is imported.
 */

const OPULENT = DEMO_TENANTS[0];
const SURVEYOR_EMAIL = 'surveyor@opulentinteriors.co.uk';
const SURVEYOR_2_EMAIL = 'liam.oconnor@opulentinteriors.co.uk';
const DESIGNER_EMAIL = 'designer@opulentinteriors.co.uk';
const IN_PROGRESS = { projectN: 1, surveyN: 1 };
const IN_PROGRESS_ID = demoSurveyId(IN_PROGRESS.projectN, IN_PROGRESS.surveyN);

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
		id: deterministicUuid(`project-user:assets:${entry.projectN}`),
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

	const surveySeed = seedSurveys();
	for (const [name, rows] of Object.entries(surveySeed)) {
		setCollection(name, rows);
	}
}

function initInput(overrides: Partial<InitAssetInput> = {}): InitAssetInput {
	return {
		ownerType: 'room',
		ownerId: demoSurveyRoomId(IN_PROGRESS.projectN, IN_PROGRESS.surveyN, 2),
		assetKind: 'photo',
		fileName: 'dining-window.jpg',
		mimeType: 'image/jpeg',
		sizeBytes: 1_048_576,
		sha256: 'a'.repeat(64),
		caption: 'Dining window and sill',
		...overrides
	};
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

describe('asset seed and listing', () => {
	it('seeds metadata-only fixtures across every owner type', async () => {
		const all = await mockListAssets({});

		expect(all.total).toBe(8);
		const owners = new Set(all.items.map((asset) => asset.ownerType));
		expect(owners).toEqual(new Set(['survey', 'room', 'wall', 'opening']));
	});

	it('groups the survey tree for the media page and keeps newest first', async () => {
		const page = await mockListAssets({ surveyId: IN_PROGRESS_ID });

		expect(page.total).toBe(6);
		expect(page.items.length).toBe(page.total);
		const createdAt = page.items.map((asset) => asset.createdAt);
		expect([...createdAt].sort((first, second) => second.localeCompare(first))).toEqual(createdAt);
	});

	it('filters by owner and upload state', async () => {
		const failed = await mockListAssets({ uploadState: 'failed' });
		expect(failed.items).toHaveLength(1);
		expect(failed.items[0].uploadState).toBe('failed');

		const room = await mockListAssets({
			ownerType: 'room',
			ownerId: demoSurveyRoomId(IN_PROGRESS.projectN, IN_PROGRESS.surveyN, 1)
		});
		expect(room.items.every((asset) => asset.ownerType === 'room')).toBe(true);
	});

	it('never returns an asset its owner survey cannot be read from', async () => {
		signIn(SURVEYOR_2_EMAIL);
		await expectApiError(
			mockGetAsset(demoAssetId('live:kitchen:overview')),
			ApiErrorCode.NOT_FOUND
		);

		const page = await mockListAssets({});
		expect(page.items.every((asset) => asset.id !== demoAssetId('live:kitchen:overview'))).toBe(
			true
		);
	});
});

describe('asset init and integrity', () => {
	it('creates a pending row with a one-shot upload URL', async () => {
		const result = await mockInitAsset(initInput());

		expect(result.asset.uploadState).toBe('pending');
		expect(result.asset.signedUrl).toBeNull();
		expect(result.uploadUrl.startsWith('interio-mock://upload/')).toBe(true);
		expect(result.asset.ownerId).toBe(
			demoSurveyRoomId(IN_PROGRESS.projectN, IN_PROGRESS.surveyN, 2)
		);

		const stored = await mockGetAsset(result.asset.id);
		expect(stored.uploadState).toBe('pending');
	});

	it('rejects a MIME type that does not belong to the asset kind', async () => {
		const error = await expectApiError(
			mockInitAsset(initInput({ assetKind: 'photo', mimeType: 'application/pdf' })),
			ApiErrorCode.VALIDATION
		);
		expect(error.fieldErrors?.mimeType).toBeTruthy();
	});

	it('rejects a file above the size cap and a malformed checksum', async () => {
		const tooBig = await expectApiError(
			mockInitAsset(initInput({ sizeBytes: MAX_ASSET_SIZE_BYTES + 1 })),
			ApiErrorCode.VALIDATION
		);
		expect(tooBig.fieldErrors?.sizeBytes).toBeTruthy();

		const badSha = await expectApiError(
			mockInitAsset(initInput({ sha256: 'not-a-checksum' })),
			ApiErrorCode.VALIDATION
		);
		expect(badSha.fieldErrors?.sha256).toBeTruthy();
	});

	it('refuses to attach the same file to a second owner', async () => {
		await mockInitAsset(initInput());
		const error = await expectApiError(
			mockInitAsset(
				initInput({
					ownerId: demoSurveyRoomId(IN_PROGRESS.projectN, IN_PROGRESS.surveyN, 3)
				})
			),
			ApiErrorCode.CONFLICT
		);
		expect(error.message.includes('another record')).toBe(true);
	});

	it('requires the inherited write permission, not an asset code', async () => {
		signIn(DESIGNER_EMAIL);
		await expectApiError(mockInitAsset(initInput()), ApiErrorCode.FORBIDDEN);
	});

	it('ends a checksum mismatch as failed and never completes it', async () => {
		const pending = await mockGetAsset(demoAssetId('live:utility:queued'));
		expect(pending.uploadState).toBe('pending');

		const error = await expectApiError(
			mockCompleteAsset(pending.id, { sha256: 'f'.repeat(64) }),
			ApiErrorCode.CONFLICT
		);
		expect(error.details).toMatchObject({ uploadState: 'failed' });

		const failed = await mockGetAsset(pending.id);
		expect(failed.uploadState).toBe('failed');
		expect(failed.signedUrl).toBeNull();

		await expectApiError(
			mockCompleteAsset(pending.id, { sha256: failed.sha256 }),
			ApiErrorCode.STATE_CONFLICT
		);
	});

	it('completes with the matching checksum and issues a short-lived signed URL', async () => {
		const pending = await mockGetAsset(demoAssetId('live:utility:queued'));
		await mockSetAssetState(pending.id, { uploadState: 'uploading' });

		const completed = await mockCompleteAsset(pending.id, { sha256: pending.sha256 });
		expect(completed.uploadState).toBe('complete');
		expect(completed.signedUrl?.startsWith('interio-mock://asset/')).toBe(true);
		expect(new Date(completed.signedUrlExpiresAt ?? 0).getTime()).toBeGreaterThan(Date.now());

		const replay = await mockCompleteAsset(pending.id, { sha256: pending.sha256 });
		expect(replay.id).toBe(completed.id);

		const audit = getCollection<{ action: string; subjectId: string }>(
			COLLECTIONS.auditEvents
		).filter((row) => row.subjectId === pending.id);
		expect(audit.some((row) => row.action === 'asset.complete')).toBe(true);
	});
});

describe('asset upload state machine', () => {
	it('allows pending → uploading → failed and failed → uploading', async () => {
		const pending = await mockGetAsset(demoAssetId('live:utility:queued'));

		const uploading = await mockSetAssetState(pending.id, { uploadState: 'uploading' });
		expect(uploading.uploadState).toBe('uploading');

		const failed = await mockSetAssetState(pending.id, { uploadState: 'failed' });
		expect(failed.uploadState).toBe('failed');

		const retried = await mockSetAssetState(pending.id, { uploadState: 'uploading' });
		expect(retried.uploadState).toBe('uploading');
	});

	it('refuses to move a complete row and to skip the upload step', async () => {
		const complete = await mockGetAsset(demoAssetId('live:kitchen:overview'));
		await expectApiError(
			mockSetAssetState(complete.id, { uploadState: 'uploading' }),
			ApiErrorCode.STATE_CONFLICT
		);

		const pending = await mockGetAsset(demoAssetId('live:utility:queued'));
		const uploading = await mockSetAssetState(pending.id, { uploadState: 'uploading' });
		expect(uploading.uploadState).toBe('uploading');
		await expectApiError(
			mockSetAssetState(pending.id, { uploadState: 'pending' }),
			ApiErrorCode.STATE_CONFLICT
		);
	});

	it('issues signed URLs only for complete files', async () => {
		const complete = await mockGetAsset(demoAssetId('live:kitchen:overview'));
		const signed = await mockAssetSignedUrl(complete.id);
		expect(signed.url.startsWith('interio-mock://asset/')).toBe(true);

		const pending = await mockGetAsset(demoAssetId('live:utility:queued'));
		await expectApiError(mockAssetSignedUrl(pending.id), ApiErrorCode.STATE_CONFLICT);
	});
});
