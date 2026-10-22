import type { ZodError } from 'zod';
import { listTenantAudit, recordTenantAudit } from '$shared/data/audit';
import { COLLECTIONS } from '$shared/data/collections';
import { requireTenantSession } from '$shared/data/mock-session';
import type { CustomerRecord, ProjectRecord, PropertyRecord } from '$shared/data/records';
import type { AuditTrailRow } from '$shared/domain/audit';
import {
	DEDUP_ALREADY_REVIEWED,
	DEDUP_NOTE_REQUIRED,
	DEDUP_TARGET_INVALID,
	DEDUP_TARGET_NOT_FOUND,
	propertyMatchReasons
} from '$shared/domain/dedup';
import type { DedupCandidateRef, DedupReviewInput } from '$shared/domain/dedup';
import { toPage } from '$shared/domain/pagination';
import { PERMISSIONS } from '$shared/domain/permissions';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, registerSeeder, updateCollection } from '$network/mock-backend';
import type {
	CreatePropertyInput,
	Property,
	PropertyDetail,
	PropertyListParams,
	PropertyListRow,
	PropertyPage,
	PropertySort,
	UpdatePropertyInput
} from '../domain/types';
import { normalisePropertyInput, propertyFormSchema } from '../domain/validations';
import { seedProperties } from './seed';

/**
 * Property mock server (architecture §4.6).
 *
 * Behaves like the backend: tenant scoping comes from the session, permissions
 * are re-checked here, every list joins the customer caption and every create
 * runs the R5 dedup check before a row is written. Never imported by routes or
 * presentation.
 */

registerSeeder(seedProperties);

const UNKNOWN_CUSTOMER = 'Unknown customer';
const NOTE_MAX = 2000;

function notFound(): ApiError {
	return new ApiError({
		code: ApiErrorCode.NOT_FOUND,
		status: 404,
		message: 'Property not found.'
	});
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

function fieldErrorsFrom(error: ZodError): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.') || 'form';
		if (!(key in errors)) errors[key] = issue.message;
	}
	return errors;
}

function mapZodError(error: ZodError): ApiError {
	return validation('Check the highlighted fields and try again.', fieldErrorsFrom(error));
}

function matches(value: string | null | undefined, needle: string): boolean {
	return typeof value === 'string' && value.toLowerCase().includes(needle);
}

function tenantProperties(tenantId: string): PropertyRecord[] {
	return getCollection<PropertyRecord>(COLLECTIONS.properties).filter(
		(row) => row.tenantId === tenantId
	);
}

function tenantCustomers(tenantId: string): CustomerRecord[] {
	return getCollection<CustomerRecord>(COLLECTIONS.customers).filter(
		(row) => row.tenantId === tenantId
	);
}

function findProperty(id: string, tenantId: string): PropertyRecord {
	const property = tenantProperties(tenantId).find((row) => row.id === id);
	if (!property) throw notFound();
	return property;
}

function customerCaption(customers: readonly CustomerRecord[], customerId: string): string {
	return customers.find((customer) => customer.id === customerId)?.caption ?? UNKNOWN_CUSTOMER;
}

