import type { ZodError } from 'zod';
import { listTenantAudit, recordTenantAudit } from '$shared/data/audit';
import { COLLECTIONS } from '$shared/data/collections';
import { requireTenantSession } from '$shared/data/mock-session';
import type {
	AssetRecord,
	CustomerRecord,
	ProjectRecord,
	ProjectUserRecord,
	PropertyRecord,
	SurveyMeasurementRecord,
	SurveyNoteRecord,
	SurveyObstacleRecord,
	SurveyOpeningRecord,
	SurveyRecord,
	SurveyRoomRecord,
	SurveyUtilityRecord,
	SurveyWallRecord
} from '$shared/data/records';
import type { AuditTrailRow } from '$shared/domain/audit';
import { toPage } from '$shared/domain/pagination';
import { PERMISSIONS } from '$shared/domain/permissions';
import { ROLES } from '$shared/domain/roles';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, registerSeeder, updateCollection } from '$network/mock-backend';
import {
	openingFitsWallReason,
	measurementRequiresCaption,
	requiresDeviceInfo,
	requiresSill,
	requiresSwing,
	uniqueWallCaption
} from '../domain/rules';
import {
	SURVEY_ACTIONS,
	SURVEY_TRANSITIONS,
	isCriticalDimensionKind,
	type CreateMeasurementInput,
	type CreateNoteInput,
	type CreateObstacleInput,
	type CreateOpeningInput,
	type CreateRoomInput,
	type CreateSurveyInput,
	type CreateUtilityInput,
	type CreateWallInput,
	type ReviseNoteInput,
	type RoomType,
	type Survey,
	type SurveyAction,
	type SurveyChecklist,
	type SurveyChecklistItem,
	type SurveyDetail,
	type SurveyGateDetail,
	type SurveyListParams,
	type SurveyListRow,
	type SurveyMeasurement,
	type SurveyMediaItem,
	type SurveyNote,
	type SurveyObstacle,
	type SurveyOpening,
	type SurveyPage,
	type SurveyProgressCounts,
	type SurveyRoom,
	type SurveyRoomTree,
	type SurveySort,
	type SurveyUtility,
	type SurveyWall,
	type TransitionSurveyInput,
	type UpdateMeasurementInput,
	type UpdateObstacleInput,
	type UpdateOpeningInput,
	type UpdateRoomInput,
	type UpdateSurveyInput,
	type UpdateUtilityInput,
	type UpdateWallInput,
	type VerifyMeasurementInput
} from '../domain/types';
import {
	measurementFormSchema,
	measurementUpdateSchema,
	noteFormSchema,
	noteRevisionSchema,
	obstacleFormSchema,
	obstacleUpdateSchema,
	openingFormSchema,
	openingUpdateSchema,
	roomFormSchema,
	roomUpdateSchema,
	surveyFormSchema,
	surveyUpdateSchema,
	utilityFormSchema,
	utilityUpdateSchema,
	verifyMeasurementSchema,
	wallFormSchema,
	wallUpdateSchema
} from '../domain/validations';
import { seedSurveys } from './seed';

/**
 * Survey mock server (architecture §4.6, spec Part 9).
 *
 * Behaves like the backend: the tenant comes from the session, every
 * permission is re-checked here, the Part 4 §2 machine is the only way status
 * changes, and the submit/G8 gates return `gate_blocked` with named reasons.
 * Verified trees are immutable until an audited reopen. Never imported by
 * routes or presentation.
 */

registerSeeder(seedSurveys);

const SURVEY = 'survey';

