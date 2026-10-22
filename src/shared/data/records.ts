import type {
	CustomerSource,
	CustomerState,
	ImportKind,
	ImportOutcome,
	ImportStatus,
	ImportValidation,
	PreferredChannel,
	ProjectStatus,
	ProjectType,
	PropertyState
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