function saveProperty(updated: PropertyRecord): void {
	updateCollection<PropertyRecord>(COLLECTIONS.properties, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
}

interface PropertyListEntry {
	property: PropertyRecord;
	customerCaption: string;
}

function compareEntries(
	first: PropertyListEntry,
	second: PropertyListEntry,
	sort: PropertySort
): number {
	switch (sort) {
		case 'createdAt':
			return first.property.createdAt.localeCompare(second.property.createdAt);
		case 'updatedAt':
			return first.property.updatedAt.localeCompare(second.property.updatedAt);
		case 'postcode':
			return (first.property.postcode ?? '').localeCompare(
				second.property.postcode ?? '',
				'en-GB',
				{
					numeric: true,
					sensitivity: 'base'
				}
			);
		case 'state':
			return first.property.state.localeCompare(second.property.state);
		case 'addressLine1':
		default:
			return first.property.addressLine1.localeCompare(second.property.addressLine1, 'en-GB', {
				numeric: true,
				sensitivity: 'base'
			});
	}
}

function toListRow(entry: PropertyListEntry): PropertyListRow {
	const { property, customerCaption: caption } = entry;
	return {
		id: property.id,
		addressLine1: property.addressLine1,
		addressLine2: property.addressLine2,
		town: property.town,
		postcode: property.postcode,
		customerId: property.customerId,
		customerCaption: caption,
		state: property.state,
		createdAt: property.createdAt
	};
}

export async function mockListProperties(params: PropertyListParams = {}): Promise<PropertyPage> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROPERTY_VIEW);

	const customers = tenantCustomers(tenantId);
	const search = params.search?.trim().toLowerCase() ?? '';
	const state = params.state ?? 'all';
	const sort: PropertySort = params.sort ?? 'createdAt';
	const direction =
		params.sortDir ?? (sort === 'createdAt' || sort === 'updatedAt' ? 'desc' : 'asc');

	const entries = tenantProperties(tenantId)
		.map((property) => ({
			property,
			customerCaption: customerCaption(customers, property.customerId)
		}))
		.filter((entry) => (params.customerId ? entry.property.customerId === params.customerId : true))
		.filter((entry) => (state === 'all' ? true : entry.property.state === state))
		.filter(
			(entry) =>
				search.length === 0 ||
				matches(entry.property.addressLine1, search) ||
				matches(entry.property.addressLine2, search) ||
				matches(entry.property.town, search) ||
				matches(entry.property.postcode, search) ||
				matches(entry.customerCaption, search)
		)
		.sort(
			(first, second) =>
				compareEntries(first, second, sort) * (direction === 'asc' ? 1 : -1) ||
				first.property.id.localeCompare(second.property.id)
		);

	return toPage(entries.map(toListRow), { page: params.page, pageSize: params.pageSize });
}

export async function mockGetProperty(id: string): Promise<PropertyDetail> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROPERTY_VIEW);
	const property = findProperty(id, tenantId);

	const customer = tenantCustomers(tenantId).find((row) => row.id === property.customerId) ?? null;
	const projects = getCollection<ProjectRecord>(COLLECTIONS.projects)
		.filter((row) => row.tenantId === tenantId && row.propertyId === property.id)
		.sort(
			(first, second) =>
				second.createdAt.localeCompare(first.createdAt) || first.id.localeCompare(second.id)
		)
		.map((row) => ({
			id: row.id,
			caption: row.caption,
			reference: row.reference,
			projectType: row.projectType,
			status: row.status
		}));

	return {
		property,
		customer: customer
			? {
					id: customer.id,
					caption: customer.caption,
					email: customer.email,
					phone: customer.phone,
					state: customer.state
				}
			: null,
		projects
	};
}