function notFound(message = 'Survey not found.'): ApiError {
	return new ApiError({ code: ApiErrorCode.NOT_FOUND, status: 404, message });
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

function gateBlocked(detail: SurveyGateDetail): ApiError {
	return new ApiError({
		code: ApiErrorCode.GATE_BLOCKED,
		status: 409,
		message:
			detail.gate === 'submit'
				? 'The survey is not ready to submit.'
				: 'Every manufacturing-critical measurement must be verified first.',
		details: detail
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

const nowIso = (): string => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* Collection helpers                                                  */
/* ------------------------------------------------------------------ */

function tenantSurveys(tenantId: string): SurveyRecord[] {
	return getCollection<SurveyRecord>(COLLECTIONS.surveys).filter(
		(row) => row.tenantId === tenantId
	);
}

function allRooms(): SurveyRoomRecord[] {
	return getCollection<SurveyRoomRecord>(COLLECTIONS.surveyRooms);
}

function allWalls(): SurveyWallRecord[] {
	return getCollection<SurveyWallRecord>(COLLECTIONS.surveyWalls);
}

function allOpenings(): SurveyOpeningRecord[] {
	return getCollection<SurveyOpeningRecord>(COLLECTIONS.surveyOpenings);
}

function allMeasurements(): SurveyMeasurementRecord[] {
	return getCollection<SurveyMeasurementRecord>(COLLECTIONS.surveyMeasurements);
}

function findSurvey(id: string, tenantId: string): SurveyRecord {
	const survey = tenantSurveys(tenantId).find((row) => row.id === id);
	if (!survey) throw notFound();
	return survey;
}

function activeRooms(surveyId: string, tenantId: string): SurveyRoomRecord[] {
	return allRooms()
		.filter(
			(row) => row.tenantId === tenantId && row.surveyId === surveyId && row.archivedAt === null
		)
		.sort(
			(first, second) => first.sortOrder - second.sortOrder || first.id.localeCompare(second.id)
		);
}

function surveyRooms(surveyId: string, tenantId: string): SurveyRoomRecord[] {
	return allRooms().filter((row) => row.tenantId === tenantId && row.surveyId === surveyId);
}

function findRoom(id: string, tenantId: string): SurveyRoomRecord {
	const room = allRooms().find((row) => row.tenantId === tenantId && row.id === id);
	if (!room) throw notFound('Room not found.');
	return room;
}

function findWall(id: string, tenantId: string): SurveyWallRecord {
	const wall = allWalls().find((row) => row.tenantId === tenantId && row.id === id);
	if (!wall) throw notFound('Wall not found.');
	return wall;
}

function findOpening(id: string, tenantId: string): SurveyOpeningRecord {
	const opening = allOpenings().find((row) => row.tenantId === tenantId && row.id === id);
	if (!opening) throw notFound('Opening not found.');
	return opening;
}

function findUtility(id: string, tenantId: string): SurveyUtilityRecord {
	const utility = getCollection<SurveyUtilityRecord>(COLLECTIONS.surveyUtilities).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!utility) throw notFound('Utility not found.');
	return utility;
}

function findObstacle(id: string, tenantId: string): SurveyObstacleRecord {
	const obstacle = getCollection<SurveyObstacleRecord>(COLLECTIONS.surveyObstacles).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!obstacle) throw notFound('Obstacle not found.');
	return obstacle;
}

function findMeasurement(id: string, tenantId: string): SurveyMeasurementRecord {
	const measurement = allMeasurements().find((row) => row.tenantId === tenantId && row.id === id);
	if (!measurement) throw notFound('Measurement not found.');
	return measurement;
}

function findNote(id: string, tenantId: string): SurveyNoteRecord {
	const note = getCollection<SurveyNoteRecord>(COLLECTIONS.surveyNotes).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!note) throw notFound('Note not found.');
	return note;
}

function surveyOfRoom(room: SurveyRoomRecord, tenantId: string): SurveyRecord {
	return findSurvey(room.surveyId, tenantId);
}

function surveyOfMeasurement(measurement: SurveyMeasurementRecord, tenantId: string): SurveyRecord {
	return surveyOfRoom(findRoom(measurement.surveyRoomId, tenantId), tenantId);
}

function saveSurvey(updated: SurveyRecord): void {
	updateCollection<SurveyRecord>(COLLECTIONS.surveys, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
}

function saveRoom(updated: SurveyRoomRecord): void {
	updateCollection<SurveyRoomRecord>(COLLECTIONS.surveyRooms, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
}

function assignedToProject(tenantId: string, projectId: string, userId: string): boolean {
	return getCollection<ProjectUserRecord>(COLLECTIONS.projectUsers).some(
		(row) => row.tenantId === tenantId && row.projectId === projectId && row.userId === userId
	);
}

function auditSurvey(
	tenantId: string,
	surveyId: string,
	action: string,
	payload?: Record<string, unknown>
): void {
	recordTenantAudit({
		tenantId,
		action,
		subjectType: SURVEY,
		subjectId: surveyId,
		payload: payload ?? null
	});
}

/** Capture-only surveyors see their own surveys on projects still assigned. */
function isCaptureOnly(user: { roles: string[] }): boolean {
	return user.roles.includes(ROLES.SURVEYOR) && !user.roles.includes(ROLES.PRODUCTION_MANAGER);
}

function assertCanReadSurvey(
	user: { id: string; roles: string[] },
	tenantId: string,
	survey: SurveyRecord
): void {
	if (!isCaptureOnly(user)) return;
	if (survey.surveyorId !== user.id || !assignedToProject(tenantId, survey.projectId, user.id)) {
		throw notFound();
	}
}

/** Verified data is immutable until an audited reopen (Part 4 §2). */
function assertSurveyWritable(survey: SurveyRecord): void {
	if (survey.status === 'cancelled') {
		throw stateConflict('This survey was cancelled and can no longer be edited.');
	}
	if (survey.status === 'verified') {
		throw stateConflict('Reopen the survey before editing verified data.');
	}
}

function assertSurveyMetadataWritable(survey: SurveyRecord): void {
	assertSurveyWritable(survey);
	if (survey.status !== 'draft' && survey.status !== 'in_progress') {
		throw stateConflict('Captions and appointments can only change before submission.');
	}
}

function assertSurveyorChangeAllowed(
	user: { id: string; roles: string[]; permissions: string[] },
	targetSurveyorId: string
): void {
	if (targetSurveyorId === user.id) return;
	const canAssign =
		user.permissions.includes(PERMISSIONS.SURVEY_APPROVE) ||
		user.roles.includes(ROLES.PRODUCTION_MANAGER) ||
		user.roles.includes(ROLES.SALES) ||
		user.roles.includes(ROLES.OWNER_MANAGEMENT);
	if (!canAssign) {
		throw new ApiError({
			code: ApiErrorCode.FORBIDDEN,
			status: 403,
			message: 'Only a production manager or sales user can assign another surveyor.'
		});
	}
}

function requireAssignedSurveyor(tenantId: string, projectId: string, surveyorId: string): void {
	if (!assignedToProject(tenantId, projectId, surveyorId)) {
		throw new ApiError({
			code: ApiErrorCode.FORBIDDEN,
			status: 403,
			message: 'This surveyor is not assigned to the project.'
		});
	}
}

/** Room-child writes must never escape their room. */
function assertWallInRoom(wallId: string, roomId: string, tenantId: string): SurveyWallRecord {
	const wall = findWall(wallId, tenantId);
	if (wall.surveyRoomId !== roomId) {
		throw validation('Choose a wall from this room.', {
			surveyWallId: 'Choose a wall from this room.'
		});
	}
	return wall;
}

function assertOpeningInRoom(
	openingId: string,
	roomId: string,
	tenantId: string
): SurveyOpeningRecord {
	const opening = findOpening(openingId, tenantId);
	if (opening.surveyRoomId !== roomId) {
		throw validation('Choose an opening from this room.', {
			surveyOpeningId: 'Choose an opening from this room.'
		});
	}
	return opening;
}

function assertOpeningGeometry(
	opening: { widthMm: number; heightMm: number },
	wallId: string | null,
	tenantId: string
): void {
	if (!wallId) return;
	const wall = findWall(wallId, tenantId);
	const reason = openingFitsWallReason(opening, wall);
	if (reason) {
		const fieldErrors: Record<string, string> = {};
		if (opening.widthMm > wall.lengthMm) fieldErrors.widthMm = reason;
		if (opening.heightMm > wall.heightMm) fieldErrors.heightMm = reason;
		throw validation(reason, fieldErrors);
	}
}

/* ------------------------------------------------------------------ */
/* Mapping records → domain                                            */
/* ------------------------------------------------------------------ */

function toSurvey(row: SurveyRecord): Survey {
	return { ...row };
}

function toRoom(row: SurveyRoomRecord): SurveyRoom {
	return { ...row, roomType: row.roomType as RoomType };
}

function toWall(row: SurveyWallRecord): SurveyWall {
	return { ...row };
}

function toOpening(row: SurveyOpeningRecord): SurveyOpening {
	return {
		...row,
		openingType: row.openingType as SurveyOpening['openingType'],
		swingDirection: row.swingDirection as SurveyOpening['swingDirection']
	};
}

function toUtility(row: SurveyUtilityRecord): SurveyUtility {
	return { ...row, utilityType: row.utilityType as SurveyUtility['utilityType'] };
}

function toObstacle(row: SurveyObstacleRecord): SurveyObstacle {
	return { ...row, obstacleType: row.obstacleType as SurveyObstacle['obstacleType'] };
}

function toMeasurement(row: SurveyMeasurementRecord): SurveyMeasurement {
	return {
		...row,
		targetType: row.targetType as SurveyMeasurement['targetType'],
		source: row.source as SurveyMeasurement['source'],
		verificationMethod: row.verificationMethod as SurveyMeasurement['verificationMethod']
	};
}

function toNote(row: SurveyNoteRecord): SurveyNote {
	return { ...row, category: row.category as SurveyNote['category'] };
}

function toMediaItem(row: AssetRecord): SurveyMediaItem {
	return {
		id: row.id,
		ownerType: row.ownerType as SurveyMediaItem['ownerType'],
		ownerId: row.ownerId,
		assetKind: row.assetKind,
		caption: row.caption,
		uploadState: row.uploadState,
		url: row.signedUrl,
		capturedAt: row.capturedAt,
		createdAt: row.createdAt
	};
}

/* ------------------------------------------------------------------ */
/* List and aggregate                                                  */
/* ------------------------------------------------------------------ */

function compareSurveys(first: SurveyRecord, second: SurveyRecord, sort: SurveySort): number {
	switch (sort) {
		case 'createdAt':
			return first.createdAt.localeCompare(second.createdAt);
		case 'updatedAt':
			return first.updatedAt.localeCompare(second.updatedAt);
		case 'status':
			return first.status.localeCompare(second.status);
		case 'caption':
			return first.caption.localeCompare(second.caption, 'en-GB', { sensitivity: 'base' });
		case 'appointmentAt':
		default:
			return first.appointmentAt.localeCompare(second.appointmentAt);
	}
}

function matches(value: string | null | undefined, needle: string): boolean {
	return typeof value === 'string' && value.toLowerCase().includes(needle);
}

interface ListContext {
	tenantId: string;
	projects: ProjectRecord[];
	customers: CustomerRecord[];
	properties: PropertyRecord[];
	users: { id: string; displayName: string }[];
}

function listContext(tenantId: string): ListContext {
	return {
		tenantId,
		projects: getCollection<ProjectRecord>(COLLECTIONS.projects).filter(
			(row) => row.tenantId === tenantId
		),
		customers: getCollection<CustomerRecord>(COLLECTIONS.customers).filter(
			(row) => row.tenantId === tenantId
		),
		properties: getCollection<PropertyRecord>(COLLECTIONS.properties).filter(
			(row) => row.tenantId === tenantId
		),
		users: getCollection<{ id: string; displayName: string }>(COLLECTIONS.appUsers).map((row) => ({
			id: row.id,
			displayName: row.displayName
		}))
	};
}

function toListRow(survey: SurveyRecord, context: ListContext): SurveyListRow {
	const project = context.projects.find((row) => row.id === survey.projectId) ?? null;
	const customer =
		context.customers.find((row) => row.id === project?.customerId)?.caption ?? 'Unknown customer';
	const property = context.properties.find((row) => row.id === project?.propertyId) ?? null;
	const address = property
		? [property.addressLine1, property.addressLine2, property.town, property.postcode]
				.filter((part): part is string => typeof part === 'string' && part.length > 0)
				.join(', ')
		: 'Address not recorded';
	const surveyor =
		context.users.find((row) => row.id === survey.surveyorId)?.displayName ?? 'Unassigned';
	const rooms = surveyRooms(survey.id, context.tenantId).filter((row) => row.archivedAt === null);
	const roomIds = new Set(rooms.map((room) => room.id));
	const criticalUnverified = allMeasurements().filter(
		(row) =>
			row.tenantId === context.tenantId &&
			roomIds.has(row.surveyRoomId) &&
			row.isManufacturingCritical &&
			row.verifiedAt === null
	).length;

	return {
		id: survey.id,
		caption: survey.caption,
		projectId: survey.projectId,
		projectCaption: project?.caption ?? 'Unknown project',
		projectReference: project?.reference ?? '—',
		customerCaption: customer,
		propertyAddress: address,
		surveyorId: survey.surveyorId,
		surveyorName: surveyor,
		appointmentAt: survey.appointmentAt,
		status: survey.status,
		roomCount: rooms.length,
		criticalUnverifiedCount: criticalUnverified,
		submittedAt: survey.submittedAt,
		updatedAt: survey.updatedAt
	};
}

export async function mockListSurveys(params: SurveyListParams = {}): Promise<SurveyPage> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_VIEW);

	const context = listContext(tenantId);
	const search = params.search?.trim().toLowerCase() ?? '';
	const status = params.status ?? 'all';
	const sort: SurveySort = params.sort ?? 'updatedAt';
	const direction = params.sortDir ?? (sort === 'caption' || sort === 'status' ? 'asc' : 'desc');
	const mine = isCaptureOnly(user) || params.scope === 'mine';

	const entries = tenantSurveys(tenantId)
		.filter((survey) => {
			if (mine) {
				return (
					survey.surveyorId === user.id && assignedToProject(tenantId, survey.projectId, user.id)
				);
			}
			return true;
		})
		.filter((survey) => (params.projectId ? survey.projectId === params.projectId : true))
		.filter((survey) => (params.surveyorId ? survey.surveyorId === params.surveyorId : true))
		.filter((survey) => (status === 'all' ? true : survey.status === status))
		.filter((survey) => {
			if (params.appointmentFrom && survey.appointmentAt.slice(0, 10) < params.appointmentFrom) {
				return false;
			}
			if (params.appointmentTo && survey.appointmentAt.slice(0, 10) > params.appointmentTo) {
				return false;
			}
			return true;
		})
		.map((survey) => ({ survey, row: toListRow(survey, context) }))
		.filter(
			(entry) =>
				search.length === 0 ||
				matches(entry.row.caption, search) ||
				matches(entry.row.projectCaption, search) ||
				matches(entry.row.projectReference, search) ||
				matches(entry.row.customerCaption, search) ||
				matches(entry.row.propertyAddress, search) ||
				matches(entry.row.surveyorName, search)
		)
		.sort(
			(first, second) =>
				compareSurveys(first.survey, second.survey, sort) * (direction === 'asc' ? 1 : -1) ||
				first.survey.id.localeCompare(second.survey.id)
		);

	return toPage(
		entries.map((entry) => entry.row),
		{ page: params.page, pageSize: params.pageSize }
	);
}

function mediaForSurvey(surveyId: string, tenantId: string): AssetRecord[] {
	const rooms = surveyRooms(surveyId, tenantId);
	const roomIds = new Set(rooms.map((row) => row.id));
	const walls = allWalls().filter(
		(row) => row.tenantId === tenantId && roomIds.has(row.surveyRoomId)
	);
	const wallIds = new Set(walls.map((row) => row.id));
	const openings = allOpenings().filter(
		(row) => row.tenantId === tenantId && roomIds.has(row.surveyRoomId)
	);
	const openingIds = new Set(openings.map((row) => row.id));

	return getCollection<AssetRecord>(COLLECTIONS.assets)
		.filter((row) => {
			if (row.tenantId !== tenantId) return false;
			if (row.ownerType === 'survey') return row.ownerId === surveyId;
			if (row.ownerType === 'room') return roomIds.has(row.ownerId);
			if (row.ownerType === 'wall') return wallIds.has(row.ownerId);
			if (row.ownerType === 'opening') return openingIds.has(row.ownerId);
			return false;
		})
		.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

export async function mockGetSurvey(id: string): Promise<SurveyDetail> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const survey = findSurvey(id, tenantId);
	assertCanReadSurvey(user, tenantId, survey);

	const context = listContext(tenantId);
	const project = context.projects.find((row) => row.id === survey.projectId) ?? null;
	const customer = project
		? (context.customers.find((row) => row.id === project.customerId) ?? null)
		: null;
	const property = project
		? (context.properties.find((row) => row.id === project.propertyId) ?? null)
		: null;

	const rooms = activeRooms(id, tenantId);
	const walls = allWalls().filter((row) => row.tenantId === tenantId);
	const openings = allOpenings().filter((row) => row.tenantId === tenantId);
	const utilities = getCollection<SurveyUtilityRecord>(COLLECTIONS.surveyUtilities).filter(
		(row) => row.tenantId === tenantId
	);
	const obstacles = getCollection<SurveyObstacleRecord>(COLLECTIONS.surveyObstacles).filter(
		(row) => row.tenantId === tenantId
	);
	const measurements = allMeasurements().filter((row) => row.tenantId === tenantId);
	const notes = getCollection<SurveyNoteRecord>(COLLECTIONS.surveyNotes).filter(
		(row) => row.tenantId === tenantId && row.surveyId === id
	);
	const media = mediaForSurvey(id, tenantId);

	const roomTrees: SurveyRoomTree[] = rooms.map((room) => {
		const roomMedia = media.filter((item) => item.ownerType === 'room' && item.ownerId === room.id);
		return {
			room: toRoom(room),
			walls: walls
				.filter((row) => row.surveyRoomId === room.id)
				.sort(
					(first, second) => first.sortOrder - second.sortOrder || first.id.localeCompare(second.id)
				)
				.map(toWall),
			openings: openings.filter((row) => row.surveyRoomId === room.id).map(toOpening),
			utilities: utilities.filter((row) => row.surveyRoomId === room.id).map(toUtility),
			obstacles: obstacles.filter((row) => row.surveyRoomId === room.id).map(toObstacle),
			measurements: measurements.filter((row) => row.surveyRoomId === room.id).map(toMeasurement),
			notes: notes.filter((row) => row.surveyRoomId === room.id).map(toNote),
			photoCount: roomMedia.filter((row) => row.uploadState === 'complete').length
		};
	});

	return {
		survey: toSurvey(survey),
		project: project
			? {
					id: project.id,
					caption: project.caption,
					reference: project.reference,
					status: project.status
				}
			: { id: survey.projectId, caption: 'Unknown project', reference: '—', status: 'unknown' },
		customer: customer
			? {
					id: customer.id,
					caption: customer.caption,
					email: customer.email,
					phone: customer.phone
				}
			: null,
		property: property
			? {
					id: property.id,
					addressLine1: property.addressLine1,
					addressLine2: property.addressLine2,
					town: property.town,
					postcode: property.postcode
				}
			: null,
		rooms: roomTrees,
		surveyNotes: notes.filter((row) => row.surveyRoomId === null).map(toNote),
		media: media.map(toMediaItem),
		counts: countsFor(survey, tenantId)
	};
}

/* ------------------------------------------------------------------ */
/* Progress and checklist                                              */
/* ------------------------------------------------------------------ */

function countsFor(survey: SurveyRecord, tenantId: string): SurveyProgressCounts {
	const rooms = activeRooms(survey.id, tenantId);
	const roomIds = new Set(rooms.map((row) => row.id));
	const walls = allWalls().filter(
		(row) => row.tenantId === tenantId && roomIds.has(row.surveyRoomId)
	);
	const openings = allOpenings().filter(
		(row) => row.tenantId === tenantId && roomIds.has(row.surveyRoomId)
	);
	const utilities = getCollection<SurveyUtilityRecord>(COLLECTIONS.surveyUtilities).filter(
		(row) => row.tenantId === tenantId && roomIds.has(row.surveyRoomId)
	);
	const obstacles = getCollection<SurveyObstacleRecord>(COLLECTIONS.surveyObstacles).filter(
		(row) => row.tenantId === tenantId && roomIds.has(row.surveyRoomId)
	);
	const measurements = allMeasurements().filter(
		(row) => row.tenantId === tenantId && roomIds.has(row.surveyRoomId)
	);
	const notes = getCollection<SurveyNoteRecord>(COLLECTIONS.surveyNotes).filter(
		(row) => row.tenantId === tenantId && row.surveyId === survey.id
	);
	const media = mediaForSurvey(survey.id, tenantId).filter((row) => row.uploadState === 'complete');

	const critical = measurements.filter((row) => row.isManufacturingCritical);
	const criticalUnverified = critical.filter((row) => row.verifiedAt === null).length;

	const requiredTotal = rooms.length * 3 + openings.length * 2 + 1;
	let requiredComplete = 0;
	for (const room of rooms) {
		if (room.ceilingHeightMm !== null) requiredComplete += 1;
		if (room.roomLengthMm !== null) requiredComplete += 1;
		if (room.roomWidthMm !== null) requiredComplete += 1;
	}
	for (const opening of openings) {
		if (opening.widthMm > 0) requiredComplete += 1;
		if (opening.heightMm > 0) requiredComplete += 1;
	}
	if (assignedToProject(tenantId, survey.projectId, survey.surveyorId)) requiredComplete += 1;

	return {
		rooms: rooms.length,
		walls: walls.length,
		openings: openings.length,
		utilities: utilities.length,
		obstacles: obstacles.length,
		measurements: measurements.length,
		criticalMeasurements: critical.length,
		criticalUnverified,
		notes: notes.length,
		photos: media.length,
		requiredTotal,
		requiredComplete,
		percent:
			requiredTotal === 0 || rooms.length === 0
				? 0
				: Math.min(100, Math.round((requiredComplete / requiredTotal) * 100))
	};
}

function checklistItem(
	id: SurveyChecklistItem['id'],
	label: string,
	satisfied: boolean,
	detail: string | null,
	blocking = true
): SurveyChecklistItem {
	return { id, label, satisfied, blocking, detail: satisfied ? null : detail };
}

function buildChecklist(survey: SurveyRecord, tenantId: string): SurveyChecklist {
	const rooms = activeRooms(survey.id, tenantId);
	const roomIds = new Set(rooms.map((row) => row.id));
	const walls = allWalls().filter(
		(row) => row.tenantId === tenantId && roomIds.has(row.surveyRoomId)
	);
	const openings = allOpenings().filter(
		(row) => row.tenantId === tenantId && roomIds.has(row.surveyRoomId)
	);
	const measurements = allMeasurements().filter(
		(row) => row.tenantId === tenantId && roomIds.has(row.surveyRoomId)
	);
	const media = mediaForSurvey(survey.id, tenantId);
	const criticalUnverified = measurements
		.filter((row) => row.isManufacturingCritical && row.verifiedAt === null)
		.map(toMeasurement);

	const missingDimensions = rooms
		.map((room) => {
			const missing: string[] = [];
			if (room.ceilingHeightMm === null) missing.push('ceiling height');
			if (room.roomLengthMm === null) missing.push('length');
			if (room.roomWidthMm === null) missing.push('width');
			return missing.length > 0 ? `${room.caption}: ${missing.join(', ')}` : null;
		})
		.filter((value): value is string => value !== null);

	const incompleteOpenings = openings
		.filter((opening) => {
			if (opening.widthMm <= 0 || opening.heightMm <= 0) return true;
			if (requiresSill(opening.openingType) && opening.sillHeightMm === null) return true;
			if (requiresSwing(opening.openingType) && !opening.swingDirection) return true;
			return false;
		})
		.map((opening) => opening.caption ?? `Opening ${opening.id.slice(0, 8)}`);

	const geometryProblems = openings
		.filter((opening) => opening.surveyWallId !== null)
		.map((opening) => {
			const wall = walls.find((row) => row.id === opening.surveyWallId);
			if (!wall) return `${opening.caption ?? 'Opening'} is linked to a missing wall.`;
			return openingFitsWallReason(opening, wall);
		})
		.filter((value): value is string => value !== null);

	const pendingMedia = media.filter((row) => row.uploadState !== 'complete');
	const roomsWithoutPhoto = rooms.filter(
		(room) =>
			!media.some(
				(row) =>
					row.uploadState === 'complete' &&
					row.ownerType === 'room' &&
					row.ownerId === room.id &&
					row.assetKind === 'photo'
			)
	);
	const assigned = assignedToProject(tenantId, survey.projectId, survey.surveyorId);

	const items: SurveyChecklistItem[] = [
		checklistItem('rooms', 'At least one room', rooms.length > 0, 'Add at least one room.'),
		checklistItem(
			'room_dimensions',
			'Room dimensions',
			missingDimensions.length === 0,
			`Complete the dimensions for ${missingDimensions.join('; ')}.`
		),
		checklistItem(
			'openings',
			'Opening dimensions',
			incompleteOpenings.length === 0,
			`Complete width/height, sill or swing for ${incompleteOpenings.join('; ')}.`
		),
		checklistItem(
			'geometry',
			'Openings fit their walls',
			geometryProblems.length === 0,
			geometryProblems.join(' ')
		),
		checklistItem(
			'media_uploaded',
			'Media uploaded',
			pendingMedia.length === 0,
			`${pendingMedia.length} upload(s) are still pending or failed.`
		),
		checklistItem(
			'room_photos',
			'One photo per room',
			roomsWithoutPhoto.length === 0,
			`No photo yet for ${roomsWithoutPhoto.map((room) => room.caption).join('; ')}. The room-photo rule stays informational until the tenant setting is confirmed (Q15).`,
			// TODO(Q15): make this blocking once `setting require_room_photo` exists.
			false
		),
		checklistItem(
			'assignment',
			'Surveyor assigned to the project',
			assigned,
			'The surveyor is not currently assigned to this project.'
		),
		checklistItem(
			'critical_verified',
			'Critical measurements verified',
			criticalUnverified.length === 0,
			`${criticalUnverified.length} manufacturing-critical measurement(s) still need verification.`
		)
	];

	const blockingReasons = items
		.filter(
			(item) =>
				item.blocking &&
				!item.satisfied &&
				(item.id !== 'critical_verified' || survey.status === 'submitted')
		)
		.map((item) => item.detail ?? item.label);

	const canSubmit = items.every(
		(item) => !item.blocking || item.satisfied || item.id === 'critical_verified'
	);

	return {
		surveyId: survey.id,
		items,
		blockingReasons,
		canSubmit,
		canVerify:
			survey.status === 'submitted' &&
			items.find((item) => item.id === 'critical_verified')?.satisfied === true,
		criticalUnverified
	};
}

export async function mockSurveyChecklist(id: string): Promise<SurveyChecklist> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const survey = findSurvey(id, tenantId);
	assertCanReadSurvey(user, tenantId, survey);
	return buildChecklist(survey, tenantId);
}

