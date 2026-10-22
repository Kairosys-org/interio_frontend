import type { AuditTrailRow } from '$shared/domain/audit';
import type { Uuid } from '$shared/domain/uuid';
import type {
	CreateImportInput,
	ImportBatch,
	ImportBatchListParams,
	ImportBatchPage,
	ImportCommitResult,
	ImportRowListParams,
	ImportRowPage
} from '../domain/types';

export interface ImportsRepository {
	list(params: ImportBatchListParams): Promise<ImportBatchPage>;
	get(id: Uuid): Promise<ImportBatch>;
	rows(id: Uuid, params?: ImportRowListParams): Promise<ImportRowPage>;
	/** Stage a new batch from parsed CSV; rows are validated, nothing is created yet. */
	create(input: CreateImportInput): Promise<ImportBatch>;
	commit(id: Uuid): Promise<ImportCommitResult>;
	audit(id: Uuid): Promise<AuditTrailRow[]>;
}
