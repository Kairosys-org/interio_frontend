import { COLLECTIONS } from '$shared/data/collections';
import { requireTenantSession } from '$shared/data/mock-session';
import type {
	AssetRecord,
	ProjectUserRecord,
	SurveyMeasurementRecord,
	SurveyOpeningRecord,
	SurveyRecord,
	SurveyWallRecord,
	SyncConflictRecord,
	SyncOperationRecord
} from '$shared/data/records';
import { PERMISSIONS } from '$shared/domain/permissions';
import { ROLES } from '$shared/domain/roles';
import type { Uuid } from '$shared/domain/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, registerSeeder, setCollection } from '$network/mock-backend';
import { clearSentOutbox, listOutbox, outboxCounts, patchOutbox } from './outbox';
import {
	type ResolveConflictInput,
	type SyncConflict,
	type SyncEntity,
	type SyncOp,
	type SyncOperation,
	type SyncOperationResult,
	type SyncPendingCounts,
	type SyncPullChange,
	type SyncPullParams,
	type SyncPullResult,
	type SyncPushResult
} from '../domain/types';
import { seedSync } from './seed';

/**
 * Sync mock transport (architecture §4.6, Part 9 §13, Part 10 §24).
 *
 * `push()` is `POST /sync/push`: it drains queued/failed operations oldest
 * first, replays an interrupted `sending` row from its stored result, refuses
 * an op whose server row moved after the op was queued (server wins →
 * `conflict`), and fails the first attempt of an `asset_state` op so the
 * backoff/retry path is real. A rejected op never aborts the batch.
 *
 * The survey rows already contain the local edit (offline writes are applied
 * locally first), so a successful push is an acknowledgement, not a second
 * write — except a re-applied conflict, which merges the chosen fields onto
 * the server row.
 */

registerSeeder(seedSync);

const SYNCABLE_STATES = new Set(['queued', 'failed', 'sending']);
const NEVER_MERGED = new Set(['id', 'tenantId', 'createdAt', 'updatedAt']);
const ASSET_STATES = new Set(['pending', 'uploading', 'complete', 'failed']);

interface SyncRow {
	id: string;
	tenantId: string;
	updatedAt?: string;
	createdAt?: string;
	[key: string]: unknown;
}

function notFound(message = 'That queued change no longer exists.'): ApiError {
	return new ApiError({ code: ApiErrorCode.NOT_FOUND, status: 404, message });
}

function stateConflict(message: string): ApiError {
	return new ApiError({ code: ApiErrorCode.STATE_CONFLICT, status: 409, message });
}

const nowIso = (): string => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* Scope helpers                                                       */
/* ------------------------------------------------------------------ */

function collectionFor(entity: SyncEntity): string {
	const collections: Record<SyncEntity, string> = {
		survey: COLLECTIONS.surveys,
		room: COLLECTIONS.surveyRooms,
		wall: COLLECTIONS.surveyWalls,
		opening: COLLECTIONS.surveyOpenings,
		utility: COLLECTIONS.surveyUtilities,
		obstacle: COLLECTIONS.surveyObstacles,
		measurement: COLLECTIONS.surveyMeasurements,
		note: COLLECTIONS.surveyNotes,
		asset: COLLECTIONS.assets
	};
	return collections[entity];
}

function rowUpdatedAt(entity: SyncEntity, row: SyncRow): string {
	if (entity === 'note') return String(row.createdAt ?? '');
	return String(row.updatedAt ?? row.createdAt ?? '');
}

function findEntityRow(entity: SyncEntity, id: string, tenantId: string): SyncRow | null {
	return (
		getCollection<SyncRow>(collectionFor(entity)).find(
			(row) => row.tenantId === tenantId && row.id === id
		) ?? null
	);
}

function replaceEntityRow(entity: SyncEntity, updated: SyncRow): void {
	setCollection<SyncRow>(
		collectionFor(entity),
		getCollection<SyncRow>(collectionFor(entity)).map((row) =>
			row.id === updated.id ? updated : row
		)
	);
}

function isCaptureOnly(user: { roles: string[] }): boolean {
	return user.roles.includes(ROLES.SURVEYOR) && !user.roles.includes(ROLES.PRODUCTION_MANAGER);
}

