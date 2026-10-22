import { listTenantAudit, recordTenantAudit } from '$shared/data/audit';
import { COLLECTIONS } from '$shared/data/collections';
import { demoNow } from '$shared/data/demo-clock';
import { requireTenantSession } from '$shared/data/mock-session';
import type { CustomerRecord, ProjectRecord, PropertyRecord } from '$shared/data/records';
import type { AuditTrailRow } from '$shared/domain/audit';
import {
	customerMatchReasons,
	DEDUP_ALREADY_REVIEWED,
	DEDUP_TARGET_INVALID,
	DEDUP_TARGET_NOT_FOUND,
	projectMatchReasons,
	propertyMatchReasons,
	type DedupDecision,
	type DedupEntityType
} from '$shared/domain/dedup';
import { PERMISSIONS } from '$shared/domain/permissions';
import type { Uuid } from '$shared/domain/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, updateCollection } from '$network/mock-backend';
import type {
	DedupCandidateView,
	DedupField,
	DedupQueueItem,
	DedupRecordView,
	DedupReviewRequest,
	DedupReviewResult
} from '../domain/types';
import { dedupReviewSchema, fieldErrorsFrom } from '../domain/validations';

/**
 * Duplicate-review mock server (architecture §4.6, spec Part 5 §5).
 *
 * The queue reads the three records-spine collections directly — never another
 * module's mock — and resolves a held row in place. Every call is tenant-scoped
 * from the session, and `review` re-checks the entity's update permission, so
 * calling the repository without the facade cannot bypass RBAC.
 *
 * Nothing is merged: `link_to_existing` closes the held row as `cancelled` and
 * keeps `dedupOfId`; `confirm_distinct` activates it with the mandatory note.
 * Both write one `dedup_review` event on the held object.
 */

/** One placeholder for every empty compared value (ui-ux §13). */
const EMPTY_VALUE = '—';

const UPDATE_PERMISSION: Readonly<Record<DedupEntityType, string>> = Object.freeze({
	customer: PERMISSIONS.CUSTOMER_UPDATE,
	property: PERMISSIONS.PROPERTY_UPDATE,
	project: PERMISSIONS.PROJECT_UPDATE
});

const NOT_FOUND_MESSAGE: Readonly<Record<DedupEntityType, string>> = Object.freeze({
	customer: 'Customer not found.',
	property: 'Property not found.',
	project: 'Project not found.'
});

type ReviewableRecord = CustomerRecord | PropertyRecord | ProjectRecord;

interface ReviewPatch {
	state: string;
	dedupOfId: Uuid | null;
	reviewNote: string | null;
	updatedAt: string;
}

function notFound(message: string): ApiError {
	return new ApiError({ code: ApiErrorCode.NOT_FOUND, status: 404, message });
}

function conflict(message: string): ApiError {
	return new ApiError({ code: ApiErrorCode.CONFLICT, status: 409, message });
}

function validation(message: string, fieldErrors?: Record<string, string>): ApiError {
	return new ApiError({
		code: ApiErrorCode.VALIDATION,
		status: 400,
		message,
		fieldErrors
	});
}

function isDedupEntityType(value: string): value is DedupEntityType {
	return value === 'customer' || value === 'property' || value === 'project';
}

/** Archived and cancelled rows are history, not duplicate candidates. */
function isLiveState(state: string): boolean {
	return state !== 'archived' && state !== 'cancelled';
}

function display(value: string | null | undefined): string {
	if (typeof value !== 'string') return EMPTY_VALUE;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : EMPTY_VALUE;
}

function joinParts(parts: ReadonlyArray<string | null | undefined>): string {
	const values = parts
		.filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
		.map((part) => part.trim());
	return values.length > 0 ? values.join(', ') : EMPTY_VALUE;
}

function propertyAddress(property: PropertyRecord | undefined): string {
	if (!property) return EMPTY_VALUE;
	return joinParts([
		property.addressLine1,
		property.addressLine2,
		property.town,
		property.postcode
	]);
}

