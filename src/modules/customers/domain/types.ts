import type { Page } from '$shared/domain/pagination';
import type { CustomerSource, CustomerState, PreferredChannel } from '$shared/domain/record-states';
import type { DedupCandidateRef, DedupReviewInput } from '$shared/domain/dedup';
import type { Uuid } from '$shared/domain/uuid';

export type { CustomerSource, CustomerState, PreferredChannel };

/** A customer as returned by the records spine (spec Part 5 §4.1). */
export interface Customer {
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
	leadUuid: Uuid | null;
	state: CustomerState;
	dedupOfId: Uuid | null;
	reviewNote: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: Uuid | null;
	archivedAt: string | null;
}

export type CustomerSort = 'caption' | 'createdAt' | 'updatedAt' | 'postcode' | 'state';

export interface CustomerListParams {
	search?: string;
	state?: CustomerState | 'all';
	sort?: CustomerSort;
	sortDir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

export interface CustomerListRow {
	id: Uuid;
	caption: string;
	contactName: string | null;
	email: string | null;
	phone: string | null;
	postcode: string | null;
	state: CustomerState;
	preferredChannel: PreferredChannel;
	createdAt: string;
}

export interface CustomerPropertySummary {
	id: Uuid;
	addressLine1: string;
	addressLine2: string | null;
	town: string | null;
	postcode: string | null;
	state: CustomerState;
}

export interface CustomerProjectSummary {
	id: Uuid;
	caption: string;
	reference: string;
	projectType: string;
	status: string;
}

export interface CustomerDetail {
	customer: Customer;
	properties: CustomerPropertySummary[];
	projects: CustomerProjectSummary[];
}

export interface CreateCustomerInput {
	caption: string;
	contactName: string | null;
	email: string | null;
	phone: string | null;
	addressLine1: string | null;
	addressLine2: string | null;
	town: string | null;
	postcode: string | null;
	preferredChannel: PreferredChannel;
	source?: CustomerSource;
}

export interface UpdateCustomerInput {
	caption?: string;
	contactName?: string | null;
	email?: string | null;
	phone?: string | null;
	addressLine1?: string | null;
	addressLine2?: string | null;
	town?: string | null;
	postcode?: string | null;
	preferredChannel?: PreferredChannel;
}

export type CustomerPage = Page<CustomerListRow>;

/** Details carried by the `409 conflict` response on a duplicate create. */
export interface CustomerDedupConflict {
	entityType: 'customer';
	heldId: Uuid;
	candidates: DedupCandidateRef[];
}

export type { DedupCandidateRef, DedupReviewInput };
