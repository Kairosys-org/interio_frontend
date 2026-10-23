import { getConfiguredRepository } from '$shared/data/repository-mode';
import { mockSurveysRepository } from './adapters/mock.repository';
import { withOfflineOutbox } from './offline';
import type { SurveysRepository } from './repository';

export function getSurveysRepository(): SurveysRepository {
	return withOfflineOutbox(getConfiguredRepository('surveys', mockSurveysRepository));
}