export async function mockSurveyProgress(id: string): Promise<SurveyProgressCounts> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const survey = findSurvey(id, tenantId);
	assertCanReadSurvey(user, tenantId, survey);
	return countsFor(survey, tenantId);
}

export async function mockSurveyMedia(id: string): Promise<SurveyMediaItem[]> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const survey = findSurvey(id, tenantId);
	assertCanReadSurvey(user, tenantId, survey);
	return mediaForSurvey(id, tenantId).map(toMediaItem);
}

export async function mockSurveyAudit(id: string): Promise<AuditTrailRow[]> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const survey = findSurvey(id, tenantId);
	assertCanReadSurvey(user, tenantId, survey);
	return listTenantAudit(tenantId, SURVEY, survey.id);
}

/* ------------------------------------------------------------------ */
/* Survey create / update / transition                                 */
/* ------------------------------------------------------------------ */

export async function mockCreateSurvey(
	projectId: string,
	input: CreateSurveyInput
): Promise<Survey> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_CREATE);

	const parsed = surveyFormSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const project = getCollection<ProjectRecord>(COLLECTIONS.projects).find(
		(row) => row.id === projectId && row.tenantId === tenantId
	);
	if (!project) throw notFound('Project not found.');
	if (project.state !== 'active') {
		throw stateConflict('This project is not active, so a survey cannot be created on it.');
	}

	assertSurveyorChangeAllowed(user, values.surveyorId);

	const surveyor = getCollection<{ id: string; tenantId: string | null; status: string }>(
		COLLECTIONS.appUsers
	).find((row) => row.id === values.surveyorId && row.tenantId === tenantId);
	if (!surveyor)
		throw validation('Choose a surveyor from this workspace.', {
			surveyorId: 'Choose a surveyor from this workspace.'
		});
	if (surveyor.status !== 'active') {
		throw validation('That surveyor is not active.', {
			surveyorId: 'That surveyor is not active.'
		});
	}

	if (
		!assignedToProject(tenantId, projectId, user.id) &&
		!assignedToProject(tenantId, projectId, values.surveyorId)
	) {
		throw new ApiError({
			code: ApiErrorCode.FORBIDDEN,
			status: 403,
			message: 'You must be assigned to this project before creating a survey.'
		});
	}
	requireAssignedSurveyor(tenantId, projectId, values.surveyorId);

	const now = nowIso();
	const record: SurveyRecord = {
		id: newUuid(),
		tenantId,
		projectId,
		surveyorId: values.surveyorId,
		caption: values.caption,
		appointmentAt: values.appointmentAt,
		status: 'draft',
		reopenCount: 0,
		submittedAt: null,
		verifiedAt: null,
		verifiedBy: null,
		rejectedReason: null,
		createdAt: now,
		updatedAt: now,
		createdBy: user.id
	};

	updateCollection<SurveyRecord>(COLLECTIONS.surveys, (rows) => [...rows, record]);
	auditSurvey(tenantId, record.id, 'create', {
		projectId,
		surveyorId: record.surveyorId
	});
	return toSurvey(record);
}

