import type {
	DedupCandidateRef,
	DedupDecision,
	DedupEntityType,
	DedupReviewInput
} from '$shared/domain/dedup';
import type { Uuid } from '$shared/domain/uuid';

export type { DedupCandidateRef, DedupDecision, DedupEntityType, DedupReviewInput };

export interface DedupField {
	label: string;
	value: string;
}

export interface DedupRecordView {
	id: Uuid;
	entityType: DedupEntityType;
	caption: string;
	state: string;
	createdAt: string;
	fields: DedupField[];
}

export interface DedupCandidateView extends DedupRecordView {
	matchReasons: string[];
}

/** One held `pending_review` row plus every normalised match found for it. */
export interface DedupQueueItem {
	held: DedupRecordView;
	candidates: DedupCandidateView[];
}

export interface DedupReviewRequest extends DedupReviewInput {
	entityType: DedupEntityType;
	id: Uuid;
}

export interface DedupReviewResult {
	entityType: DedupEntityType;
	heldId: Uuid;
	targetId: Uuid | null;
	decision: DedupDecision;
}
