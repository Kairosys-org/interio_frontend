import type { Page } from '$shared/domain/pagination';
import type {
	ImportKind,
	ImportOutcome,
	ImportStatus,
	ImportValidation
} from '$shared/domain/record-states';
import type { Uuid } from '$shared/domain/uuid';

export type { ImportKind, ImportOutcome, ImportStatus, ImportValidation };

export interface ImportBatch {
	id: Uuid;
	tenantId: Uuid;
	kind: ImportKind;
	status: ImportStatus;
	fileName: string;
	columnMap: Record<string, string>;
	totalRows: number;
	importedRows: number;
	readyRows: number;
	reviewRows: number;
	rejectedRows: number;
	createdAt: string;
	updatedAt: string;
	createdBy: Uuid | null;
	committedAt: string | null;
}

export interface ImportBatchListParams {
	kind?: ImportKind | 'all';
	status?: ImportStatus | 'all';
	page?: number;
	pageSize?: number;
}

export interface ImportRow {
	id: Uuid;
	batchId: Uuid;
	rowNo: number;
	payload: Record<string, string>;
	validation: ImportValidation;
	outcome: ImportOutcome | null;
	error: string | null;
	entityType: string | null;
	entityId: Uuid | null;
	createdAt: string;
}

export interface ImportRowListParams {
	/** `all` means every staged validation state and committed outcome. */
	result?: ImportValidation | ImportOutcome | 'all';
	page?: number;
	pageSize?: number;
}

export interface CreateImportInput {
	kind: ImportKind;
	fileName: string;
	/** UTF-8 CSV source, parsed and validated in `domain/csv.ts`. */
	csvText: string;
	/** File header → canonical field name. */
	columnMap: Record<string, string>;
}

export interface ImportCommitResult {
	batch: ImportBatch;
	created: number;
	held: number;
	rejected: number;
}

export type ImportBatchPage = Page<ImportBatch>;
export type ImportRowPage = Page<ImportRow>;