export async function mockUpdateSurvey(id: string, input: UpdateSurveyInput): Promise<Survey> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const survey = findSurvey(id, tenantId);
	assertSurveyMetadataWritable(survey);

	const parsed = surveyUpdateSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const updated: SurveyRecord = { ...survey };
	if (values.caption !== undefined) updated.caption = values.caption;
	if (values.appointmentAt !== undefined) updated.appointmentAt = values.appointmentAt;
	if (values.surveyorId !== undefined && values.surveyorId !== survey.surveyorId) {
		assertSurveyorChangeAllowed(user, values.surveyorId);
		requireAssignedSurveyor(tenantId, survey.projectId, values.surveyorId);
		updated.surveyorId = values.surveyorId;
	}
	updated.updatedAt = nowIso();

	saveSurvey(updated);
	auditSurvey(tenantId, survey.id, 'update', {
		fields: Object.keys(values).filter((key) => values[key as keyof typeof values] !== undefined)
	});
	return toSurvey(updated);
}

function criticalUnverifiedFor(surveyId: string, tenantId: string): SurveyMeasurementRecord[] {
	const roomIds = new Set(surveyRooms(surveyId, tenantId).map((room) => room.id));
	return allMeasurements().filter(
		(row) =>
			row.tenantId === tenantId &&
			roomIds.has(row.surveyRoomId) &&
			row.isManufacturingCritical &&
			row.verifiedAt === null
	);
}

