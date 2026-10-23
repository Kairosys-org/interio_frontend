import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockSyncRepository } from './adapters/mock.repository';
import type { SyncRepository } from './repository';

export function getSyncRepository(): SyncRepository {
	return getConfiguredRepository('sync', mockSyncRepository);
}
