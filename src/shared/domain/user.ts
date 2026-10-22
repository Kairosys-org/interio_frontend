import type { TenantRole } from './roles';
import type { Uuid } from './uuid';

/**
 * Tenant branding is an opaque envelope owned by the backend (DESIGN §2.4,
 * open question B3). The frontend validates it before applying anything.
 */
export interface TenantBrandingEnvelope {
	accent?: string;
	logoLightUrl?: string;
	logoDarkUrl?: string;
	displayName?: string;
	[key: string]: unknown;
}

export type TenantStatus = 'active' | 'suspended' | 'offboarded';

export interface TenantIdentity {
	id: Uuid;
	slug: string;
	legalName: string;
	status: TenantStatus;
	branding: TenantBrandingEnvelope | null;
}

export interface SessionUser {
	id: Uuid;
	email: string;
	displayName: string;
	roles: TenantRole[];
	/** Effective permission codes from the server (authoritative). */
	permissions: string[];
	/** Null for platform staff — they are not members of any tenant. */
	tenant: TenantIdentity | null;
	platform: boolean;
	mfaEnrolled: boolean;
}

export interface SessionState {
	user: SessionUser | null;
	initializing: boolean;
	sessionExpired: boolean;
}
