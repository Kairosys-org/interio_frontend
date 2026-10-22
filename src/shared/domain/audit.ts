import type { Uuid } from './uuid';

/** Read model for every audit tab and activity timeline (DESIGN §9.2). */
export interface AuditTrailRow {
	id: Uuid;
	action: string;
	actorEmail: string;
	actorUserId: Uuid | null;
	occurredAt: string;
	subjectType: string;
	subjectId: Uuid | null;
	payload: Record<string, unknown> | null;
}
