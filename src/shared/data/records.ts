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