export async function mockCreateProperty(input: CreatePropertyInput): Promise<Property> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.PROPERTY_CREATE);

	const parsed = propertyFormSchema.safeParse(normalisePropertyInput(input));
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const customer = tenantCustomers(tenantId).find((row) => row.id === values.customerId);
	if (!customer || customer.state === 'archived' || customer.state === 'cancelled') {
		throw validation('Choose an active customer for this property.', {
			customerId: 'Choose an active customer for this property.'
		});
	}

	const addressLine1 = values.addressLine1;
	const postcode = values.postcode ?? null;
	const candidates: DedupCandidateRef[] = tenantProperties(tenantId)
		.filter((property) => property.state !== 'archived')
		.map((property) => ({
			property,
			matchReasons: propertyMatchReasons(
				{ addressLine1, postcode },
				{ addressLine1: property.addressLine1, postcode: property.postcode }
			)
		}))
		.filter(({ matchReasons }) => matchReasons.length > 0)
		.map(({ property, matchReasons }) => ({
			id: property.id,
			entityType: 'property',
			caption: property.addressLine1,
			createdAt: property.createdAt,
			matchReasons
		}));

	const now = new Date().toISOString();
	const record: PropertyRecord = {
		id: newUuid(),
		tenantId,
		customerId: values.customerId,
		addressLine1,
		addressLine2: values.addressLine2 ?? null,
		town: values.town ?? null,
		postcode,
		accessNotes: values.accessNotes ?? null,
		state: candidates.length > 0 ? 'pending_review' : 'active',
		dedupOfId: candidates[0]?.id ?? null,
		reviewNote: null,
		createdAt: now,
		updatedAt: now,
		createdBy: user.id,
		archivedAt: null
	};

	updateCollection<PropertyRecord>(COLLECTIONS.properties, (rows) => [...rows, record]);
	recordTenantAudit({
		tenantId,
		action: 'create',
		subjectType: 'property',
		subjectId: record.id,
		payload: { held: candidates.length > 0 }
	});

	if (candidates.length > 0) {
		throw new ApiError({
			code: ApiErrorCode.CONFLICT,
			status: 409,
			message: 'A property at this address already exists. Review the match before continuing.',
			details: {
				entityType: 'property',
				heldId: record.id,
				candidates
			}
		});
	}

	return record;
}

export async function mockUpdateProperty(
	id: string,
	input: UpdatePropertyInput
): Promise<Property> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROPERTY_UPDATE);
	const existing = findProperty(id, tenantId);

	if (existing.state === 'pending_review') {
		throw conflict('This property is awaiting duplicate review and cannot be edited.');
	}
	if (existing.state === 'archived') {
		throw conflict('This property is archived. Unarchive it before editing.');
	}
	if (existing.state === 'cancelled') {
		throw conflict('This property was linked to an existing record and cannot be edited.');
	}

	const normalised = normalisePropertyInput(input);
	const parsed = propertyFormSchema.partial().safeParse(normalised);
	if (!parsed.success) throw mapZodError(parsed.error);

	const updated: PropertyRecord = { ...existing };
	const changed: string[] = [];

	if (normalised.customerId !== undefined) {
		const customer = tenantCustomers(tenantId).find((row) => row.id === normalised.customerId);
		if (!customer || customer.state === 'archived' || customer.state === 'cancelled') {
			throw validation('Choose an active customer for this property.', {
				customerId: 'Choose an active customer for this property.'
			});
		}
		if (normalised.customerId !== existing.customerId) {
			updated.customerId = normalised.customerId;
			changed.push('customerId');
		}
	}

	if (normalised.addressLine1 !== undefined && normalised.addressLine1 !== existing.addressLine1) {
		updated.addressLine1 = normalised.addressLine1;
		changed.push('addressLine1');
	}
	if (normalised.addressLine2 !== undefined) {
		const next = normalised.addressLine2 ?? null;
		if (next !== existing.addressLine2) {
			updated.addressLine2 = next;
			changed.push('addressLine2');
		}
	}
	if (normalised.town !== undefined) {
		const next = normalised.town ?? null;
		if (next !== existing.town) {
			updated.town = next;
			changed.push('town');
		}
	}
	if (normalised.postcode !== undefined) {
		const next = normalised.postcode ?? null;
		if (next !== existing.postcode) {
			updated.postcode = next;
			changed.push('postcode');
		}
	}
	if (normalised.accessNotes !== undefined) {
		const next = normalised.accessNotes ?? null;
		if (next !== existing.accessNotes) {
			updated.accessNotes = next;
			changed.push('accessNotes');
		}
	}

	if (changed.length === 0) return existing;

	updated.updatedAt = new Date().toISOString();
	saveProperty(updated);
	recordTenantAudit({
		tenantId,
		action: 'update',
		subjectType: 'property',
		subjectId: updated.id,
		payload: { fields: changed }
	});
	return updated;
}

