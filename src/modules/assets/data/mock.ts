import type { ZodError, ZodType } from 'zod';
import { recordTenantAudit } from '$shared/data/audit';
import { COLLECTIONS } from '$shared/data/collections';
import { requireTenantSession, type TenantSession } from '$shared/data/mock-session';
import type {
	AssetRecord,
	DecorRecord,
	ProjectUserRecord,
	SurveyOpeningRecord,
	SurveyRecord,
	SurveyRoomRecord,
	SurveyWallRecord
} from '$shared/data/records';
import { toPage } from '$shared/domain/pagination';
import { ROLES } from '$shared/domain/roles';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, registerSeeder, updateCollection } from '$network/mock-backend';
import {
	ASSET_OWNER_PERMISSIONS,
	type Asset,
	type AssetInitResult,
	type AssetKind,
	type AssetListParams,
	type AssetOwnerType,
	type AssetPage,
	type AssetSignedUrl,
	type AssetStateInput,
	type CompleteAssetInput,
	type InitAssetInput
} from '../domain/types';
import { assetFormSchema, assetStateSchema, completeAssetSchema } from '../domain/validations';
import { seedAssets } from './seed';

/**
 * Asset mock server (architecture §4.6, spec Part 9 §12, Part 4 §12).
 *
 * Assets inherit the owner's permission: there is no `asset.*` code, so every
 * call resolves owner → survey and checks `survey.view`/`survey.update`, plus
 * the capture-only scope rule. Integrity is proveable: a checksum mismatch
 * moves the row to `failed` and `complete` can only be reached from
 * `pending`/`uploading` with a matching `sha256`.
 */

registerSeeder(seedAssets);

const ASSET = 'asset';
const SIGNED_URL_TTL_MS = 15 * 60 * 1000;
const UPLOAD_URL_TTL_MS = 30 * 60 * 1000;

function notFound(message = 'Asset not found.'): ApiError {
	return new ApiError({ code: ApiErrorCode.NOT_FOUND, status: 404, message });
}

function conflict(message: string): ApiError {
	return new ApiError({ code: ApiErrorCode.CONFLICT, status: 409, message });
}

function stateConflict(message: string): ApiError {
	return new ApiError({ code: ApiErrorCode.STATE_CONFLICT, status: 409, message });
}

function validation(message: string, fieldErrors?: Record<string, string>): ApiError {
	return new ApiError({
		code: ApiErrorCode.VALIDATION,
		status: 400,
		message,
		fieldErrors
	});
}

function fieldErrorsFrom(error: ZodError): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.') || 'form';
		if (!(key in errors)) errors[key] = issue.message;
	}
	return errors;
}

function mapZodError(error: ZodError): ApiError {
	return validation('Check the highlighted fields and try again.', fieldErrorsFrom(error));
}

function parseInput<T>(schema: ZodType<T>, input: unknown): T {
	const result = schema.safeParse(input);
	if (!result.success) throw mapZodError(result.error);
	return result.data;
}

const nowIso = (): string => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* Collection helpers                                                  */
/* ------------------------------------------------------------------ */

function allAssets(): AssetRecord[] {
	return getCollection<AssetRecord>(COLLECTIONS.assets);
}

function tenantAssets(tenantId: string): AssetRecord[] {
	return allAssets().filter((row) => row.tenantId === tenantId);
}

function findAssetRecord(id: string, tenantId: string): AssetRecord {
	const asset = allAssets().find((row) => row.tenantId === tenantId && row.id === id);
	if (!asset) throw notFound();
	return asset;
}

/** Capture-only surveyors see their own surveys on projects still assigned. */
function isCaptureOnly(user: { roles: string[] }): boolean {
	return user.roles.includes(ROLES.SURVEYOR) && !user.roles.includes(ROLES.PRODUCTION_MANAGER);
}

function assignedToProject(tenantId: string, projectId: string, userId: string): boolean {
	return getCollection<ProjectUserRecord>(COLLECTIONS.projectUsers).some(
		(row) => row.tenantId === tenantId && row.projectId === projectId && row.userId === userId
	);
}

