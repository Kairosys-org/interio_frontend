import type { TenantRole } from '$shared/domain/roles';
import type { SessionUser, TenantBrandingEnvelope } from '$shared/domain/user';
import type { Uuid } from '$shared/domain/uuid';

export interface TenantChoice {
	id: Uuid;
	slug: string;
	legalName: string;
	displayName: string;
}

export interface LoginInput {
	email: string;
	password: string;
	/** Present only after the workspace chooser step (/t/<slug>). */
	tenantSlug?: string | null;
}

export type LoginResult =
	| { status: 'authenticated'; token: string; user: SessionUser }
	| { status: 'mfa_required'; challengeId: string }
	| { status: 'workspace_required'; tenants: TenantChoice[] };

export interface MfaVerifyInput {
	challengeId: string;
	code: string;
}

export interface AuthSession {
	token: string;
	user: SessionUser;
}

export interface InvitationPreview {
	token: string;
	email: string;
	tenantName: string;
	role: TenantRole;
	expiresAt: string;
}

export interface AcceptInvitationInput {
	token: string;
	displayName: string;
	password: string;
}

export interface DemoAccount {
	email: string;
	password: string;
	roleLabel: string;
	/** True when the account needs the MFA step or the workspace chooser. */
	note: string;
}

export interface TenantBrandingSummary {
	displayName: string;
	branding: TenantBrandingEnvelope | null;
}