function assignedToProject(tenantId: string, projectId: string, userId: string): boolean {
	return getCollection<ProjectUserRecord>(COLLECTIONS.projectUsers).some(
		(row) => row.tenantId === tenantId && row.projectId === projectId && row.userId === userId
	);
}

/** Survey ids the current user may pull, applying the capture-only scope. */
function readableSurveyIds(tenantId: string, user: { id: string; roles: string[] }): Set<string> {
	const surveys = getCollection<SurveyRecord>(COLLECTIONS.surveys).filter(
		(row) => row.tenantId === tenantId
	);
	if (!isCaptureOnly(user)) return new Set(surveys.map((survey) => survey.id));
	return new Set(
		surveys
			.filter(
				(survey) =>
					survey.surveyorId === user.id && assignedToProject(tenantId, survey.projectId, user.id)
			)
			.map((survey) => survey.id)
	);
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

function toOperation(row: SyncOperationRecord): SyncOperation {
	return {
		...row,
		entity: row.entity as SyncEntity,
		op: row.op as SyncOp,
		conflict: row.conflict as SyncConflict | null
	};
}

function differingFields(server: SyncRow, local: Record<string, unknown>): string[] {
	return Object.keys(local)
		.filter((key) => !NEVER_MERGED.has(key))
		.filter((key) => JSON.stringify(server[key] ?? null) !== JSON.stringify(local[key] ?? null))
		.sort();
}

function detectConflict(op: SyncOperationRecord, tenantId: string): SyncConflict | null {
	const row = findEntityRow(op.entity as SyncEntity, op.localId, tenantId);
	if (!row) return null;
	const serverUpdatedAt = rowUpdatedAt(op.entity as SyncEntity, row);
	if (serverUpdatedAt <= op.createdAt) return null;
	return {
		serverUpdatedAt,
		server: { ...row },
		local: { ...op.payload },
		fields: differingFields(row, op.payload)
	};
}

function replayResult(row: SyncOperationRecord): SyncOperationResult | null {
	if (!row.result) return null;
	const stored = row.result as {
		state?: string;
		authoritativeId?: string | null;
		error?: string | null;
		conflict?: SyncConflict | null;
	};
	if (stored.state !== 'sent') return null;
	return {
		idempotencyKey: row.idempotencyKey,
		entity: row.entity as SyncEntity,
		op: row.op as SyncOp,
		localId: row.localId,
		state: 'sent',
		authoritativeId: row.localId,
		error: null,
		conflict: null
	};
}

/* ------------------------------------------------------------------ */
/* Applying an operation                                               */
/* ------------------------------------------------------------------ */

function mergeFields(entity: SyncEntity, row: SyncRow, payload: Record<string, unknown>): SyncRow {
	const merged: SyncRow = { ...row };
	for (const [key, value] of Object.entries(payload)) {
		if (NEVER_MERGED.has(key)) continue;
		merged[key] = value;
	}
	merged.updatedAt = nowIso();
	replaceEntityRow(entity, merged);
	return merged;
}

function applyOperation(op: SyncOperationRecord): string | null {
	const tenantId = op.tenantId;
	const entity = op.entity as SyncEntity;
	const row = findEntityRow(entity, op.localId, tenantId);
	if (!row) return 'The record no longer exists on the server.';

	if (op.op === 'asset_state') {
		const next = op.payload.uploadState;
		if (typeof next !== 'string' || !ASSET_STATES.has(next)) {
			return 'The upload state is not valid.';
		}
		const asset = row as unknown as AssetRecord;
		replaceEntityRow('asset', {
			...asset,
			uploadState: next as AssetRecord['uploadState'],
			updatedAt: nowIso()
		});
		return null;
	}

	// A re-applied conflict carries the server version it is based on; only
	// that op merges local fields onto the server row.
	if (op.baseUpdatedAt !== null && rowUpdatedAt(entity, row) === op.baseUpdatedAt) {
		if (op.op !== 'revision') {
			mergeFields(entity, row, op.payload);
		}
		return null;
	}

	if (entity === 'survey' && op.op === 'transition' && typeof op.payload.to === 'string') {
		replaceEntityRow('survey', {
			...row,
			status: op.payload.to,
			updatedAt: nowIso()
		});
		return null;
	}

	if (entity === 'measurement' && op.op === 'verify') {
		const measurement = row as unknown as SurveyMeasurementRecord;
		replaceEntityRow('measurement', {
			...measurement,
			verifiedAt: nowIso(),
			verifiedBy: op.userId,
			verificationMethod:
				typeof op.payload.method === 'string' ? op.payload.method : measurement.verificationMethod,
			updatedAt: nowIso()
		});
		return null;
	}

	return null;
}

/* ------------------------------------------------------------------ */
/* Repository implementation                                           */
/* ------------------------------------------------------------------ */

export async function mockPendingCounts(): Promise<SyncPendingCounts> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const counts = outboxCounts();
	const assets = getCollection<AssetRecord>(COLLECTIONS.assets).filter(
		(row) => row.tenantId === tenantId
	);

	return {
		...counts,
		assetsPending: assets.filter((asset) => asset.uploadState === 'pending').length,
		assetsUploading: assets.filter((asset) => asset.uploadState === 'uploading').length,
		assetsFailed: assets.filter((asset) => asset.uploadState === 'failed').length
	};
}