interface OwnerContext {
	/** Null for decor sample assets, which live outside the survey tree. */
	survey: SurveyRecord | null;
}

/**
 * Resolves the single owner to its survey (or to the decor itself). Tenancy is
 * re-checked at every hop so a guessed id from another tenant ends as a 404,
 * never a cross-tenant read.
 */
function resolveOwner(ownerType: AssetOwnerType, ownerId: string, tenantId: string): OwnerContext {
	if (ownerType === 'survey') {
		return { survey: findSurveyRecord(ownerId, tenantId) };
	}

	if (ownerType === 'room') {
		const room = findRoomRecord(ownerId, tenantId);
		return { survey: findSurveyRecord(room.surveyId, tenantId) };
	}

	if (ownerType === 'wall') {
		const wall = getCollection<SurveyWallRecord>(COLLECTIONS.surveyWalls).find(
			(row) => row.tenantId === tenantId && row.id === ownerId
		);
		if (!wall) throw notFound('The record this file belongs to was not found.');
		const room = findRoomRecord(wall.surveyRoomId, tenantId);
		return { survey: findSurveyRecord(room.surveyId, tenantId) };
	}

	if (ownerType === 'decor') {
		const decor = getCollection<DecorRecord>(COLLECTIONS.decors).find(
			(row) => row.tenantId === tenantId && row.id === ownerId
		);
		if (!decor) throw notFound('The record this file belongs to was not found.');
		return { survey: null };
	}

	const opening = getCollection<SurveyOpeningRecord>(COLLECTIONS.surveyOpenings).find(
		(row) => row.tenantId === tenantId && row.id === ownerId
	);
	if (!opening) throw notFound('The record this file belongs to was not found.');
	const room = findRoomRecord(opening.surveyRoomId, tenantId);
	return { survey: findSurveyRecord(room.surveyId, tenantId) };
}

function findSurveyRecord(id: string, tenantId: string): SurveyRecord {
	const survey = getCollection<SurveyRecord>(COLLECTIONS.surveys).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!survey) throw notFound('The record this file belongs to was not found.');
	return survey;
}

function findRoomRecord(id: string, tenantId: string): SurveyRoomRecord {
	const room = getCollection<SurveyRoomRecord>(COLLECTIONS.surveyRooms).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!room) throw notFound('The record this file belongs to was not found.');
	return room;
}

function assertCanRead(
	session: TenantSession,
	ownerType: AssetOwnerType,
	owner: OwnerContext
): void {
	const { user, tenantId } = session;
	const inherited = ASSET_OWNER_PERMISSIONS[ownerType];
	if (!user.permissions.includes(inherited.view)) {
		throw new ApiError({
			code: ApiErrorCode.FORBIDDEN,
			status: 403,
			message: 'You do not have permission to perform this action.'
		});
	}
	if (owner.survey === null) return;
	if (!isCaptureOnly(user)) return;
	if (
		owner.survey.surveyorId !== user.id ||
		!assignedToProject(tenantId, owner.survey.projectId, user.id)
	) {
		throw notFound();
	}
}

/** Inherited write permission + the survey machine's editability rule. */
function assertCanWrite(
	session: TenantSession,
	ownerType: AssetOwnerType,
	owner: OwnerContext
): void {
	const { user, tenantId } = session;
	const inherited = ASSET_OWNER_PERMISSIONS[ownerType];
	if (!user.permissions.includes(inherited.write)) {
		throw new ApiError({
			code: ApiErrorCode.FORBIDDEN,
			status: 403,
			message: 'You do not have permission to change this file.'
		});
	}
	if (owner.survey === null) return;
	if (owner.survey.status === 'cancelled') {
		throw stateConflict('This survey was cancelled and can no longer be edited.');
	}
	if (owner.survey.status === 'verified') {
		throw stateConflict('Reopen the survey before editing verified data.');
	}
	if (isCaptureOnly(user)) {
		if (
			owner.survey.surveyorId !== user.id ||
			!assignedToProject(tenantId, owner.survey.projectId, user.id)
		) {
			throw notFound();
		}
	}
}

