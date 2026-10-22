import type { ImportsRepository } from '../repository';
import {
	mockCommitImport,
	mockCreateImport,
	mockGetImport,
	mockListImportAudit,
	mockListImportRows,
	mockListImports
} from '../mock';

/** Thin, boring adapter: one line per repository method (architecture §4.7). */
export const mockImportsRepository: ImportsRepository = {
	list: async (params) => mockListImports(params),
	get: async (id) => mockGetImport(id),
	rows: async (id, params) => mockListImportRows(id, params),
	create: async (input) => mockCreateImport(input),
	commit: async (id) => mockCommitImport(id),
	audit: async (id) => mockListImportAudit(id)
};
