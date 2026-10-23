import type {
	AssetUploadState,
	CustomerSource,
	CustomerState,
	ImportKind,
	ImportOutcome,
	ImportStatus,
	ImportValidation,
	PreferredChannel,
	ProjectStatus,
	ProjectType,
	PropertyState,
	SurveyState,
	SyncOpState
} from '$shared/domain/record-states';
import type { TenantRole } from '$shared/domain/roles';
import type { TenantBrandingEnvelope, TenantStatus } from '$shared/domain/user';
import type { Uuid } from '$shared/domain/uuid';

/**
 * Storage records for the browser mock backend (orchestrator-owned contract).
 *
 * The mock DB behaves like a server, so these shapes are shared across module
 * mocks. Domain types stay in each module; adapters map records → domain.
 * Types are versioned through `MOCK_DB_SCHEMA_VERSION`, not by editing these
 * interfaces in place without a migration.
 */

export interface TenantRecord {
	id: Uuid;
	slug: string;
	legalName: string;
	displayName: string;
	status: TenantStatus;
	branding: TenantBrandingEnvelope | null;
	defaultCurrency: string;
	vatNumber: string | null;
	referencePattern: string | null;
	emailDomain: string | null;
	createdAt: string;
	updatedAt: string;
}

export type AppUserStatus = 'active' | 'invited' | 'disabled';

export interface AppUserRecord {
	id: Uuid;
	/** Null for platform staff: they belong to no tenant. */
	tenantId: Uuid | null;
	email: string;
	displayName: string;
	roles: TenantRole[];
	/** Platform staff hold the platform claim instead of a tenant role. */
	platform: boolean;
	mfaEnrolled: boolean;
	status: AppUserStatus;
	/** Effective permission codes, derived from roles at seed time. */
	permissions: string[];
	/** Demo-only credential; the mock backend is never shipped to production. */
	password: string;
	createdAt: string;
	updatedAt: string;
}

export interface UserInvitationRecord {
	id: Uuid;
	tenantId: Uuid;
	email: string;
	displayName: string;
	role: TenantRole;
	/** Opaque invitation token used by `/invite/:token`. */
	token: string;
	createdAt: string;
	expiresAt: string;
	acceptedAt: string | null;
}

/* ------------------------------------------------------------------ */
/* Phase 1 — records spine storage records (versioned by schema bump). */
/* ------------------------------------------------------------------ */

export interface CustomerRecord {
	id: Uuid;
	tenantId: Uuid;
	caption: string;
	contactName: string | null;
	email: string | null;
	phone: string | null;
	addressLine1: string | null;
	addressLine2: string | null;
	town: string | null;
	postcode: string | null;
	preferredChannel: PreferredChannel;
	source: CustomerSource;
	/** Reserved CRM seam; intentionally null until CRM tables exist. */
	leadUuid: Uuid | null;
	state: CustomerState;
	/** Existing record this held row duplicates (R5), if any. */
	dedupOfId: Uuid | null;
	reviewNote: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: Uuid | null;
	archivedAt: string | null;
}

export interface PropertyRecord {
	id: Uuid;
	tenantId: Uuid;
	customerId: Uuid;
	addressLine1: string;
	addressLine2: string | null;
	town: string | null;
	postcode: string | null;
	accessNotes: string | null;
	state: PropertyState;
	dedupOfId: Uuid | null;
	reviewNote: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: Uuid | null;
	archivedAt: string | null;
}

export interface ProjectRecord {
	id: Uuid;
	tenantId: Uuid;
	customerId: Uuid;
	propertyId: Uuid;
	caption: string;
	reference: string;
	projectType: ProjectType;
	status: ProjectStatus;
	state: 'active' | 'archived' | 'pending_review' | 'cancelled';
	dedupOfId: Uuid | null;
	reviewNote: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: Uuid | null;
	archivedAt: string | null;
}

export interface ProjectUserRecord {
	id: Uuid;
	tenantId: Uuid;
	projectId: Uuid;
	userId: Uuid;
	assignedAt: string;
	assignedBy: Uuid | null;
}

export interface ImportBatchRecord {
	id: Uuid;
	tenantId: Uuid;
	kind: ImportKind;
	status: ImportStatus;
	fileName: string;
	columnMap: Record<string, string>;
	totalRows: number;
	importedRows: number;
	readyRows: number;
	reviewRows: number;
	rejectedRows: number;
	createdAt: string;
	updatedAt: string;
	createdBy: Uuid | null;
	committedAt: string | null;
}

export interface ImportRowRecord {
	id: Uuid;
	tenantId: Uuid;
	batchId: Uuid;
	rowNo: number;
	payload: Record<string, string>;
	validation: ImportValidation;
	/** Null until the batch is committed. */
	outcome: ImportOutcome | null;
	error: string | null;
	entityType: string | null;
	entityId: Uuid | null;
	createdAt: string;
}

export type AuditScope = 'platform' | 'tenant';