export async function mockArchiveProperty(id: string): Promise<Property> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROPERTY_ARCHIVE);
	const existing = findProperty(id, tenantId);

	if (existing.state === 'pending_review') {
		throw conflict('Review the duplicate match before archiving this property.');
	}
	if (existing.state === 'archived') {
		throw conflict('This property is already archived.');
	}
	if (existing.state === 'cancelled') {
		throw conflict('This property was linked to an existing record and cannot be archived.');
	}

	const now = new Date().toISOString();
	const updated: PropertyRecord = {
		...existing,
		state: 'archived',
		archivedAt: now,
		updatedAt: now
	};
	saveProperty(updated);
	recordTenantAudit({
		tenantId,
		action: 'archive',
		subjectType: 'property',
		subjectId: updated.id,
		payload: { from: existing.state, to: 'archived' }
	});
	return updated;
}

export async function mockUnarchiveProperty(id: string): Promise<Property> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROPERTY_ARCHIVE);
	const existing = findProperty(id, tenantId);

	if (existing.state === 'pending_review') {
		throw conflict('Review the duplicate match before restoring this property.');
	}
	if (existing.state === 'active') {
		throw conflict('This property is already active.');
	}
	if (existing.state === 'cancelled') {
		throw conflict('This property was linked to an existing record and cannot be restored.');
	}

	const now = new Date().toISOString();
	const updated: PropertyRecord = {
		...existing,
		state: 'active',
		archivedAt: null,
		updatedAt: now
	};
	saveProperty(updated);
	recordTenantAudit({
		tenantId,
		action: 'unarchive',
		subjectType: 'property',
		subjectId: updated.id,
		payload: { from: existing.state, to: 'active' }
	});
	return updated;
}

export async function mockReviewPropertyDedup(
	id: string,
	input: DedupReviewInput
): Promise<Property> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROPERTY_UPDATE);
	const existing = findProperty(id, tenantId);

	if (existing.state !== 'pending_review') throw conflict(DEDUP_ALREADY_REVIEWED);
	if (input.decision !== 'link_to_existing' && input.decision !== 'confirm_distinct') {
		throw validation('Choose how to resolve this duplicate.');
	}

	const reviewNote = typeof input.reviewNote === 'string' ? input.reviewNote.trim() : '';
	if (reviewNote.length > NOTE_MAX) {
		throw validation('Keep the note to 2000 characters or fewer.', {
			reviewNote: 'Keep the note to 2000 characters or fewer.'
		});
	}
	if (input.decision === 'confirm_distinct' && reviewNote.length === 0) {
		throw validation(DEDUP_NOTE_REQUIRED, { reviewNote: DEDUP_NOTE_REQUIRED });
	}

	let nextState: PropertyRecord['state'] = 'active';
	let targetId: string | null = null;

	if (input.decision === 'link_to_existing') {
		if (!input.targetId) throw validation(DEDUP_TARGET_INVALID, { targetId: DEDUP_TARGET_INVALID });
		const target = tenantProperties(tenantId).find((row) => row.id === input.targetId);
		if (!target || target.id === existing.id) {
			throw validation(DEDUP_TARGET_NOT_FOUND, { targetId: DEDUP_TARGET_NOT_FOUND });
		}
		nextState = 'cancelled';
		targetId = target.id;
	}

	const updated: PropertyRecord = {
		...existing,
		state: nextState,
		dedupOfId: targetId,
		reviewNote: reviewNote.length > 0 ? reviewNote : null,
		updatedAt: new Date().toISOString()
	};
	saveProperty(updated);
	recordTenantAudit({
		tenantId,
		action: 'dedup_review',
		subjectType: 'property',
		subjectId: updated.id,
		payload: { decision: input.decision, targetId, reviewNote: updated.reviewNote }
	});
	return updated;
}

export async function mockAuditProperty(id: string): Promise<AuditTrailRow[]> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROPERTY_VIEW);
	findProperty(id, tenantId);
	return listTenantAudit(tenantId, 'property', id);
}
