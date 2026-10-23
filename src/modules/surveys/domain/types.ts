import type { Page } from '$shared/domain/pagination';
import { PERMISSIONS } from '$shared/domain/permissions';
import {
	SURVEY_STATES,
	type AssetUploadState,
	type SurveyState
} from '$shared/domain/record-states';
import { ROLES, type TenantRole } from '$shared/domain/roles';
import type { Uuid } from '$shared/domain/uuid';

export { SURVEY_STATES };
export type { SurveyState };

/**
 * Survey domain contracts (spec Part 9 field sets, Part 4 §2 machine,
 * Part 10 §7 endpoints).
 *
 * Dimension fields are integer millimetres everywhere (Part 9 §1). The wire
 * format is snake_case; the repository maps it to these camelCase contracts.
 */

/* ------------------------------------------------------------------ */
/* Machine (Part 4 §2)                                                 */
/* ------------------------------------------------------------------ */

export const SURVEY_ACTIONS = [
	'start',
	'submit',
	'verify',
	'reject',
	'reopen',
	'cancel',
	'resume'
] as const;
export type SurveyAction = (typeof SURVEY_ACTIONS)[number];

export interface SurveyTransitionRule {
	from: readonly SurveyState[];
	to: SurveyState;
	permission: string;
	/**
	 * Extra role gate from the Part 4 §2 actor column. `null` means the
	 * permission code alone decides. Part 4 §2 lists Designer for verify and
	 * reject, but the canonical RBAC matrix (Part 6 §3) grants Designer only
	 * `survey.view`, so the matrix wins and Designer is not listed here —
	 * reported in the phase report.
	 */
	roles: readonly TenantRole[] | null;
}

export const SURVEY_TRANSITIONS: Readonly<Record<SurveyAction, SurveyTransitionRule>> =
	Object.freeze({
		start: {
			from: ['draft'],
			to: 'in_progress',
			permission: PERMISSIONS.SURVEY_UPDATE,
			roles: null
		},
		submit: {
			from: ['in_progress'],
			to: 'submitted',
			permission: PERMISSIONS.SURVEY_UPDATE,
			roles: null
		},
		verify: {
			from: ['submitted'],
			to: 'verified',
			permission: PERMISSIONS.SURVEY_APPROVE,
			roles: [ROLES.SURVEYOR, ROLES.PRODUCTION_MANAGER]
		},
		reject: {
			from: ['submitted'],
			to: 'rejected',
			permission: PERMISSIONS.SURVEY_APPROVE,
			roles: [ROLES.PRODUCTION_MANAGER]
		},
		reopen: {
			from: ['verified'],
			to: 'submitted',
			permission: PERMISSIONS.SURVEY_APPROVE,
			roles: [ROLES.PRODUCTION_MANAGER]
		},
		cancel: {
			from: ['draft', 'in_progress', 'submitted'],
			to: 'cancelled',
			permission: PERMISSIONS.SURVEY_ARCHIVE,
			roles: [ROLES.OWNER_MANAGEMENT]
		},
		/** `rejected → in_progress` resubmit path (Part 4 §2). */
		resume: {
			from: ['rejected'],
			to: 'in_progress',
			permission: PERMISSIONS.SURVEY_UPDATE,
			roles: null
		}
	});

export interface TransitionSurveyInput {
	action: SurveyAction;
	/** Required for reject and reopen; recorded in the audit trail. */
	reason?: string | null;
}

/* ------------------------------------------------------------------ */
/* Vocabulary (Part 9 §5–§11)                                          */
/* ------------------------------------------------------------------ */