export interface AuditEventRecord {
	id: Uuid;
	scope: AuditScope;
	/** Tenant the event belongs to; the subject for platform events. */
	tenantId: Uuid | null;
	actorUserId: Uuid | null;
	actorEmail: string;
	action: string;
	subjectType: string;
	subjectId: Uuid | null;
	occurredAt: string;
	payload: Record<string, unknown> | null;
}

/* ------------------------------------------------------------------ */
/* Phase 2 — survey capture, assets and the sync outbox.               */
/* Vocabulary that belongs to one module (room types, measurement      */
/* kinds, …) stays a `string` here and is narrowed by the module       */
/* domain + adapter; only the canonical state unions are shared.       */
/* ------------------------------------------------------------------ */

export interface SurveyRecord {
	id: Uuid;
	tenantId: Uuid;
	projectId: Uuid;
	surveyorId: Uuid;
	caption: string;
	appointmentAt: string;
	status: SurveyState;
	/** Incremented by every audited reopen (Part 4 §2). */
	reopenCount: number;
	submittedAt: string | null;
	verifiedAt: string | null;
	verifiedBy: Uuid | null;
	rejectedReason: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: Uuid | null;
}

export interface SurveyRoomRecord {
	id: Uuid;
	tenantId: Uuid;
	surveyId: Uuid;
	caption: string;
	roomType: string;
	sortOrder: number;
	ceilingHeightMm: number | null;
	roomLengthMm: number | null;
	roomWidthMm: number | null;
	shapeNotes: string | null;
	/** Archive replaces hard delete; only legal while the survey is `draft`. */
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SurveyWallRecord {
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

export interface SurveyOpeningRecord {
	id: Uuid;
	tenantId: Uuid;
	surveyRoomId: Uuid;
	surveyWallId: Uuid | null;
	/** True when the opening was captured without a wall reference (S4). */
	unattached: boolean;
	openingType: string;
	caption: string | null;
	widthMm: number;
	heightMm: number;
	sillHeightMm: number | null;
	swingDirection: string | null;
	revealDepthMm: number | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SurveyUtilityRecord {
	id: Uuid;
	tenantId: Uuid;
	surveyRoomId: Uuid;
	surveyWallId: Uuid | null;
	utilityType: string;
	locationDesc: string;
	positionOffsetMm: number | null;
	heightFromFloorMm: number | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SurveyObstacleRecord {
	id: Uuid;
	tenantId: Uuid;
	surveyRoomId: Uuid;
	obstacleType: string;
	description: string;
	widthMm: number | null;
	heightMm: number | null;
	depthMm: number | null;
	blocksPositioning: boolean;
	positionDesc: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SurveyMeasurementRecord {
	id: Uuid;
	tenantId: Uuid;
	surveyRoomId: Uuid;
	surveyWallId: Uuid | null;
	surveyOpeningId: Uuid | null;
	targetType: string;
	targetCaption: string | null;
	valueMm: number;
	source: string;
	deviceInfo: string | null;
	/** Server-set from the critical kind list (Part 9 §10) — never client input. */
	isManufacturingCritical: boolean;
	verifiedBy: Uuid | null;
	verifiedAt: string | null;
	verificationMethod: string | null;
	verificationNote: string | null;
	capturedAt: string;
	createdAt: string;
	updatedAt: string;
}

export interface SurveyNoteRecord {
	id: Uuid;
	tenantId: Uuid;
	surveyId: Uuid;
	/** Null for a survey-level note (Part 9 §11). */
	surveyRoomId: Uuid | null;
	category: string;
	body: string;
	/** Append-only revisions: edits create a new row (S6/R3). */
	revision: number;
	supersedesNoteId: Uuid | null;
	createdBy: Uuid | null;
	createdAt: string;
}

export interface AssetRecord {
	id: Uuid;
	tenantId: Uuid;
	/** Exactly one owner beyond the survey grouping (Part 9 §12). */
	ownerType: string;
	ownerId: Uuid;
	assetKind: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	sha256: string;
	uploadState: AssetUploadState;
	caption: string | null;
	/** Mock signed URL; short-lived and never a public path (Part 10 §8). */
	signedUrl: string | null;
	signedUrlExpiresAt: string | null;
	capturedAt: string | null;
	deviceModel: string | null;
	orientation: string | null;
	uploadedBy: Uuid | null;
	createdAt: string;
	updatedAt: string;
}

export interface SyncConflictRecord {
	serverUpdatedAt: string;
	server: Record<string, unknown>;
	local: Record<string, unknown>;
	fields: string[];
}

export interface SyncOperationRecord {
	id: Uuid;
	tenantId: Uuid;
	userId: Uuid;
	/** UUIDv7-shaped, stable across reloads; the replay key (Part 9 §13). */
	idempotencyKey: string;
	entity: string;
	op: string;
	localId: Uuid;
	payload: Record<string, unknown>;
	/** Row version the local edit was based on; the push precondition. */
	baseUpdatedAt: string | null;
	state: SyncOpState;
	attempts: number;
	lastError: string | null;
	conflict: SyncConflictRecord | null;
	/** Original server result, replayed verbatim for a duplicate push. */
	result: Record<string, unknown> | null;
	clientTimestamp: string;
	createdAt: string;
	sentAt: string | null;
}
