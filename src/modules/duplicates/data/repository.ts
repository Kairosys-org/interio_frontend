import type { AuditTrailRow } from '$shared/domain/audit';
import type { DedupEntityType } from '$shared/domain/dedup';
import type { Uuid } from '$shared/domain/uuid';
import type { DedupQueueItem, DedupReviewRequest, DedupReviewResult } from '../domain/types';

export interface DuplicatesRepository {
	list(): Promise<DedupQueueItem[]>;
	review(input: DedupReviewRequest): Promise<DedupReviewResult>;
	audit(entityType: DedupEntityType, id: Uuid): Promise<AuditTrailRow[]>;
}
