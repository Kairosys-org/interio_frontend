import { COLLECTIONS } from '$shared/data/collections';
import type { AuditEventRecord } from '$shared/data/records';
import type { AuditTrailRow } from '$shared/domain/audit';
import type { Uuid } from '$shared/domain/uuid';
import { newUuid } from '$shared/lib/uuid';
import { getCollection, updateCollection } from '$network/mock-backend';
import { currentSessionUser } from './mock-session';

export interface TenantAuditInput {
	tenantId: Uuid;
	action: string;
	subjectType: string;
	subjectId: Uuid;
	payload?: Record<string, unknown> | null;
}

/** Append-only tenant audit write shared by every records-spine mock. */
export function recordTenantAudit(input: TenantAuditInput): void {
	const user = currentSessionUser();
	const event: AuditEventRecord = {
		id: newUuid(),
		scope: 'tenant',
		tenantId: input.tenantId,
		actorUserId: user?.id ?? null,
		actorEmail: user?.email ?? 'system@interio.app',
		action: input.action,
		subjectType: input.subjectType,
		subjectId: input.subjectId,
		occurredAt: new Date().toISOString(),
		payload: input.payload ?? null
	};
	updateCollection<AuditEventRecord>(COLLECTIONS.auditEvents, (rows) => [...rows, event]);
}

/** Newest-first history for one object, already scoped to its tenant. */
export function listTenantAudit(
	tenantId: Uuid,
	subjectType: string,
	subjectId: Uuid
): AuditTrailRow[] {
	return getCollection<AuditEventRecord>(COLLECTIONS.auditEvents)
		.filter(
			(event) =>
				event.scope === 'tenant' &&
				event.tenantId === tenantId &&
				event.subjectType === subjectType &&
				event.subjectId === subjectId
		)
		.sort((first, second) => second.occurredAt.localeCompare(first.occurredAt))
		.map((event) => ({
			id: event.id,
			action: event.action,
			actorEmail: event.actorEmail,
			actorUserId: event.actorUserId,
			occurredAt: event.occurredAt,
			subjectType: event.subjectType,
			subjectId: event.subjectId,
			payload: event.payload ? { ...event.payload } : null
		}));
}
