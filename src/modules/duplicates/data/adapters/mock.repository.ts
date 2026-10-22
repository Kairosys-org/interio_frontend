import type { DuplicatesRepository } from '../repository';
import { mockListDedupAudit, mockListDedupQueue, mockReviewDedup } from '../mock';

/** Thin and boring (architecture §4.7): one delegation per method. */
export const mockDuplicatesRepository: DuplicatesRepository = {
	list: async () => mockListDedupQueue(),
	review: async (input) => mockReviewDedup(input),
	audit: async (entityType, id) => mockListDedupAudit(entityType, id)
};