function byCandidateCreatedAtThenId(
	first: { record: { createdAt: string; id: Uuid } },
	second: { record: { createdAt: string; id: Uuid } }
): number {
	return (
		first.record.createdAt.localeCompare(second.record.createdAt) ||
		first.record.id.localeCompare(second.record.id)
	);
}

/* ------------------------------------------------------------------ */
/* Compare views.                                                      */
/* ------------------------------------------------------------------ */

function customerView(record: CustomerRecord): DedupRecordView {
	return {
		id: record.id,
		entityType: 'customer',
		caption: record.caption,
		state: record.state,
		createdAt: record.createdAt,
		fields: [
			{ label: 'Caption', value: display(record.caption) },
			{ label: 'Contact', value: display(record.contactName) },
			{ label: 'Email', value: display(record.email) },
			{ label: 'Phone', value: display(record.phone) },
			{ label: 'Address', value: joinParts([record.addressLine1, record.addressLine2]) },
			{ label: 'Town', value: display(record.town) },
			{ label: 'Postcode', value: display(record.postcode) },
			{ label: 'Preferred channel', value: display(record.preferredChannel) },
			{ label: 'State', value: display(record.state) }
		] satisfies DedupField[]
	};
}

function propertyView(record: PropertyRecord): DedupRecordView {
	return {
		id: record.id,
		entityType: 'property',
		caption: record.addressLine1,
		state: record.state,
		createdAt: record.createdAt,
		fields: [
			{ label: 'Address line 1', value: display(record.addressLine1) },
			{ label: 'Address line 2', value: display(record.addressLine2) },
			{ label: 'Town', value: display(record.town) },
			{ label: 'Postcode', value: display(record.postcode) },
			{ label: 'Access notes', value: display(record.accessNotes) },
			{ label: 'State', value: display(record.state) }
		] satisfies DedupField[]
	};
}

function projectView(record: ProjectRecord, property: PropertyRecord | undefined): DedupRecordView {
	return {
		id: record.id,
		entityType: 'project',
		caption: record.caption,
		state: record.state,
		createdAt: record.createdAt,
		fields: [
			{ label: 'Caption', value: display(record.caption) },
			{ label: 'Reference', value: display(record.reference) },
			{ label: 'Type', value: display(record.projectType) },
			{ label: 'Status', value: display(record.status) },
			{ label: 'Property', value: propertyAddress(property) },
			{ label: 'State', value: display(record.state) }
		] satisfies DedupField[]
	};
}

/* ------------------------------------------------------------------ */
/* Candidate matching (shared rules, same tenant, live rows only).     */
/* ------------------------------------------------------------------ */

function customerCandidates(tenantId: Uuid, held: CustomerRecord): DedupCandidateView[] {
	return getCollection<CustomerRecord>(COLLECTIONS.customers)
		.filter((row) => row.tenantId === tenantId && row.id !== held.id && isLiveState(row.state))
		.map((row) => ({
			record: row,
			matchReasons: customerMatchReasons(
				{
					caption: held.caption,
					email: held.email,
					phone: held.phone,
					postcode: held.postcode
				},
				{ caption: row.caption, email: row.email, phone: row.phone, postcode: row.postcode }
			)
		}))
		.filter((candidate) => candidate.matchReasons.length > 0)
		.sort(byCandidateCreatedAtThenId)
		.map((candidate) => ({
			...customerView(candidate.record),
			matchReasons: candidate.matchReasons
		}));
}

function propertyCandidates(tenantId: Uuid, held: PropertyRecord): DedupCandidateView[] {
	return getCollection<PropertyRecord>(COLLECTIONS.properties)
		.filter((row) => row.tenantId === tenantId && row.id !== held.id && isLiveState(row.state))
		.map((row) => ({
			record: row,
			matchReasons: propertyMatchReasons(
				{ addressLine1: held.addressLine1, postcode: held.postcode },
				{ addressLine1: row.addressLine1, postcode: row.postcode }
			)
		}))
		.filter((candidate) => candidate.matchReasons.length > 0)
		.sort(byCandidateCreatedAtThenId)
		.map((candidate) => ({
			...propertyView(candidate.record),
			matchReasons: candidate.matchReasons
		}));
}