function auditTransition(
	tenantId: string,
	survey: SurveyRecord,
	action: SurveyAction,
	extra: Record<string, unknown> = {}
): void {
	if (action === 'reopen') {
		auditSurvey(tenantId, survey.id, 'reopen', extra);
		return;
	}
	auditSurvey(tenantId, survey.id, 'transition', { action, status: survey.status, ...extra });
}

export async function mockTransitionSurvey(
	id: string,
	input: TransitionSurveyInput
): Promise<Survey> {
	const rule = SURVEY_TRANSITIONS[input.action];
	if (!rule) throw validation('Choose a valid survey action.');

	const { tenantId, user } = requireTenantSession(rule.permission);
	const survey = findSurvey(id, tenantId);
	assertCanReadSurvey(user, tenantId, survey);

	// A repeated identical transition is a no-op (double tap, Part 9 §16).
	if (survey.status === rule.to) return toSurvey(survey);

	if (!rule.from.includes(survey.status)) {
		throw stateConflict(
			`A survey cannot move from ${survey.status.replace('_', ' ')} to ${rule.to.replace('_', ' ')}.`
		);
	}

	if (rule.roles && !rule.roles.some((role) => user.roles.includes(role))) {
		throw new ApiError({
			code: ApiErrorCode.FORBIDDEN,
			status: 403,
			message: 'Your role cannot perform this action.'
		});
	}

	const reason = input.reason?.trim() ?? '';

	if (input.action === 'start' || input.action === 'submit') {
		if (!assignedToProject(tenantId, survey.projectId, survey.surveyorId)) {
			throw new ApiError({
				code: ApiErrorCode.FORBIDDEN,
				status: 403,
				message: 'The surveyor is no longer assigned to this project.'
			});
		}
		if (isCaptureOnly(user) && survey.surveyorId !== user.id) {
			throw new ApiError({
				code: ApiErrorCode.FORBIDDEN,
				status: 403,
				message: 'Only the assigned surveyor can start or submit this survey.'
			});
		}
	}

	if (input.action === 'submit') {
		const checklist = buildChecklist(survey, tenantId);
		if (!checklist.canSubmit) {
			throw gateBlocked({
				gate: 'submit',
				blocking_reasons:
					checklist.blockingReasons.length > 0
						? checklist.blockingReasons
						: ['The survey is not ready to submit.']
			});
		}
	}

	if (input.action === 'verify') {
		const unverified = criticalUnverifiedFor(survey.id, tenantId);
		if (unverified.length > 0) {
			throw gateBlocked({
				gate: 'verify',
				blocking_reasons: [
					`${unverified.length} manufacturing-critical measurement(s) still need verification.`,
					...unverified.map((row) => row.targetCaption ?? row.targetType.replace(/_/g, ' '))
				],
				critical_unverified_ids: unverified.map((row) => row.id)
			});
		}
	}

	if ((input.action === 'reject' || input.action === 'reopen') && reason.length === 0) {
		throw validation(
			input.action === 'reject'
				? 'Add a reason for rejecting this survey.'
				: 'Add a reason for reopening this survey.',
			{ reason: 'A reason is required.' }
		);
	}

	const now = nowIso();
	const updated: SurveyRecord = { ...survey, status: rule.to, updatedAt: now };
	let clearedMeasurements = 0;

	switch (input.action) {
		case 'submit':
			updated.submittedAt = now;
			break;
		case 'verify':
			updated.verifiedAt = now;
			updated.verifiedBy = user.id;
			break;
		case 'reject':
			updated.rejectedReason = reason;
			break;
		case 'resume':
			updated.rejectedReason = null;
			break;
		case 'cancel':
			break;
		case 'reopen': {
			updated.reopenCount = survey.reopenCount + 1;
			updated.verifiedAt = null;
			updated.verifiedBy = null;
			// Part 4 §2: reopen clears every verification so G8 must pass again.
			const roomIds = new Set(surveyRooms(survey.id, tenantId).map((room) => room.id));
			updateCollection<SurveyMeasurementRecord>(COLLECTIONS.surveyMeasurements, (rows) =>
				rows.map((row) => {
					if (row.tenantId !== tenantId || !roomIds.has(row.surveyRoomId)) return row;
					if (row.verifiedAt === null && row.verifiedBy === null) return row;
					clearedMeasurements += 1;
					return {
						...row,
						verifiedAt: null,
						verifiedBy: null,
						verificationMethod: null,
						verificationNote: null,
						updatedAt: now
					};
				})
			);
			break;
		}
		case 'start':
		default:
			break;
	}

	saveSurvey(updated);
	auditTransition(tenantId, updated, input.action, {
		reason: reason.length > 0 ? reason : null,
		...(input.action === 'reopen' ? { clearedMeasurements } : {})
	});
	return toSurvey(updated);
}

/* ------------------------------------------------------------------ */
/* Rooms                                                               */
/* ------------------------------------------------------------------ */

function upsertRoomMeasurement(
	survey: SurveyRecord,
	room: SurveyRoomRecord,
	targetType: 'ceiling_height' | 'room_length' | 'room_width',
	valueMm: number,
	tenantId: string
): void {
	const now = nowIso();
	const critical = isCriticalDimensionKind(targetType);
	let clearedVerification = false;

	updateCollection<SurveyMeasurementRecord>(COLLECTIONS.surveyMeasurements, (rows) => {
		const existing = rows.find(
			(row) =>
				row.tenantId === tenantId &&
				row.surveyRoomId === room.id &&
				row.targetType === targetType &&
				row.surveyWallId === null
		);

		if (!existing) {
			return [
				...rows,
				{
					id: newUuid(),
					tenantId,
					surveyRoomId: room.id,
					surveyWallId: null,
					surveyOpeningId: null,
					targetType,
					targetCaption: null,
					valueMm,
					source: 'manual',
					deviceInfo: null,
					isManufacturingCritical: critical,
					verifiedBy: null,
					verifiedAt: null,
					verificationMethod: null,
					verificationNote: null,
					capturedAt: now,
					createdAt: now,
					updatedAt: now
				}
			];
		}

		if (existing.valueMm === valueMm) return rows;
		if (existing.verifiedAt !== null) clearedVerification = true;
		return rows.map((row) =>
			row.id === existing.id
				? {
						...row,
						valueMm,
						isManufacturingCritical: critical,
						verifiedBy: null,
						verifiedAt: null,
						verificationMethod: null,
						verificationNote: null,
						updatedAt: now
					}
				: row
		);
	});

	auditSurvey(tenantId, survey.id, 'measurement_from_room', {
		roomId: room.id,
		targetType,
		valueMm,
		clearedVerification
	});
}

export async function mockCreateRoom(
	surveyId: string,
	input: CreateRoomInput
): Promise<SurveyRoom> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const survey = findSurvey(surveyId, tenantId);
	assertSurveyWritable(survey);

	const parsed = roomFormSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const now = nowIso();
	const siblings = surveyRooms(survey.id, tenantId);
	const record: SurveyRoomRecord = {
		id: newUuid(),
		tenantId,
		surveyId: survey.id,
		caption: values.caption,
		roomType: values.roomType,
		sortOrder: values.sortOrder ?? siblings.length + 1,
		ceilingHeightMm: values.ceilingHeightMm ?? null,
		roomLengthMm: values.roomLengthMm ?? null,
		roomWidthMm: values.roomWidthMm ?? null,
		shapeNotes: values.shapeNotes ?? null,
		archivedAt: null,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<SurveyRoomRecord>(COLLECTIONS.surveyRooms, (rows) => [...rows, record]);
	auditSurvey(tenantId, survey.id, 'create_room', { roomId: record.id });
	return toRoom(record);
}