export async function mockSyncOperations(state?: SyncOperation['state']): Promise<SyncOperation[]> {
	requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	return listOutbox(state).map(toOperation);
}

export async function mockSyncOperation(idempotencyKey: string): Promise<SyncOperation> {
	requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const row = listOutbox().find((candidate) => candidate.idempotencyKey === idempotencyKey);
	if (!row) throw notFound();
	return toOperation(row);
}

export async function mockLocalIdFor(idempotencyKey: string): Promise<Uuid | null> {
	requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	return (
		listOutbox().find((candidate) => candidate.idempotencyKey === idempotencyKey)?.localId ?? null
	);
}

export async function mockPush(): Promise<SyncPushResult> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const queue = listOutbox().filter((row) => SYNCABLE_STATES.has(row.state));

	const results: SyncOperationResult[] = [];
	let applied = 0;
	let conflicts = 0;
	let failed = 0;

	for (const op of queue) {
		// A previous push was interrupted after the server applied the op but
		// before the acknowledgement arrived: replay the stored result.
		if (op.state === 'sending') {
			const replay = replayResult(op);
			if (replay) {
				patchOutbox(op.idempotencyKey, { state: 'sent', sentAt: nowIso() });
				results.push(replay);
				applied += 1;
				continue;
			}
		}

		const conflict = detectConflict(op, tenantId);
		if (conflict) {
			patchOutbox(op.idempotencyKey, {
				state: 'conflict',
				conflict: conflict as unknown as SyncConflictRecord,
				lastError: 'This record changed on the server. Review both versions.'
			});
			results.push({
				idempotencyKey: op.idempotencyKey,
				entity: op.entity as SyncEntity,
				op: op.op as SyncOp,
				localId: op.localId,
				state: 'conflict',
				authoritativeId: null,
				error: 'This record changed on the server. Review both versions.',
				conflict
			});
			conflicts += 1;
			continue;
		}

		// One deterministic transient failure proves retry + backoff without a
		// random failure mode (phase-2 §5.3). The next push succeeds.
		if (op.op === 'asset_state' && op.attempts === 0) {
			const message = 'The upload endpoint timed out. Try again.';
			patchOutbox(op.idempotencyKey, {
				state: 'failed',
				attempts: 1,
				lastError: message
			});
			results.push({
				idempotencyKey: op.idempotencyKey,
				entity: op.entity as SyncEntity,
				op: op.op as SyncOp,
				localId: op.localId,
				state: 'failed',
				authoritativeId: null,
				error: message,
				conflict: null
			});
			failed += 1;
			continue;
		}

		patchOutbox(op.idempotencyKey, { state: 'sending' });
		const error = applyOperation(op);

		if (error) {
			patchOutbox(op.idempotencyKey, {
				state: 'failed',
				attempts: op.attempts + 1,
				lastError: error
			});
			results.push({
				idempotencyKey: op.idempotencyKey,
				entity: op.entity as SyncEntity,
				op: op.op as SyncOp,
				localId: op.localId,
				state: 'failed',
				authoritativeId: null,
				error,
				conflict: null
			});
			failed += 1;
			continue;
		}

		patchOutbox(op.idempotencyKey, {
			state: 'sent',
			attempts: op.attempts + 1,
			lastError: null,
			conflict: null,
			sentAt: nowIso(),
			result: { state: 'sent', authoritativeId: op.localId, appliedAt: nowIso() }
		});
		results.push({
			idempotencyKey: op.idempotencyKey,
			entity: op.entity as SyncEntity,
			op: op.op as SyncOp,
			localId: op.localId,
			state: 'sent',
			authoritativeId: op.localId,
			error: null,
			conflict: null
		});
		applied += 1;
	}

	return { results, applied, conflicts, failed };
}