function projectCandidates(tenantId: Uuid, held: ProjectRecord): DedupCandidateView[] {
	return getCollection<ProjectRecord>(COLLECTIONS.projects)
		.filter((row) => row.tenantId === tenantId && row.id !== held.id && isLiveState(row.state))
		.map((row) => ({
			record: row,
			matchReasons: projectMatchReasons(
				{
					propertyId: held.propertyId,
					projectType: held.projectType,
					caption: held.caption
				},
				{ propertyId: row.propertyId, projectType: row.projectType, caption: row.caption }
			)
		}))
		.filter((candidate) => candidate.matchReasons.length > 0)
		.sort(byCandidateCreatedAtThenId)
		.map((candidate) => ({
			...projectView(
				candidate.record,
				getCollection<PropertyRecord>(COLLECTIONS.properties).find(
					(property) =>
						property.tenantId === tenantId && property.id === candidate.record.propertyId
				)
			),
			matchReasons: candidate.matchReasons
		}));
}

/* ------------------------------------------------------------------ */
/* Reads.                                                             */
/* ------------------------------------------------------------------ */

export async function mockListDedupQueue(): Promise<DedupQueueItem[]> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CUSTOMER_VIEW);

	const properties = getCollection<PropertyRecord>(COLLECTIONS.properties).filter(
		(row) => row.tenantId === tenantId
	);

	const customerItems: DedupQueueItem[] = getCollection<CustomerRecord>(COLLECTIONS.customers)
		.filter((row) => row.tenantId === tenantId && row.state === 'pending_review')
		.map((held) => ({ held: customerView(held), candidates: customerCandidates(tenantId, held) }));

	const propertyItems: DedupQueueItem[] = getCollection<PropertyRecord>(COLLECTIONS.properties)
		.filter((row) => row.tenantId === tenantId && row.state === 'pending_review')
		.map((held) => ({ held: propertyView(held), candidates: propertyCandidates(tenantId, held) }));

	const projectItems: DedupQueueItem[] = getCollection<ProjectRecord>(COLLECTIONS.projects)
		.filter((row) => row.tenantId === tenantId && row.state === 'pending_review')
		.map((held) => ({
			held: projectView(
				held,
				properties.find((property) => property.id === held.propertyId)
			),
			candidates: projectCandidates(tenantId, held)
		}));

	return [...customerItems, ...propertyItems, ...projectItems].sort(
		(first, second) =>
			second.held.createdAt.localeCompare(first.held.createdAt) ||
			first.held.id.localeCompare(second.held.id)
	);
}

export async function mockListDedupAudit(
	entityType: DedupEntityType,
	id: Uuid
): Promise<AuditTrailRow[]> {
	if (!isDedupEntityType(entityType)) {
		throw validation('Unknown record type.', { entityType: 'Unknown record type.' });
	}
	const { tenantId } = requireTenantSession(PERMISSIONS.CUSTOMER_VIEW);
	return listTenantAudit(tenantId, entityType, id);
}

/* ------------------------------------------------------------------ */
/* Review write.                                                      */
/* ------------------------------------------------------------------ */

function findHeld(entityType: DedupEntityType, tenantId: Uuid, id: Uuid): ReviewableRecord {
	switch (entityType) {
		case 'customer': {
			const row = getCollection<CustomerRecord>(COLLECTIONS.customers).find(
				(customer) => customer.tenantId === tenantId && customer.id === id
			);
			if (!row) throw notFound(NOT_FOUND_MESSAGE.customer);
			return row;
		}
		case 'property': {
			const row = getCollection<PropertyRecord>(COLLECTIONS.properties).find(
				(property) => property.tenantId === tenantId && property.id === id
			);
			if (!row) throw notFound(NOT_FOUND_MESSAGE.property);
			return row;
		}
		case 'project': {
			const row = getCollection<ProjectRecord>(COLLECTIONS.projects).find(
				(project) => project.tenantId === tenantId && project.id === id
			);
			if (!row) throw notFound(NOT_FOUND_MESSAGE.project);
			return row;
		}
	}
}