export async function mockUpdateRoom(id: string, input: UpdateRoomInput): Promise<SurveyRoom> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const room = findRoom(id, tenantId);
	const survey = surveyOfRoom(room, tenantId);
	assertSurveyWritable(survey);

	const parsed = roomUpdateSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const updated: SurveyRoomRecord = { ...room };
	if (values.caption !== undefined) updated.caption = values.caption;
	if (values.roomType !== undefined) updated.roomType = values.roomType;
	if (values.shapeNotes !== undefined) updated.shapeNotes = values.shapeNotes;
	if (values.sortOrder !== undefined) updated.sortOrder = values.sortOrder;

	const dimensionWrites: Array<{
		targetType: 'ceiling_height' | 'room_length' | 'room_width';
		field: 'ceilingHeightMm' | 'roomLengthMm' | 'roomWidthMm';
		value: number | null | undefined;
	}> = [
		{ targetType: 'ceiling_height', field: 'ceilingHeightMm', value: values.ceilingHeightMm },
		{ targetType: 'room_length', field: 'roomLengthMm', value: values.roomLengthMm },
		{ targetType: 'room_width', field: 'roomWidthMm', value: values.roomWidthMm }
	];

	for (const write of dimensionWrites) {
		if (write.value === undefined) continue;
		const changed = updated[write.field] !== write.value;
		updated[write.field] = write.value;
		if (write.value === null) continue;
		// The measurement row is the audit-bearing record (Part 9 §5).
		if (changed) upsertRoomMeasurement(survey, updated, write.targetType, write.value, tenantId);
	}

	updated.updatedAt = nowIso();
	saveRoom(updated);

	auditSurvey(tenantId, survey.id, 'update_room', { roomId: room.id });
	return toRoom(updated);
}

export async function mockArchiveRoom(id: string): Promise<SurveyRoom> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const room = findRoom(id, tenantId);
	const survey = surveyOfRoom(room, tenantId);
	if (survey.status !== 'draft') {
		throw stateConflict('Rooms can only be archived while the survey is still a draft.');
	}

	const updated: SurveyRoomRecord = { ...room, archivedAt: nowIso(), updatedAt: nowIso() };
	saveRoom(updated);
	auditSurvey(tenantId, survey.id, 'archive_room', { roomId: room.id });
	return toRoom(updated);
}

/* ------------------------------------------------------------------ */
/* Walls                                                               */
/* ------------------------------------------------------------------ */

export async function mockCreateWall(
	surveyRoomId: string,
	input: CreateWallInput
): Promise<SurveyWall> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const room = findRoom(surveyRoomId, tenantId);
	const survey = surveyOfRoom(room, tenantId);
	assertSurveyWritable(survey);

	const parsed = wallFormSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const siblings = allWalls().filter(
		(row) => row.tenantId === tenantId && row.surveyRoomId === room.id
	);
	if (!uniqueWallCaption(siblings, values.caption)) {
		throw validation('Wall labels must be unique within a room.', {
			caption: 'Wall labels must be unique within a room.'
		});
	}

	const now = nowIso();
	const record: SurveyWallRecord = {
		id: newUuid(),
		tenantId,
		surveyRoomId: room.id,
		caption: values.caption,
		lengthMm: values.lengthMm,
		heightMm: values.heightMm,
		condition: values.condition ?? null,
		sortOrder: values.sortOrder ?? siblings.length + 1,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<SurveyWallRecord>(COLLECTIONS.surveyWalls, (rows) => [...rows, record]);
	auditSurvey(tenantId, survey.id, 'create_wall', { roomId: room.id, wallId: record.id });
	return toWall(record);
}

export async function mockUpdateWall(id: string, input: UpdateWallInput): Promise<SurveyWall> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const wall = findWall(id, tenantId);
	const room = findRoom(wall.surveyRoomId, tenantId);
	const survey = surveyOfRoom(room, tenantId);
	assertSurveyWritable(survey);

	const parsed = wallUpdateSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const updated: SurveyWallRecord = { ...wall };
	if (values.caption !== undefined) updated.caption = values.caption;
	if (values.lengthMm !== undefined) updated.lengthMm = values.lengthMm;
	if (values.heightMm !== undefined) updated.heightMm = values.heightMm;
	if (values.condition !== undefined) updated.condition = values.condition;
	if (values.sortOrder !== undefined) updated.sortOrder = values.sortOrder;

	const siblings = allWalls().filter(
		(row) => row.tenantId === tenantId && row.surveyRoomId === room.id
	);
	if (!uniqueWallCaption(siblings, updated.caption, updated.id)) {
		throw validation('Wall labels must be unique within a room.', {
			caption: 'Wall labels must be unique within a room.'
		});
	}

	for (const opening of allOpenings().filter(
		(row) => row.tenantId === tenantId && row.surveyWallId === updated.id
	)) {
		const reason = openingFitsWallReason(opening, updated);
		if (reason) {
			throw validation(reason, {
				lengthMm: opening.widthMm > updated.lengthMm ? reason : '',
				heightMm: opening.heightMm > updated.heightMm ? reason : ''
			});
		}
	}

	updated.updatedAt = nowIso();
	updateCollection<SurveyWallRecord>(COLLECTIONS.surveyWalls, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
	auditSurvey(tenantId, survey.id, 'update_wall', { roomId: room.id, wallId: wall.id });
	return toWall(updated);
}

/* ------------------------------------------------------------------ */
/* Openings                                                            */
/* ------------------------------------------------------------------ */

export async function mockCreateOpening(
	surveyRoomId: string,
	input: CreateOpeningInput
): Promise<SurveyOpening> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const room = findRoom(surveyRoomId, tenantId);
	const survey = surveyOfRoom(room, tenantId);
	assertSurveyWritable(survey);

	const parsed = openingFormSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;
	const wallId = values.surveyWallId ?? null;
	if (wallId) assertWallInRoom(wallId, room.id, tenantId);
	assertOpeningGeometry({ widthMm: values.widthMm, heightMm: values.heightMm }, wallId, tenantId);

	const now = nowIso();
	const record: SurveyOpeningRecord = {
		id: newUuid(),
		tenantId,
		surveyRoomId: room.id,
		surveyWallId: wallId,
		unattached: wallId === null,
		openingType: values.openingType,
		caption: values.caption ?? null,
		widthMm: values.widthMm,
		heightMm: values.heightMm,
		sillHeightMm: values.sillHeightMm ?? null,
		swingDirection: values.swingDirection ?? null,
		revealDepthMm: values.revealDepthMm ?? null,
		notes: values.notes ?? null,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<SurveyOpeningRecord>(COLLECTIONS.surveyOpenings, (rows) => [...rows, record]);
	auditSurvey(tenantId, survey.id, 'create_opening', {
		roomId: room.id,
		openingId: record.id,
		unattached: record.unattached
	});
	return toOpening(record);
}

export async function mockUpdateOpening(
	id: string,
	input: UpdateOpeningInput
): Promise<SurveyOpening> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const opening = findOpening(id, tenantId);
	const room = findRoom(opening.surveyRoomId, tenantId);
	const survey = surveyOfRoom(room, tenantId);
	assertSurveyWritable(survey);

	const parsed = openingUpdateSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const merged: SurveyOpeningRecord = { ...opening };
	if (values.openingType !== undefined) merged.openingType = values.openingType;
	if (values.caption !== undefined) merged.caption = values.caption;
	if (values.widthMm !== undefined) merged.widthMm = values.widthMm;
	if (values.heightMm !== undefined) merged.heightMm = values.heightMm;
	if (values.sillHeightMm !== undefined) merged.sillHeightMm = values.sillHeightMm;
	if (values.swingDirection !== undefined) merged.swingDirection = values.swingDirection;
	if (values.revealDepthMm !== undefined) merged.revealDepthMm = values.revealDepthMm;
	if (values.notes !== undefined) merged.notes = values.notes;
	if (values.surveyWallId !== undefined) {
		merged.surveyWallId = values.surveyWallId;
		merged.unattached = values.surveyWallId === null;
	}

	// Re-check the conditional rules against the merged row (Partial only
	// proves the fields that were sent).
	if (requiresSill(merged.openingType) && merged.sillHeightMm === null) {
		throw validation('A window needs a sill height.', {
			sillHeightMm: 'A window needs a sill height.'
		});
	}
	if (requiresSwing(merged.openingType) && !merged.swingDirection) {
		throw validation('A door needs a swing direction.', {
			swingDirection: 'A door needs a swing direction.'
		});
	}
	if (merged.surveyWallId) assertWallInRoom(merged.surveyWallId, room.id, tenantId);
	assertOpeningGeometry(merged, merged.surveyWallId, tenantId);

	merged.updatedAt = nowIso();
	updateCollection<SurveyOpeningRecord>(COLLECTIONS.surveyOpenings, (rows) =>
		rows.map((row) => (row.id === merged.id ? merged : row))
	);
	auditSurvey(tenantId, survey.id, 'update_opening', {
		roomId: room.id,
		openingId: opening.id
	});
	return toOpening(merged);
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