export async function mockPull(params: SyncPullParams = {}): Promise<SyncPullResult> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const surveyIds = readableSurveyIds(tenantId, user);

	const surveys = getCollection<SyncRow>(COLLECTIONS.surveys).filter(
		(row) =>
			row.tenantId === tenantId &&
			surveyIds.has(row.id) &&
			(params.projectId === undefined ||
				params.projectId === null ||
				row.projectId === params.projectId)
	);
	const scopedSurveyIds = new Set(surveys.map((survey) => survey.id));

	const rooms = getCollection<SyncRow>(COLLECTIONS.surveyRooms).filter(
		(row) => row.tenantId === tenantId && scopedSurveyIds.has(String(row.surveyId))
	);
	const roomIds = new Set(rooms.map((room) => room.id));
	const roomToSurvey = new Map(rooms.map((room) => [room.id, String(room.surveyId)]));
	const walls = getCollection<SyncRow>(COLLECTIONS.surveyWalls).filter(
		(row) => row.tenantId === tenantId && roomIds.has(String(row.surveyRoomId))
	);
	const openings = getCollection<SyncRow>(COLLECTIONS.surveyOpenings).filter(
		(row) => row.tenantId === tenantId && roomIds.has(String(row.surveyRoomId))
	);
	const utilities = getCollection<SyncRow>(COLLECTIONS.surveyUtilities).filter(
		(row) => row.tenantId === tenantId && roomIds.has(String(row.surveyRoomId))
	);
	const obstacles = getCollection<SyncRow>(COLLECTIONS.surveyObstacles).filter(
		(row) => row.tenantId === tenantId && roomIds.has(String(row.surveyRoomId))
	);
	const measurements = getCollection<SyncRow>(COLLECTIONS.surveyMeasurements).filter(
		(row) => row.tenantId === tenantId && roomIds.has(String(row.surveyRoomId))
	);
	const notes = getCollection<SyncRow>(COLLECTIONS.surveyNotes).filter(
		(row) => row.tenantId === tenantId && scopedSurveyIds.has(String(row.surveyId))
	);

	const assets = getCollection<AssetRecord>(COLLECTIONS.assets).filter((row) => {
		if (row.tenantId !== tenantId) return false;
		const surveyId = assetSurveyId(row, scopedSurveyIds, roomToSurvey);
		return surveyId !== null && scopedSurveyIds.has(surveyId);
	});

	const since = params.since ?? '';
	const changes: SyncPullChange[] = [];

	function pushChanges(
		entity: SyncEntity,
		rows: readonly SyncRow[],
		statusOf?: (row: SyncRow) => string | null
	) {
		for (const row of rows) {
			const updatedAt = rowUpdatedAt(entity, row);
			if (since && updatedAt <= since) continue;
			changes.push({
				entity,
				id: row.id,
				updatedAt,
				status: statusOf ? statusOf(row) : null
			});
		}
	}

	pushChanges('survey', surveys, (row) => String(row.status ?? ''));

	// `changes` order is parents first so a client can merge without orphaning
	// children; each group is oldest-first.
	const children: Array<[SyncEntity, SyncRow[]]> = [
		['room', rooms],
		['wall', walls],
		['opening', openings],
		['utility', utilities],
		['obstacle', obstacles],
		['measurement', measurements],
		['note', notes]
	];
	for (const [entity, rows] of children) {
		pushChanges(
			entity,
			[...rows].sort((first, second) =>
				rowUpdatedAt(entity, first).localeCompare(rowUpdatedAt(entity, second))
			)
		);
	}

	pushChanges('asset', assets as unknown as SyncRow[], (row) => String(row.uploadState ?? ''));

	const cursor = changes.reduce(
		(latest, change) => (change.updatedAt > latest ? change.updatedAt : latest),
		since
	);
	return { cursor, changes, pulledAt: nowIso() };
}