function targetExists(entityType: DedupEntityType, tenantId: Uuid, id: Uuid): boolean {
	switch (entityType) {
		case 'customer':
			return getCollection<CustomerRecord>(COLLECTIONS.customers).some(
				(row) => row.tenantId === tenantId && row.id === id
			);
		case 'property':
			return getCollection<PropertyRecord>(COLLECTIONS.properties).some(
				(row) => row.tenantId === tenantId && row.id === id
			);
		case 'project':
			return getCollection<ProjectRecord>(COLLECTIONS.projects).some(
				(row) => row.tenantId === tenantId && row.id === id
			);
	}
}

function applyReview(
	entityType: DedupEntityType,
	tenantId: Uuid,
	id: Uuid,
	patch: ReviewPatch
): void {
	switch (entityType) {
		case 'customer':
			updateCollection<CustomerRecord>(COLLECTIONS.customers, (rows) =>
				rows.map((row) =>
					row.tenantId === tenantId && row.id === id
						? { ...row, ...patch, state: patch.state as CustomerRecord['state'] }
						: row
				)
			);
			return;
		case 'property':
			updateCollection<PropertyRecord>(COLLECTIONS.properties, (rows) =>
				rows.map((row) =>
					row.tenantId === tenantId && row.id === id
						? { ...row, ...patch, state: patch.state as PropertyRecord['state'] }
						: row
				)
			);
			return;
		case 'project':
			updateCollection<ProjectRecord>(COLLECTIONS.projects, (rows) =>
				rows.map((row) =>
					row.tenantId === tenantId && row.id === id
						? { ...row, ...patch, state: patch.state as ProjectRecord['state'] }
						: row
				)
			);
			return;
	}
}

export async function mockReviewDedup(input: DedupReviewRequest): Promise<DedupReviewResult> {
	if (!isDedupEntityType(input.entityType)) {
		throw validation('Unknown record type.', { entityType: 'Unknown record type.' });
	}
	const { tenantId } = requireTenantSession(UPDATE_PERMISSION[input.entityType]);

	const parsed = dedupReviewSchema.safeParse({
		decision: input.decision,
		targetId: input.targetId,
		reviewNote: input.reviewNote
	});
	if (!parsed.success) {
		throw validation('Check the highlighted fields and try again.', fieldErrorsFrom(parsed.error));
	}

	const decision: DedupDecision = parsed.data.decision;
	const reviewNote = parsed.data.reviewNote;

	const held = findHeld(input.entityType, tenantId, input.id);
	if (held.state !== 'pending_review') throw conflict(DEDUP_ALREADY_REVIEWED);

	let targetId: Uuid | null = null;
	let nextState = 'active';

	if (decision === 'link_to_existing') {
		const requested = parsed.data.targetId;
		if (requested === null || requested === held.id) {
			throw validation(DEDUP_TARGET_INVALID, { targetId: DEDUP_TARGET_INVALID });
		}
		if (!targetExists(input.entityType, tenantId, requested)) {
			throw notFound(DEDUP_TARGET_NOT_FOUND);
		}
		targetId = requested;
		nextState = 'cancelled';
	}

	const note = reviewNote.length > 0 ? reviewNote : null;

	applyReview(input.entityType, tenantId, input.id, {
		state: nextState,
		dedupOfId: targetId,
		reviewNote: note,
		updatedAt: demoNow().toISOString()
	});

	recordTenantAudit({
		tenantId,
		action: 'dedup_review',
		subjectType: input.entityType,
		subjectId: input.id,
		payload: { decision, targetId, reviewNote: note }
	});

	return { entityType: input.entityType, heldId: input.id, targetId, decision };
}