export async function mockCreateUtility(
	surveyRoomId: string,
	input: CreateUtilityInput
): Promise<SurveyUtility> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const room = findRoom(surveyRoomId, tenantId);
	const survey = surveyOfRoom(room, tenantId);
	assertSurveyWritable(survey);

	const parsed = utilityFormSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;
	const wallId = values.surveyWallId ?? null;
	if (wallId) assertWallInRoom(wallId, room.id, tenantId);

	const now = nowIso();
	const record: SurveyUtilityRecord = {
		id: newUuid(),
		tenantId,
		surveyRoomId: room.id,
		surveyWallId: wallId,
		utilityType: values.utilityType,
		locationDesc: values.locationDesc,
		positionOffsetMm: values.positionOffsetMm ?? null,
		heightFromFloorMm: values.heightFromFloorMm ?? null,
		notes: values.notes ?? null,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<SurveyUtilityRecord>(COLLECTIONS.surveyUtilities, (rows) => [...rows, record]);
	auditSurvey(tenantId, survey.id, 'create_utility', {
		roomId: room.id,
		utilityId: record.id
	});
	return toUtility(record);
}

export async function mockUpdateUtility(
	id: string,
	input: UpdateUtilityInput
): Promise<SurveyUtility> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const utility = findUtility(id, tenantId);
	const room = findRoom(utility.surveyRoomId, tenantId);
	const survey = surveyOfRoom(room, tenantId);
	assertSurveyWritable(survey);

	const parsed = utilityUpdateSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;
	if (values.surveyWallId) assertWallInRoom(values.surveyWallId, room.id, tenantId);

	const updated: SurveyUtilityRecord = { ...utility };
	if (values.utilityType !== undefined) updated.utilityType = values.utilityType;
	if (values.locationDesc !== undefined) updated.locationDesc = values.locationDesc;
	if (values.positionOffsetMm !== undefined) updated.positionOffsetMm = values.positionOffsetMm;
	if (values.heightFromFloorMm !== undefined) updated.heightFromFloorMm = values.heightFromFloorMm;
	if (values.notes !== undefined) updated.notes = values.notes;
	if (values.surveyWallId !== undefined) updated.surveyWallId = values.surveyWallId;
	updated.updatedAt = nowIso();

	updateCollection<SurveyUtilityRecord>(COLLECTIONS.surveyUtilities, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
	auditSurvey(tenantId, survey.id, 'update_utility', {
		roomId: room.id,
		utilityId: utility.id
	});
	return toUtility(updated);
}

/* ------------------------------------------------------------------ */
/* Obstacles                                                           */
/* ------------------------------------------------------------------ */

export async function mockCreateObstacle(
	surveyRoomId: string,
	input: CreateObstacleInput
): Promise<SurveyObstacle> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const room = findRoom(surveyRoomId, tenantId);
	const survey = surveyOfRoom(room, tenantId);
	assertSurveyWritable(survey);

	const parsed = obstacleFormSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const now = nowIso();
	const record: SurveyObstacleRecord = {
		id: newUuid(),
		tenantId,
		surveyRoomId: room.id,
		obstacleType: values.obstacleType,
		description: values.description,
		widthMm: values.widthMm ?? null,
		heightMm: values.heightMm ?? null,
		depthMm: values.depthMm ?? null,
		blocksPositioning: values.blocksPositioning ?? false,
		positionDesc: values.positionDesc ?? null,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<SurveyObstacleRecord>(COLLECTIONS.surveyObstacles, (rows) => [...rows, record]);
	auditSurvey(tenantId, survey.id, 'create_obstacle', {
		roomId: room.id,
		obstacleId: record.id
	});
	return toObstacle(record);
}

export async function mockUpdateObstacle(
	id: string,
	input: UpdateObstacleInput
): Promise<SurveyObstacle> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const obstacle = findObstacle(id, tenantId);
	const room = findRoom(obstacle.surveyRoomId, tenantId);
	const survey = surveyOfRoom(room, tenantId);
	assertSurveyWritable(survey);

	const parsed = obstacleUpdateSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const updated: SurveyObstacleRecord = { ...obstacle };
	if (values.obstacleType !== undefined) updated.obstacleType = values.obstacleType;
	if (values.description !== undefined) updated.description = values.description;
	if (values.widthMm !== undefined) updated.widthMm = values.widthMm;
	if (values.heightMm !== undefined) updated.heightMm = values.heightMm;
	if (values.depthMm !== undefined) updated.depthMm = values.depthMm;
	if (values.blocksPositioning !== undefined) updated.blocksPositioning = values.blocksPositioning;
	if (values.positionDesc !== undefined) updated.positionDesc = values.positionDesc;
	updated.updatedAt = nowIso();

	updateCollection<SurveyObstacleRecord>(COLLECTIONS.surveyObstacles, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
	auditSurvey(tenantId, survey.id, 'update_obstacle', {
		roomId: room.id,
		obstacleId: obstacle.id
	});
	return toObstacle(updated);
}

/* ------------------------------------------------------------------ */
/* Measurements                                                        */
/* ------------------------------------------------------------------ */

export async function mockCreateMeasurement(
	surveyId: string,
	input: CreateMeasurementInput
): Promise<SurveyMeasurement> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const survey = findSurvey(surveyId, tenantId);
	assertSurveyWritable(survey);

	const parsed = measurementFormSchema.safeParse({ ...input, surveyRoomId: input.surveyRoomId });
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const room = findRoom(values.surveyRoomId, tenantId);
	if (room.surveyId !== survey.id) {
		throw validation('Choose a room from this survey.', {
			surveyRoomId: 'Choose a room from this survey.'
		});
	}
	if (measurementRequiresCaption(values.targetType) && !values.targetCaption) {
		throw validation('Name the custom measurement.', {
			targetCaption: 'Name the custom measurement.'
		});
	}
	if (requiresDeviceInfo(values.source) && !values.deviceInfo) {
		throw validation('Record the device or file this reading came from.', {
			deviceInfo: 'Record the device or file this reading came from.'
		});
	}
	if (values.surveyWallId) assertWallInRoom(values.surveyWallId, room.id, tenantId);
	if (values.surveyOpeningId) assertOpeningInRoom(values.surveyOpeningId, room.id, tenantId);

	const now = nowIso();
	const record: SurveyMeasurementRecord = {
		id: newUuid(),
		tenantId,
		surveyRoomId: room.id,
		surveyWallId: values.surveyWallId ?? null,
		surveyOpeningId: values.surveyOpeningId ?? null,
		targetType: values.targetType,
		targetCaption: values.targetCaption ?? null,
		valueMm: values.valueMm,
		source: values.source,
		deviceInfo: values.deviceInfo ?? null,
		isManufacturingCritical: isCriticalDimensionKind(values.targetType),
		verifiedBy: null,
		verifiedAt: null,
		verificationMethod: null,
		verificationNote: null,
		capturedAt: values.capturedAt ?? now,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<SurveyMeasurementRecord>(COLLECTIONS.surveyMeasurements, (rows) => [
		...rows,
		record
	]);
	auditSurvey(tenantId, survey.id, 'create_measurement', {
		roomId: room.id,
		measurementId: record.id,
		targetType: record.targetType,
		critical: record.isManufacturingCritical
	});
	return toMeasurement(record);
}

