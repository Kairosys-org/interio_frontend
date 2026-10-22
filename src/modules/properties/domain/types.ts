import type { DedupCandidateRef, DedupReviewInput } from '$shared/domain/dedup';
import type { Page } from '$shared/domain/pagination';
import type { CustomerState, PropertyState } from '$shared/domain/record-states';
import type { Uuid } from '$shared/domain/uuid';

export type { PropertyState, DedupCandidateRef, DedupReviewInput };

export interface Property {
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

export type PropertySort = 'addressLine1' | 'createdAt' | 'updatedAt' | 'postcode' | 'state';

export interface PropertyListParams {
	search?: string;
	customerId?: Uuid | null;
	state?: PropertyState | 'all';
	sort?: PropertySort;
	sortDir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

export interface PropertyListRow {
	id: Uuid;
	addressLine1: string;
	addressLine2: string | null;
	town: string | null;
	postcode: string | null;
	customerId: Uuid;
	customerCaption: string;
	state: PropertyState;
	createdAt: string;
}

export interface PropertyCustomerSummary {
	id: Uuid;
	caption: string;
	email: string | null;
	phone: string | null;
	state: CustomerState;
}

export interface PropertyProjectSummary {
	id: Uuid;
	caption: string;
	reference: string;
	projectType: string;
	status: string;
}

export interface PropertyDetail {
	property: Property;
	customer: PropertyCustomerSummary | null;
	projects: PropertyProjectSummary[];
}

export interface CreatePropertyInput {
	customerId: Uuid;
	addressLine1: string;
	addressLine2: string | null;
	town: string | null;
	postcode: string | null;
	accessNotes: string | null;
}

export interface UpdatePropertyInput {
	customerId?: Uuid;
	addressLine1?: string;
	addressLine2?: string | null;
	town?: string | null;
	postcode?: string | null;
	accessNotes?: string | null;
}

export type PropertyPage = Page<PropertyListRow>;

export interface PropertyDedupConflict {
	entityType: 'property';
	heldId: Uuid;
	candidates: DedupCandidateRef[];
}
