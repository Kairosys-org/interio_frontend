import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockCustomersRepository } from './adapters/mock.repository';
import type { CustomersRepository } from './repository';

/** The only place that picks mock vs API (architecture §4.4). */
export function getCustomersRepository(): CustomersRepository {
	return getConfiguredRepository('customers', mockCustomersRepository);
}
