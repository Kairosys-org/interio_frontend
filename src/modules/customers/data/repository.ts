import type { AuditTrailRow } from '$shared/domain/audit';
import type { DedupReviewInput } from '$shared/domain/dedup';
import type { Uuid } from '$shared/domain/uuid';
import type {
	CreateCustomerInput,
	Customer,
	CustomerDetail,
	CustomerListParams,
	CustomerPage,
	UpdateCustomerInput
} from '../domain/types';

export interface CustomersRepository {
	list(params: CustomerListParams): Promise<CustomerPage>;
	get(id: Uuid): Promise<CustomerDetail>;
	create(input: CreateCustomerInput): Promise<Customer>;
	update(id: Uuid, input: UpdateCustomerInput): Promise<Customer>;
	archive(id: Uuid): Promise<Customer>;
	unarchive(id: Uuid): Promise<Customer>;
	reviewDedup(id: Uuid, input: DedupReviewInput): Promise<Customer>;
	audit(id: Uuid): Promise<AuditTrailRow[]>;
}