export const ROOM_TYPES = [
	'kitchen',
	'bedroom',
	'bathroom',
	'en_suite',
	'utility',
	'dining',
	'living',
	'hall',
	'other'
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const OPENING_TYPES = ['door', 'window', 'skylight', 'opening', 'hatch', 'other'] as const;
export type OpeningType = (typeof OPENING_TYPES)[number];

export const SWING_DIRECTIONS = ['left', 'right', 'double', 'sliding', 'none'] as const;
export type SwingDirection = (typeof SWING_DIRECTIONS)[number];

export const UTILITY_TYPES = [
	'water',
	'drain',
	'gas',
	'electric',
	'data',
	'vent',
	'heating',
	'other'
] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

export const OBSTACLE_TYPES = [
	'pipe',
	'radiator',
	'column',
	'beam',
	'chimney',
	'stair',
	'fixed_furniture',
	'other'
] as const;
export type ObstacleType = (typeof OBSTACLE_TYPES)[number];

export const MEASUREMENT_TARGET_TYPES = [
	'ceiling_height',
	'room_length',
	'room_width',
	'wall_length',
	'wall_height',
	'door_width',
	'door_height',
	'window_width',
	'window_height',
	'sill_height',
	'opening_width',
	'opening_height',
	'other'
] as const;
export type MeasurementTargetType = (typeof MEASUREMENT_TARGET_TYPES)[number];

/** Provenance is mandatory on every measurement (S8). */
export const MEASUREMENT_SOURCES = [
	'laser',
	'lidar',
	'plan',
	'manual',
	'photo',
	'imported_file'
] as const;
export type MeasurementSource = (typeof MEASUREMENT_SOURCES)[number];

/** G8 input: a verification without a method is rejected (S9). */
export const VERIFICATION_METHODS = [
	're_measure',
	'cross_check_plan',
	'photo_check',
	'second_surveyor'
] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const NOTE_CATEGORIES = [
	'general',
	'observation',
	'issue',
	'customer_request',
	'access',
	'other'
] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

/**
 * Manufacturing-critical measurement targets (gate G8, Part 9 §10).
 *
 * The spec makes this tenant configuration (`setting
 * manufacturing_critical_target_types`) resolved server-side. The settings
 * module does not exist yet, so the mock backend defaults to the
 * design-driving dimensions below.
 *
 * TODO(phase-8): load from the settings module and delete this constant.
 * TODO(phase-8): the tenant setting may add or remove kinds; the client must
 * keep rendering `isManufacturingCritical` from the server, never from here.
 */
export const CRITICAL_DIMENSION_KINDS: readonly MeasurementTargetType[] = Object.freeze([
	'ceiling_height',
	'room_length',
	'room_width',
	'wall_length',
	'wall_height',
	'door_width',
	'door_height',
	'window_width',
	'window_height',
	'sill_height',
	'opening_width',
	'opening_height'
]);

export function isCriticalDimensionKind(target: string): boolean {
	return (CRITICAL_DIMENSION_KINDS as readonly string[]).includes(target);
}

/* ------------------------------------------------------------------ */
/* Entities (Part 5 §4.4–4.11)                                         */
/* ------------------------------------------------------------------ */

export interface Survey {
	id: Uuid;
	tenantId: Uuid;
	projectId: Uuid;
	surveyorId: Uuid;
	caption: string;
	appointmentAt: string;
	status: SurveyState;
	reopenCount: number;
	submittedAt: string | null;
	verifiedAt: string | null;
	verifiedBy: Uuid | null;
	rejectedReason: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: Uuid | null;
}

export interface SurveyRoom {
	id: Uuid;
	tenantId: Uuid;
	surveyId: Uuid;
	caption: string;
	roomType: RoomType;
	sortOrder: number;
	ceilingHeightMm: number | null;
	roomLengthMm: number | null;
	roomWidthMm: number | null;
	shapeNotes: string | null;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SurveyWall {
	id: Uuid;
	tenantId: Uuid;
	surveyRoomId: Uuid;
	caption: string;
	lengthMm: number;
	heightMm: number;
	condition: string | null;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface SurveyOpening {
	id: Uuid;
	tenantId: Uuid;
	surveyRoomId: Uuid;
	surveyWallId: Uuid | null;
	unattached: boolean;
	openingType: OpeningType;
	caption: string | null;
	widthMm: number;
	heightMm: number;
	sillHeightMm: number | null;
	swingDirection: SwingDirection | null;
	revealDepthMm: number | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SurveyUtility {
	id: Uuid;
	tenantId: Uuid;
	surveyRoomId: Uuid;
	surveyWallId: Uuid | null;
	utilityType: UtilityType;
	locationDesc: string;
	positionOffsetMm: number | null;
	heightFromFloorMm: number | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SurveyObstacle {
	id: Uuid;
	tenantId: Uuid;
	surveyRoomId: Uuid;
	obstacleType: ObstacleType;
	description: string;
	widthMm: number | null;
	heightMm: number | null;
	depthMm: number | null;
	blocksPositioning: boolean;
	positionDesc: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SurveyMeasurement {
	id: Uuid;
	tenantId: Uuid;
	surveyRoomId: Uuid;
	surveyWallId: Uuid | null;
	surveyOpeningId: Uuid | null;
	targetType: MeasurementTargetType;
	targetCaption: string | null;
	valueMm: number;
	source: MeasurementSource;
	deviceInfo: string | null;
	isManufacturingCritical: boolean;
	verifiedBy: Uuid | null;
	verifiedAt: string | null;
	verificationMethod: VerificationMethod | null;
	verificationNote: string | null;
	capturedAt: string;
	createdAt: string;
	updatedAt: string;
}

export interface SurveyNote {
	id: Uuid;
	tenantId: Uuid;
	surveyId: Uuid;
	surveyRoomId: Uuid | null;
	category: NoteCategory;
	body: string;
	revision: number;
	supersedesNoteId: Uuid | null;
	createdBy: Uuid | null;
	createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Aggregates (Part 10 §7)                                             */
/* ------------------------------------------------------------------ */

export interface SurveyProjectRef {
	id: Uuid;
	caption: string;
	reference: string;
	status: string;
}

export interface SurveyCustomerRef {
	id: Uuid;
	caption: string;
	email: string | null;
	phone: string | null;
}

export interface SurveyPropertyRef {
	id: Uuid;
	addressLine1: string;
	addressLine2: string | null;
	town: string | null;
	postcode: string | null;
}

export interface SurveyRoomTree {
	room: SurveyRoom;
	walls: SurveyWall[];
	openings: SurveyOpening[];
	utilities: SurveyUtility[];
	obstacles: SurveyObstacle[];
	measurements: SurveyMeasurement[];
	notes: SurveyNote[];
	/** Complete media count for the room card badge. */
	photoCount: number;
}

export const SURVEY_MEDIA_OWNER_TYPES = ['survey', 'room', 'wall', 'opening'] as const;
export type SurveyMediaOwnerType = (typeof SURVEY_MEDIA_OWNER_TYPES)[number];

/**
 * Media summary embedded in the survey aggregate. The assets module owns the
 * full `Asset` contract; this is the read-only projection the survey pages
 * group by owner (Part 10 §7 media page). Kept separate so the survey domain
 * does not import another module's domain.
 */
export interface SurveyMediaItem {
	id: Uuid;
	ownerType: SurveyMediaOwnerType;
	ownerId: Uuid;
	assetKind: string;
	caption: string | null;
	uploadState: AssetUploadState;
	url: string | null;
	capturedAt: string | null;
	createdAt: string;
}

export interface SurveyProgressCounts {
	rooms: number;
	walls: number;
	openings: number;
	utilities: number;
	obstacles: number;
	measurements: number;
	criticalMeasurements: number;
	criticalUnverified: number;
	notes: number;
	photos: number;
	/** Q9 default: completed required fields / required fields. */
	requiredTotal: number;
	requiredComplete: number;
	percent: number;
}

export interface SurveyDetail {
	survey: Survey;
	project: SurveyProjectRef;
	customer: SurveyCustomerRef | null;
	property: SurveyPropertyRef | null;
	rooms: SurveyRoomTree[];
	/** Survey-level notes (`surveyRoomId === null`). */
	surveyNotes: SurveyNote[];
	media: SurveyMediaItem[];
	counts: SurveyProgressCounts;
}

/* ------------------------------------------------------------------ */
/* Checklist (Part 9 §14) and gates                                    */
/* ------------------------------------------------------------------ */

export const CHECKLIST_ITEM_IDS = [
	'rooms',
	'room_dimensions',
	'openings',
	'geometry',
	'media_uploaded',
	'room_photos',
	'assignment',
	'critical_verified'
] as const;
export type ChecklistItemId = (typeof CHECKLIST_ITEM_IDS)[number];

export interface SurveyChecklistItem {
	id: ChecklistItemId;
	label: string;
	satisfied: boolean;
	/** Non-blocking rows are informational only (e.g. the Q15 photo rule). */
	blocking: boolean;
	detail: string | null;
}

export interface SurveyChecklist {
	surveyId: Uuid;
	items: SurveyChecklistItem[];
	/** Every unsatisfied blocking item, named — rendered by GateBanner. */
	blockingReasons: string[];
	/** True when every blocking item except G8 passes. */
	canSubmit: boolean;
	/** True when the survey is submitted and G8 passes. */
	canVerify: boolean;
	criticalUnverified: SurveyMeasurement[];
}

/**
 * `details` shape of a `gate_blocked` ApiError. `blocking_reasons` is the
 * spec wire key (GateBanner + toasts read it verbatim).
 */
export interface SurveyGateDetail {
	gate: 'submit' | 'verify';
	blocking_reasons: string[];
	critical_unverified_ids?: Uuid[];
}

/* ------------------------------------------------------------------ */
/* List (Part 10 §7)                                                   */
/* ------------------------------------------------------------------ */

export type SurveySort = 'appointmentAt' | 'createdAt' | 'updatedAt' | 'status' | 'caption';

export interface SurveyListParams {
	search?: string;
	projectId?: Uuid | null;
	status?: SurveyState | 'all';
	surveyorId?: Uuid | null;
	/** `mine` is the Surveyor default: own surveys on currently assigned projects. */
	scope?: 'all' | 'mine';
	/** Appointment window, ISO dates (YYYY-MM-DD), inclusive. */
	appointmentFrom?: string | null;
	appointmentTo?: string | null;
	sort?: SurveySort;
	sortDir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

export interface SurveyListRow {
	id: Uuid;
	caption: string;
	projectId: Uuid;
	projectCaption: string;
	projectReference: string;
	customerCaption: string;
	propertyAddress: string;
	surveyorId: Uuid;
	surveyorName: string;
	appointmentAt: string;
	status: SurveyState;
	roomCount: number;
	criticalUnverifiedCount: number;
	submittedAt: string | null;
	updatedAt: string;
}

export type SurveyPage = Page<SurveyListRow>;

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export interface CreateSurveyInput {
	caption: string;
	/** Defaults to the caller; only PM/Sales may assign another surveyor. */
	surveyorId: Uuid;
	appointmentAt: string;
}

export interface UpdateSurveyInput {
	caption?: string;
	surveyorId?: Uuid;
	appointmentAt?: string;
}

export interface CreateRoomInput {
	caption: string;
	roomType: RoomType;
	shapeNotes?: string | null;
}

export interface UpdateRoomInput {
	caption?: string;
	roomType?: RoomType;
	shapeNotes?: string | null;
	ceilingHeightMm?: number | null;
	roomLengthMm?: number | null;
	roomWidthMm?: number | null;
	sortOrder?: number;
}

export interface CreateWallInput {
	caption: string;
	lengthMm: number;
	heightMm: number;
	condition?: string | null;
}

export interface UpdateWallInput {
	caption?: string;
	lengthMm?: number;
	heightMm?: number;
	condition?: string | null;
	sortOrder?: number;
}

export interface CreateOpeningInput {
	openingType: OpeningType;
	caption?: string | null;
	widthMm: number;
	heightMm: number;
	sillHeightMm?: number | null;
	swingDirection?: SwingDirection | null;
	revealDepthMm?: number | null;
	notes?: string | null;
	/** Null leaves the opening unattached (`unattached = true`). */
	surveyWallId?: Uuid | null;
}

export interface UpdateOpeningInput {
	openingType?: OpeningType;
	caption?: string | null;
	widthMm?: number;
	heightMm?: number;
	sillHeightMm?: number | null;
	swingDirection?: SwingDirection | null;
	revealDepthMm?: number | null;
	notes?: string | null;
	surveyWallId?: Uuid | null;
}

export interface CreateUtilityInput {
	utilityType: UtilityType;
	locationDesc: string;
	positionOffsetMm?: number | null;
	heightFromFloorMm?: number | null;
	notes?: string | null;
	surveyWallId?: Uuid | null;
}

export interface UpdateUtilityInput {
	utilityType?: UtilityType;
	locationDesc?: string;
	positionOffsetMm?: number | null;
	heightFromFloorMm?: number | null;
	notes?: string | null;
	surveyWallId?: Uuid | null;
}

export interface CreateObstacleInput {
	obstacleType: ObstacleType;
	description: string;
	widthMm?: number | null;
	heightMm?: number | null;
	depthMm?: number | null;
	blocksPositioning?: boolean;
	positionDesc?: string | null;
}

export interface UpdateObstacleInput {
	obstacleType?: ObstacleType;
	description?: string;
	widthMm?: number | null;
	heightMm?: number | null;
	depthMm?: number | null;
	blocksPositioning?: boolean;
	positionDesc?: string | null;
}

export interface CreateMeasurementInput {
	targetType: MeasurementTargetType;
	/** Required when `targetType === 'other'`. */
	targetCaption?: string | null;
	valueMm: number;
	source: MeasurementSource;
	deviceInfo?: string | null;
	surveyWallId?: Uuid | null;
	surveyOpeningId?: Uuid | null;
	/** Device clock is advisory metadata only (Part 9 §1). */
	capturedAt?: string;
}

export interface UpdateMeasurementInput {
	targetType?: MeasurementTargetType;
	targetCaption?: string | null;
	valueMm?: number;
	source?: MeasurementSource;
	deviceInfo?: string | null;
}

export interface VerifyMeasurementInput {
	method: VerificationMethod;
	note?: string | null;
}

export interface CreateNoteInput {
	category: NoteCategory;
	body: string;
	/** Null creates a survey-level note. */
	surveyRoomId?: Uuid | null;
}

export interface ReviseNoteInput {
	body: string;
}
