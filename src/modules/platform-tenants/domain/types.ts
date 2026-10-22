import type { TenantBrandingEnvelope, TenantStatus } from '$shared/domain/user';
import type { Uuid } from '$shared/domain/uuid';

export interface PlatformAuditRow {
	id: Uuid;
	action: string;
	actorEmail: string;
	subjectTenantId: Uuid | null;
	subjectTenantName: string | null;
	occurredAt: string;
	payload: Record<string, unknown> | null;
}

export interface TenantListRow {
	id: Uuid;
	slug: string;
	legalName: string;
	displayName: string;
	status: TenantStatus;
	userCount: number;
	createdAt: string;
}

export interface TenantDetail extends TenantListRow {
	branding: TenantBrandingEnvelope | null;
	defaultCurrency: string;
	vatNumber: string | null;
	referencePattern: string | null;
	emailDomain: string | null;
	recentAudit: PlatformAuditRow[];
}

export interface TenantListParams {
	search?: string;
	status?: TenantStatus | 'all';
	page?: number;
	pageSize?: number;
}

export interface CreateTenantInput {
	legalName: string;
	slug: string;
	displayName?: string;
	accent?: string;
	defaultCurrency?: string;
	vatNumber?: string | null;
	referencePattern?: string | null;
	emailDomain?: string | null;
	adminEmail: string;
}

export type TenantTransitionTarget = 'active' | 'suspended' | 'offboarded';

export interface TenantTransitionInput {
	to: TenantTransitionTarget;
	reason: string;
}

export interface PlatformAuditListParams {
	search?: string;
	tenantId?: Uuid | null;
	page?: number;
	pageSize?: number;
}
