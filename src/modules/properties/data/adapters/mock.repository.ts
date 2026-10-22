import type { PropertiesRepository } from '../repository';
import {
	mockArchiveProperty,
	mockAuditProperty,
	mockCreateProperty,
	mockGetProperty,
	mockListProperties,
	mockReviewPropertyDedup,
	mockUnarchiveProperty,
	mockUpdateProperty
} from '../mock';

/** Thin, boring adapter: one line per repository method (architecture §4.7). */
export const mockPropertiesRepository: PropertiesRepository = {
	list: async (params) => mockListProperties(params),
	get: async (id) => mockGetProperty(id),
	create: async (input) => mockCreateProperty(input),
	update: async (id, input) => mockUpdateProperty(id, input),
	archive: async (id) => mockArchiveProperty(id),
	unarchive: async (id) => mockUnarchiveProperty(id),
	reviewDedup: async (id, input) => mockReviewPropertyDedup(id, input),
	audit: async (id) => mockAuditProperty(id)
};