export async function mockUpdateMeasurement(
	id: string,
	input: UpdateMeasurementInput
): Promise<SurveyMeasurement> {
	const { tenantId } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const measurement = findMeasurement(id, tenantId);
	const survey = surveyOfMeasurement(measurement, tenantId);
	assertSurveyWritable(survey);

	const parsed = measurementUpdateSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const updated: SurveyMeasurementRecord = { ...measurement };
	if (values.targetType !== undefined) updated.targetType = values.targetType;
	if (values.targetCaption !== undefined) updated.targetCaption = values.targetCaption;
	if (values.valueMm !== undefined) updated.valueMm = values.valueMm;
	if (values.source !== undefined) updated.source = values.source;
	if (values.deviceInfo !== undefined) updated.deviceInfo = values.deviceInfo;

	if (measurementRequiresCaption(updated.targetType) && !updated.targetCaption) {
		throw validation('Name the custom measurement.', {
			targetCaption: 'Name the custom measurement.'
		});
	}
	if (requiresDeviceInfo(updated.source) && !updated.deviceInfo) {
		throw validation('Record the device or file this reading came from.', {
			deviceInfo: 'Record the device or file this reading came from.'
		});
	}

	const valueChanged = values.valueMm !== undefined && values.valueMm !== measurement.valueMm;
	const targetChanged =
		values.targetType !== undefined && values.targetType !== measurement.targetType;
	if (targetChanged) {
		updated.isManufacturingCritical = isCriticalDimensionKind(updated.targetType);
		updated.verifiedBy = null;
		updated.verifiedAt = null;
		updated.verificationMethod = null;
		updated.verificationNote = null;
	}
	// Part 4 §2: a changed value invalidates an earlier verification.
	if (valueChanged) {
		updated.verifiedBy = null;
		updated.verifiedAt = null;
		updated.verificationMethod = null;
		updated.verificationNote = null;
	}
	updated.updatedAt = nowIso();

	updateCollection<SurveyMeasurementRecord>(COLLECTIONS.surveyMeasurements, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
	auditSurvey(
		tenantId,
		survey.id,
		valueChanged ? 'measurement_reverify_required' : 'update_measurement',
		{ measurementId: updated.id, valueMm: updated.valueMm }
	);
	return toMeasurement(updated);
}

export async function mockVerifyMeasurement(
	id: string,
	input: VerifyMeasurementInput
): Promise<SurveyMeasurement> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_APPROVE);
	const measurement = findMeasurement(id, tenantId);
	const survey = surveyOfMeasurement(measurement, tenantId);
	assertCanReadSurvey(user, tenantId, survey);

	if (survey.status === 'verified') {
		throw stateConflict('Reopen the survey before editing verified data.');
	}
	if (survey.status !== 'in_progress' && survey.status !== 'submitted') {
		throw stateConflict(
			'Measurements can only be verified while the survey is in progress or submitted.'
		);
	}

	const parsed = verifyMeasurementSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const now = nowIso();
	const updated: SurveyMeasurementRecord = {
		...measurement,
		verifiedBy: user.id,
		verifiedAt: now,
		verificationMethod: values.method,
		verificationNote: values.note ?? null,
		updatedAt: now
	};

	updateCollection<SurveyMeasurementRecord>(COLLECTIONS.surveyMeasurements, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
	auditSurvey(tenantId, survey.id, 'verify_measurement', {
		measurementId: updated.id,
		method: values.method
	});
	return toMeasurement(updated);
}

export async function mockCriticalMeasurements(surveyId: string): Promise<SurveyMeasurement[]> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_VIEW);
	const survey = findSurvey(surveyId, tenantId);
	assertCanReadSurvey(user, tenantId, survey);
	const roomIds = new Set(surveyRooms(survey.id, tenantId).map((room) => room.id));
	return allMeasurements()
		.filter(
			(row) =>
				row.tenantId === tenantId && roomIds.has(row.surveyRoomId) && row.isManufacturingCritical
		)
		.sort(
			(first, second) =>
				(first.verifiedAt === null ? 0 : 1) - (second.verifiedAt === null ? 0 : 1) ||
				first.id.localeCompare(second.id)
		)
		.map(toMeasurement);
}

/* ------------------------------------------------------------------ */
/* Notes (append-only revisions)                                       */
/* ------------------------------------------------------------------ */

export async function mockCreateNote(
	surveyId: string,
	input: CreateNoteInput
): Promise<SurveyNote> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const survey = findSurvey(surveyId, tenantId);
	assertSurveyWritable(survey);

	const parsed = noteFormSchema.safeParse({
		surveyRoomId: input.surveyRoomId ?? null,
		category: input.category,
		body: input.body
	});
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	if (values.surveyRoomId) {
		const room = findRoom(values.surveyRoomId, tenantId);
		if (room.surveyId !== survey.id) {
			throw validation('Choose a room from this survey.', {
				surveyRoomId: 'Choose a room from this survey.'
			});
		}
	}

	const now = nowIso();
	const record: SurveyNoteRecord = {
		id: newUuid(),
		tenantId,
		surveyId: survey.id,
		surveyRoomId: values.surveyRoomId,
		category: values.category,
		body: values.body,
		revision: 1,
		supersedesNoteId: null,
		createdBy: user.id,
		createdAt: now
	};

	updateCollection<SurveyNoteRecord>(COLLECTIONS.surveyNotes, (rows) => [...rows, record]);
	auditSurvey(tenantId, survey.id, 'create_note', { noteId: record.id });
	return toNote(record);
}

export async function mockReviseNote(noteId: string, input: ReviseNoteInput): Promise<SurveyNote> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.SURVEY_UPDATE);
	const original = findNote(noteId, tenantId);
	const survey = findSurvey(original.surveyId, tenantId);
	if (survey.status === 'cancelled') {
		throw stateConflict('This survey was cancelled and can no longer be edited.');
	}

	const parsed = noteRevisionSchema.safeParse(input);
	if (!parsed.success) throw mapZodError(parsed.error);

	const record: SurveyNoteRecord = {
		id: newUuid(),
		tenantId,
		surveyId: original.surveyId,
		surveyRoomId: original.surveyRoomId,
		category: original.category,
		body: parsed.data.body,
		revision: original.revision + 1,
		supersedesNoteId: original.id,
		createdBy: user.id,
		createdAt: nowIso()
	};

	updateCollection<SurveyNoteRecord>(COLLECTIONS.surveyNotes, (rows) => [...rows, record]);
	auditSurvey(tenantId, survey.id, 'note_revision', {
		noteId: original.id,
		revisionId: record.id,
		revision: record.revision
	});
	return toNote(record);
}

/* ------------------------------------------------------------------ */
/* Offline seam helper                                                 */
/* ------------------------------------------------------------------ */

/**
 * Pre-write row version for the outbox precondition. Read-only and
 * permission-free: the provider calls it immediately before a write that has
 * already been authorised, and the sync mock uses the same row versions.
 */
export function surveyRowUpdatedAt(entity: string, id: string): string | null {
	switch (entity) {
		case 'survey':
			return (
				getCollection<SurveyRecord>(COLLECTIONS.surveys).find((row) => row.id === id)?.updatedAt ??
				null
			);
		case 'room':
			return allRooms().find((row) => row.id === id)?.updatedAt ?? null;
		case 'wall':
			return allWalls().find((row) => row.id === id)?.updatedAt ?? null;
		case 'opening':
			return allOpenings().find((row) => row.id === id)?.updatedAt ?? null;
		case 'utility':
			return (
				getCollection<SurveyUtilityRecord>(COLLECTIONS.surveyUtilities).find((row) => row.id === id)
					?.updatedAt ?? null
			);
		case 'obstacle':
			return (
				getCollection<SurveyObstacleRecord>(COLLECTIONS.surveyObstacles).find(
					(row) => row.id === id
				)?.updatedAt ?? null
			);
		case 'measurement':
			return allMeasurements().find((row) => row.id === id)?.updatedAt ?? null;
		case 'note':
			return (
				getCollection<SurveyNoteRecord>(COLLECTIONS.surveyNotes).find((row) => row.id === id)
					?.createdAt ?? null
			);
		default:
			return null;
	}
}

/** Exposed for the outbox wrapper: the row payload after a write. */
export function surveyRowPayload(entity: string, id: string): Record<string, unknown> | null {
	const asPayload = (row: object | null | undefined): Record<string, unknown> | null =>
		row ? { ...row } : null;

	switch (entity) {
		case 'survey':
			return asPayload(
				getCollection<SurveyRecord>(COLLECTIONS.surveys).find((row) => row.id === id)
			);
		case 'room':
			return asPayload(allRooms().find((row) => row.id === id));
		case 'wall':
			return asPayload(allWalls().find((row) => row.id === id));
		case 'opening':
			return asPayload(allOpenings().find((row) => row.id === id));
		case 'utility':
			return asPayload(
				getCollection<SurveyUtilityRecord>(COLLECTIONS.surveyUtilities).find((row) => row.id === id)
			);
		case 'obstacle':
			return asPayload(
				getCollection<SurveyObstacleRecord>(COLLECTIONS.surveyObstacles).find(
					(row) => row.id === id
				)
			);
		case 'measurement':
			return asPayload(allMeasurements().find((row) => row.id === id));
		case 'note':
			return asPayload(
				getCollection<SurveyNoteRecord>(COLLECTIONS.surveyNotes).find((row) => row.id === id)
			);
		default:
			return null;
	}
}

export function surveyActionTarget(action: SurveyAction): string {
	return SURVEY_TRANSITIONS[action].to;
}

export { SURVEY_ACTIONS };