function toAsset(row: AssetRecord): Asset {
	return {
		...row,
		ownerType: row.ownerType as AssetOwnerType,
		assetKind: row.assetKind as AssetKind
	};
}

function auditAsset(
	tenantId: string,
	assetId: string,
	action: string,
	payload?: Record<string, unknown>
): void {
	recordTenantAudit({
		tenantId,
		action,
		subjectType: ASSET,
		subjectId: assetId,
		payload: payload ?? null
	});
}

function issuedSignedUrl(assetId: string): AssetSignedUrl {
	const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS).toISOString();
	const token = newUuid();
	return {
		url: `interio-mock://asset/${assetId}?token=${token}&expires=${encodeURIComponent(expiresAt)}`,
		expiresAt
	};
}

function replaceAsset(updated: AssetRecord): void {
	updateCollection<AssetRecord>(COLLECTIONS.assets, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
}

/* ------------------------------------------------------------------ */
/* Repository implementation                                           */
/* ------------------------------------------------------------------ */

export async function mockListAssets(params: AssetListParams = {}): Promise<AssetPage> {
	const session = requireTenantSession();
	const rows = tenantAssets(session.tenantId)
		.flatMap((row) => {
			const ownerType = row.ownerType as AssetOwnerType;
			try {
				const owner = resolveOwner(ownerType, row.ownerId, session.tenantId);
				assertCanRead(session, ownerType, owner);
				return [{ row, owner }];
			} catch {
				return [];
			}
		})
		.filter(
			({ row }) =>
				(params.ownerType === undefined || row.ownerType === params.ownerType) &&
				(params.ownerId === undefined || row.ownerId === params.ownerId)
		)
		.filter(({ owner }) => params.surveyId === undefined || owner.survey?.id === params.surveyId)
		.filter(
			({ row }) =>
				params.uploadState === undefined ||
				params.uploadState === 'all' ||
				row.uploadState === params.uploadState
		)
		.sort(
			(first, second) =>
				second.row.createdAt.localeCompare(first.row.createdAt) ||
				first.row.id.localeCompare(second.row.id)
		)
		.map(({ row }) => toAsset(row));

	return toPage(rows, { page: params.page, pageSize: params.pageSize });
}

export async function mockGetAsset(id: string): Promise<Asset> {
	const session = requireTenantSession();
	const row = findAssetRecord(id, session.tenantId);
	const ownerType = row.ownerType as AssetOwnerType;
	assertCanRead(session, ownerType, resolveOwner(ownerType, row.ownerId, session.tenantId));
	return toAsset(row);
}

export async function mockInitAsset(input: InitAssetInput): Promise<AssetInitResult> {
	const session = requireTenantSession();
	const values = parseInput(assetFormSchema, input);
	const owner = resolveOwner(values.ownerType, values.ownerId, session.tenantId);
	assertCanWrite(session, values.ownerType, owner);

	const sameOwner = tenantAssets(session.tenantId).some(
		(row) =>
			row.sha256 === values.sha256 &&
			row.fileName === values.fileName &&
			!(row.ownerType === values.ownerType && row.ownerId === values.ownerId)
	);
	if (sameOwner) {
		throw conflict('This file is already attached to another record.');
	}

	const now = nowIso();
	const row: AssetRecord = {
		id: newUuid(),
		tenantId: session.tenantId,
		ownerType: values.ownerType,
		ownerId: values.ownerId,
		assetKind: values.assetKind,
		fileName: values.fileName,
		mimeType: values.mimeType,
		sizeBytes: values.sizeBytes,
		sha256: values.sha256,
		uploadState: 'pending',
		caption: values.caption,
		signedUrl: null,
		signedUrlExpiresAt: null,
		capturedAt: values.capturedAt,
		deviceModel: values.deviceModel,
		orientation: values.orientation,
		uploadedBy: session.user.id,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<AssetRecord>(COLLECTIONS.assets, (rows) => [...rows, row]);
	auditAsset(session.tenantId, row.id, 'asset.init', {
		ownerType: row.ownerType,
		ownerId: row.ownerId,
		fileName: row.fileName
	});

	return {
		asset: toAsset(row),
		uploadUrl: `interio-mock://upload/${row.id}?token=${newUuid()}`,
		expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_MS).toISOString()
	};
}

export async function mockCompleteAsset(id: string, input: CompleteAssetInput): Promise<Asset> {
	const session = requireTenantSession();
	const values = parseInput(completeAssetSchema, input);
	const row = findAssetRecord(id, session.tenantId);
	const ownerType = row.ownerType as AssetOwnerType;
	const owner = resolveOwner(ownerType, row.ownerId, session.tenantId);
	assertCanWrite(session, ownerType, owner);

	if (row.uploadState === 'complete') {
		if (values.sha256 === row.sha256) return toAsset(row);
		throw stateConflict('This upload is already complete.');
	}
	if (row.uploadState === 'failed') {
		throw stateConflict('Retry the upload before completing it.');
	}

	if (values.sha256 !== row.sha256) {
		const failed: AssetRecord = {
			...row,
			uploadState: 'failed',
			signedUrl: null,
			signedUrlExpiresAt: null,
			updatedAt: nowIso()
		};
		replaceAsset(failed);
		auditAsset(session.tenantId, row.id, 'asset.integrity_failed', {
			expected: row.sha256,
			received: values.sha256
		});
		throw new ApiError({
			code: ApiErrorCode.CONFLICT,
			status: 409,
			message: 'The file did not match its checksum. Upload it again.',
			details: { uploadState: 'failed', asset: toAsset(failed) }
		});
	}

	const signed = issuedSignedUrl(row.id);
	const completed: AssetRecord = {
		...row,
		uploadState: 'complete',
		signedUrl: signed.url,
		signedUrlExpiresAt: signed.expiresAt,
		updatedAt: nowIso()
	};
	replaceAsset(completed);
	auditAsset(session.tenantId, row.id, 'asset.complete', {
		fileName: row.fileName,
		sizeBytes: row.sizeBytes
	});
	return toAsset(completed);
}

export async function mockSetAssetState(id: string, input: AssetStateInput): Promise<Asset> {
	const session = requireTenantSession();
	const values = parseInput(assetStateSchema, input);
	const row = findAssetRecord(id, session.tenantId);
	const ownerType = row.ownerType as AssetOwnerType;
	const owner = resolveOwner(ownerType, row.ownerId, session.tenantId);
	assertCanWrite(session, ownerType, owner);

	const target = values.uploadState;
	if (row.uploadState === 'complete') {
		throw stateConflict('A completed upload cannot change state.');
	}
	if (row.uploadState === target) {
		return toAsset(row);
	}
	const allowed =
		(row.uploadState === 'pending' && (target === 'uploading' || target === 'failed')) ||
		(row.uploadState === 'uploading' && target === 'failed') ||
		(row.uploadState === 'failed' && target === 'uploading');
	if (!allowed) {
		throw stateConflict(`An upload cannot move from ${row.uploadState} to ${target}.`);
	}

	const updated: AssetRecord = {
		...row,
		uploadState: target,
		signedUrl: null,
		signedUrlExpiresAt: null,
		updatedAt: nowIso()
	};
	replaceAsset(updated);
	auditAsset(session.tenantId, row.id, 'asset.state', {
		from: row.uploadState,
		to: target
	});
	return toAsset(updated);
}

export async function mockAssetSignedUrl(id: string): Promise<AssetSignedUrl> {
	const session = requireTenantSession();
	const row = findAssetRecord(id, session.tenantId);
	const ownerType = row.ownerType as AssetOwnerType;
	assertCanRead(session, ownerType, resolveOwner(ownerType, row.ownerId, session.tenantId));
	if (row.uploadState !== 'complete') {
		throw stateConflict('The file is not ready to open yet.');
	}

	const signed = issuedSignedUrl(row.id);
	replaceAsset({
		...row,
		signedUrl: signed.url,
		signedUrlExpiresAt: signed.expiresAt,
		updatedAt: row.updatedAt
	});
	return signed;
}
