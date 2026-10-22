import type { CustomersRepository } from '../repository';
import {
	mockArchiveCustomer,
	mockCreateCustomer,
	mockGetCustomer,
	mockListCustomerAudit,
	mockListCustomers,
	mockReviewCustomerDedup,
	mockUnarchiveCustomer,
	mockUpdateCustomer
} from '../mock';

/** Thin, boring adapter: one line per repository method (architecture §4.7). */
export const mockCustomersRepository: CustomersRepository = {
	list: async (params) => mockListCustomers(params),
	get: async (id) => mockGetCustomer(id),
	create: async (input) => mockCreateCustomer(input),
	update: async (id, input) => mockUpdateCustomer(id, input),
	archive: async (id) => mockArchiveCustomer(id),
	unarchive: async (id) => mockUnarchiveCustomer(id),
	reviewDedup: async (id, input) => mockReviewCustomerDedup(id, input),
	audit: async (id) => mockListCustomerAudit(id)
};