function assetSurveyId(
	asset: AssetRecord,
	surveyIds: Set<string>,
	roomToSurvey: Map<string, string>
): string | null {
	if (asset.ownerType === 'survey') return surveyIds.has(asset.ownerId) ? asset.ownerId : null;
	if (asset.ownerType === 'room') return roomToSurvey.get(asset.ownerId) ?? null;
	if (asset.ownerType === 'wall') {
		const wall = getCollection<SurveyWallRecord>(COLLECTIONS.surveyWalls).find(
			(row) => row.id === asset.ownerId
		);
		return wall ? (roomToSurvey.get(wall.surveyRoomId) ?? null) : null;
	}
	const opening = getCollection<SurveyOpeningRecord>(COLLECTIONS.surveyOpenings).find(
		(row) => row.id === asset.ownerId
	);
	return opening ? (roomToSurvey.get(opening.surveyRoomId) ?? null) : null;
}

export async function mockRetry(idempotencyKey: string): Promise<SyncOperation> {
	requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const row = listOutbox().find((candidate) => candidate.idempotencyKey === idempotencyKey);
	if (!row) throw notFound();
	if (row.state === 'conflict') {
		throw stateConflict('Resolve this change before retrying it.');
	}
	if (row.state === 'sent') return toOperation(row);

	const updated = patchOutbox(idempotencyKey, {
		state: 'queued',
		lastError: null
	});
	return toOperation(updated);
}

export async function mockResolveConflict(
	idempotencyKey: string,
	input: ResolveConflictInput
): Promise<SyncOperation> {
	requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const row = listOutbox().find((candidate) => candidate.idempotencyKey === idempotencyKey);
	if (!row) throw notFound();
	if (row.state !== 'conflict' || !row.conflict) {
		throw stateConflict('This change is not in conflict.');
	}

	if (input.decision === 'accept_server') {
		const updated = patchOutbox(idempotencyKey, {
			state: 'sent',
			conflict: null,
			lastError: null,
			sentAt: nowIso(),
			result: {
				state: 'sent',
				authoritativeId: row.localId,
				resolution: 'accept_server',
				serverUpdatedAt: row.conflict.serverUpdatedAt
			}
		});
		return toOperation(updated);
	}

	const fields = input.fields?.filter((field) => field in row.payload);
	const payload =
		fields && fields.length > 0
			? Object.fromEntries(fields.map((field) => [field, row.payload[field]]))
			: { ...row.payload };

	const now = nowIso();
	const updated = amendOperation(idempotencyKey, {
		state: 'queued',
		payload,
		baseUpdatedAt: row.conflict.serverUpdatedAt,
		clientTimestamp: now,
		createdAt: now,
		attempts: 0,
		lastError: null,
		conflict: null,
		result: null,
		sentAt: null
	});
	return toOperation(updated);
}

/**
 * Field-level amend for a queued row. `patchOutbox` intentionally exposes only
 * transport state; resolving a conflict must also reset the op's created-at
 * and base version, so this helper writes the same tenant/user-scoped row.
 */
function amendOperation(
	idempotencyKey: string,
	patch: Partial<SyncOperationRecord>
): SyncOperationRecord {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const rows = getCollection<SyncOperationRecord>(COLLECTIONS.syncOperations);
	const index = rows.findIndex(
		(row) =>
			row.tenantId === tenantId && row.userId === user.id && row.idempotencyKey === idempotencyKey
	);
	if (index < 0) throw notFound();
	const updated: SyncOperationRecord = { ...rows[index], ...patch };
	const next = [...rows];
	next[index] = updated;
	setCollection(COLLECTIONS.syncOperations, next);
	return updated;
}

export async function mockClearSent(): Promise<number> {
	requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	return clearSentOutbox();
}
