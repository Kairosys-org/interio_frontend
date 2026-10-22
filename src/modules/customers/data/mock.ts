import type { ZodError } from 'zod';
import { listTenantAudit, recordTenantAudit } from '$shared/data/audit';
import { COLLECTIONS } from '$shared/data/collections';
import { demoNow } from '$shared/data/demo-clock';
import { requireTenantSession } from '$shared/data/mock-session';
import type { CustomerRecord, ProjectRecord, PropertyRecord } from '$shared/data/records';
import type { AuditTrailRow } from '$shared/domain/audit';
import {
	customerMatchReasons,
	DEDUP_ALREADY_REVIEWED,
	DEDUP_NOTE_REQUIRED,
	DEDUP_TARGET_INVALID,
	DEDUP_TARGET_NOT_FOUND
} from '$shared/domain/dedup';
import type {
	DedupCandidateRef,
	DedupReviewInput,
	CustomerMatchFields
} from '$shared/domain/dedup';
import { toPage } from '$shared/domain/pagination';
import { PERMISSIONS } from '$shared/domain/permissions';
import { CUSTOMER_SOURCES, CUSTOMER_STATES } from '$shared/domain/record-states';
import type { Uuid } from '$shared/domain/uuid';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, registerSeeder, updateCollection } from '$network/mock-backend';
import type {
	CreateCustomerInput,
	Customer,
	CustomerDetail,
	CustomerDedupConflict,
	CustomerListParams,
	CustomerListRow,
	CustomerPage,
	CustomerProjectSummary,
	CustomerPropertySummary,
	CustomerSort,
	UpdateCustomerInput
} from '../domain/types';
import { customerFormSchema, fieldErrorsFrom, normaliseCustomerInput } from '../domain/validations';
import { seedCustomers } from './seed';

/** The mock backend behaves like the server: every call is authorised first. */
registerSeeder(seedCustomers);

const NOT_FOUND_MESSAGE = 'Customer not found.';
const PENDING_EDIT_MESSAGE = 'Review this duplicate before editing it.';

const CUSTOMER_SORT_FIELDS: readonly CustomerSort[] = [
	'caption',
	'createdAt',
	'updatedAt',
	'postcode',
	'state'
];

function notFound(message = NOT_FOUND_MESSAGE): ApiError {
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

function mapZodError(error: ZodError): ApiError {
	return validation('Check the highlighted fields and try again.', fieldErrorsFrom(error));
}

function toCustomer(record: CustomerRecord): Customer {
	return { ...record };
}

function toListRow(record: CustomerRecord): CustomerListRow {
	return {
		id: record.id,
		caption: record.caption,
		contactName: record.contactName,
		email: record.email,
		phone: record.phone,
		postcode: record.postcode,
		state: record.state,
		preferredChannel: record.preferredChannel,
		createdAt: record.createdAt
	};
}

function matches(value: string | null | undefined, needle: string): boolean {
	return typeof value === 'string' && value.toLowerCase().includes(needle);
}

function stateRank(state: CustomerRecord['state']): number {
	const index = CUSTOMER_STATES.indexOf(state);
	return index === -1 ? CUSTOMER_STATES.length : index;
}

function compareCustomers(
	first: CustomerRecord,
	second: CustomerRecord,
	sort: CustomerSort,
	sortDir: 'asc' | 'desc'
): number {
	let primary = 0;

	switch (sort) {
		case 'caption':
			primary = first.caption.localeCompare(second.caption, 'en-GB');
			break;
		case 'postcode':
			primary = (first.postcode ?? '').localeCompare(second.postcode ?? '', 'en-GB');
			break;
		case 'state':
			primary = stateRank(first.state) - stateRank(second.state);
			break;
		case 'updatedAt':
			primary = first.updatedAt.localeCompare(second.updatedAt);
			break;
		case 'createdAt':
		default:
			primary = first.createdAt.localeCompare(second.createdAt);
			break;
	}

	if (primary === 0) return first.id.localeCompare(second.id);
	return sortDir === 'asc' ? primary : -primary;
}

function findCustomer(tenantId: Uuid, id: Uuid): CustomerRecord {
	const customer = getCollection<CustomerRecord>(COLLECTIONS.customers).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!customer) throw notFound();
	return customer;
}

function candidateRef(
	customer: CustomerRecord,
	matchReasons: readonly string[]
): DedupCandidateRef {
	return {
		id: customer.id,
		entityType: 'customer',
		caption: customer.caption,
		createdAt: customer.createdAt,
		matchReasons: [...matchReasons]
	};
}

/** Same-tenant, live rows only: archived/cancelled records are not candidates. */
function findDuplicateCandidates(
	tenantId: Uuid,
	fields: CustomerMatchFields
): Array<{ customer: CustomerRecord; matchReasons: string[] }> {
	return getCollection<CustomerRecord>(COLLECTIONS.customers)
		.filter(
			(row) => row.tenantId === tenantId && row.state !== 'archived' && row.state !== 'cancelled'
		)
		.map((row) => ({ customer: row, matchReasons: customerMatchReasons(fields, row) }))
		.filter((candidate) => candidate.matchReasons.length > 0)
		.sort(
			(first, second) =>
				first.customer.createdAt.localeCompare(second.customer.createdAt) ||
				first.customer.id.localeCompare(second.customer.id)
		);
}

function duplicateMessage(candidates: ReadonlyArray<{ customer: CustomerRecord }>): string {
	const captions = [...new Set(candidates.map((candidate) => candidate.customer.caption))];
	const list = captions.join(', ');
	return candidates.length === 1
		? `A possible duplicate already exists: ${list}. Review it before this customer becomes active.`
		: `Possible duplicates already exist: ${list}. Review them before this customer becomes active.`;
}

function appendCustomer(record: CustomerRecord): void {
	updateCollection<CustomerRecord>(COLLECTIONS.customers, (rows) => [...rows, record]);
}

function replaceCustomer(record: CustomerRecord): void {
	updateCollection<CustomerRecord>(COLLECTIONS.customers, (rows) =>
		rows.map((row) => (row.id === record.id ? record : row))
	);
}

function writeAudit(
	tenantId: Uuid,
	action: string,
	subjectId: Uuid,
	payload: Record<string, unknown>
): void {
	recordTenantAudit({ tenantId, action, subjectType: 'customer', subjectId, payload });
}

function propertySummary(record: PropertyRecord): CustomerPropertySummary {
	return {
		id: record.id,
		addressLine1: record.addressLine1,
		addressLine2: record.addressLine2,
		town: record.town,
		postcode: record.postcode,
		state: record.state
	};
}

function projectSummary(record: ProjectRecord): CustomerProjectSummary {
	return {
		id: record.id,
		caption: record.caption,
		reference: record.reference,
		projectType: record.projectType,
		status: record.status
	};
}

function byCreatedAt(record: { createdAt: string; id: Uuid }) {
	return record.createdAt;
}

export async function mockListCustomers(params: CustomerListParams = {}): Promise<CustomerPage> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CUSTOMER_VIEW);

	const search = params.search?.trim().toLowerCase() ?? '';
	const state = params.state ?? 'all';
	const sort: CustomerSort = CUSTOMER_SORT_FIELDS.includes(params.sort ?? 'createdAt')
		? (params.sort ?? 'createdAt')
		: 'createdAt';
	const sortDir = params.sortDir ?? (sort === 'createdAt' || sort === 'updatedAt' ? 'desc' : 'asc');

	const rows = getCollection<CustomerRecord>(COLLECTIONS.customers)
		.filter((customer) => customer.tenantId === tenantId)
		.filter((customer) => state === 'all' || customer.state === state)
		.filter(
			(customer) =>
				search.length === 0 ||
				matches(customer.caption, search) ||
				matches(customer.contactName, search) ||
				matches(customer.email, search) ||
				matches(customer.phone, search) ||
				matches(customer.postcode, search)
		)
		.sort((first, second) => compareCustomers(first, second, sort, sortDir))
		.map(toListRow);

	return toPage(rows, { page: params.page, pageSize: params.pageSize });
}

export async function mockGetCustomer(id: Uuid): Promise<CustomerDetail> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CUSTOMER_VIEW);
	const customer = findCustomer(tenantId, id);

	const properties = getCollection<PropertyRecord>(COLLECTIONS.properties)
		.filter((property) => property.tenantId === tenantId && property.customerId === customer.id)
		.sort(
			(first, second) =>
				byCreatedAt(first).localeCompare(byCreatedAt(second)) || first.id.localeCompare(second.id)
		)
		.map(propertySummary);

	const projects = getCollection<ProjectRecord>(COLLECTIONS.projects)
		.filter((project) => project.tenantId === tenantId && project.customerId === customer.id)
		.sort(
			(first, second) =>
				byCreatedAt(first).localeCompare(byCreatedAt(second)) || first.id.localeCompare(second.id)
		)
		.map(projectSummary);

	return { customer: toCustomer(customer), properties, projects };
}

export async function mockCreateCustomer(input: CreateCustomerInput): Promise<Customer> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.CUSTOMER_CREATE);
	const normalised = normaliseCustomerInput(input);

	const parsed = customerFormSchema.safeParse({
		caption: normalised.caption ?? '',
		contactName: normalised.contactName ?? null,
		email: normalised.email ?? null,
		phone: normalised.phone ?? null,
		addressLine1: normalised.addressLine1 ?? null,
		addressLine2: normalised.addressLine2 ?? null,
		town: normalised.town ?? null,
		postcode: normalised.postcode ?? null,
		preferredChannel: normalised.preferredChannel ?? input.preferredChannel
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const source = input.source ?? 'survey';
	if (!CUSTOMER_SOURCES.includes(source)) {
		throw validation('Choose a valid customer source.', {
			source: 'Choose a valid customer source.'
		});
	}

	const values = parsed.data;
	const candidates = findDuplicateCandidates(tenantId, values);
	const now = demoNow().toISOString();
	const held = candidates.length > 0;

	const record: CustomerRecord = {
		id: newUuid(),
		tenantId,
		caption: values.caption,
		contactName: values.contactName,
		email: values.email,
		phone: values.phone,
		addressLine1: values.addressLine1,
		addressLine2: values.addressLine2,
		town: values.town,
		postcode: values.postcode,
		preferredChannel: values.preferredChannel,
		source,
		leadUuid: null,
		state: held ? 'pending_review' : 'active',
		dedupOfId: held ? (candidates[0]?.customer.id ?? null) : null,
		reviewNote: null,
		createdAt: now,
		updatedAt: now,
		createdBy: user.id,
		archivedAt: null
	};

	appendCustomer(record);

	if (held) {
		writeAudit(tenantId, 'create', record.id, {
			held: true,
			dedupOfId: record.dedupOfId,
			candidates: candidates.map((candidate) => candidate.customer.id)
		});

		const details: CustomerDedupConflict = {
			entityType: 'customer',
			heldId: record.id,
			candidates: candidates.map((candidate) =>
				candidateRef(candidate.customer, candidate.matchReasons)
			)
		};

		throw new ApiError({
			code: ApiErrorCode.CONFLICT,
			status: 409,
			message: duplicateMessage(candidates),
			details
		});
	}

	writeAudit(tenantId, 'create', record.id, { held: false });
	return toCustomer(record);
}

export async function mockUpdateCustomer(id: Uuid, input: UpdateCustomerInput): Promise<Customer> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CUSTOMER_UPDATE);
	const customer = findCustomer(tenantId, id);

	if (customer.state === 'pending_review') throw conflict(PENDING_EDIT_MESSAGE);
	if (customer.state === 'archived') {
		throw conflict('This customer is archived. Unarchive it before editing.');
	}
	if (customer.state === 'cancelled') {
		throw conflict('This customer was cancelled during duplicate review and cannot be edited.');
	}

	const patch = normaliseCustomerInput(input);
	const candidate: CustomerRecord = {
		...customer,
		caption: patch.caption ?? customer.caption,
		contactName: patch.contactName !== undefined ? patch.contactName : customer.contactName,
		email: patch.email !== undefined ? patch.email : customer.email,
		phone: patch.phone !== undefined ? patch.phone : customer.phone,
		addressLine1: patch.addressLine1 !== undefined ? patch.addressLine1 : customer.addressLine1,
		addressLine2: patch.addressLine2 !== undefined ? patch.addressLine2 : customer.addressLine2,
		town: patch.town !== undefined ? patch.town : customer.town,
		postcode: patch.postcode !== undefined ? patch.postcode : customer.postcode,
		preferredChannel: patch.preferredChannel ?? customer.preferredChannel
	};

	const fieldNames = [
		'caption',
		'contactName',
		'email',
		'phone',
		'addressLine1',
		'addressLine2',
		'town',
		'postcode',
		'preferredChannel'
	] as const;
	const changedFields = fieldNames.filter((field) => candidate[field] !== customer[field]);
	if (changedFields.length === 0) return toCustomer(customer);

	const parsed = customerFormSchema.safeParse({
		caption: candidate.caption,
		contactName: candidate.contactName,
		email: candidate.email,
		phone: candidate.phone,
		addressLine1: candidate.addressLine1,
		addressLine2: candidate.addressLine2,
		town: candidate.town,
		postcode: candidate.postcode,
		preferredChannel: candidate.preferredChannel
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const updated: CustomerRecord = {
		...candidate,
		...parsed.data,
		updatedAt: demoNow().toISOString()
	};

	replaceCustomer(updated);
	writeAudit(tenantId, 'update', updated.id, { changedFields });
	return toCustomer(updated);
}

export async function mockArchiveCustomer(id: Uuid): Promise<Customer> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CUSTOMER_ARCHIVE);
	const customer = findCustomer(tenantId, id);

	if (customer.state === 'archived') throw conflict('This customer is already archived.');
	if (customer.state === 'pending_review') {
		throw conflict('Review this duplicate before archiving it.');
	}
	if (customer.state === 'cancelled') {
		throw conflict('Cancelled customers cannot be archived.');
	}

	const now = demoNow().toISOString();
	const updated: CustomerRecord = {
		...customer,
		state: 'archived',
		archivedAt: now,
		updatedAt: now
	};

	replaceCustomer(updated);
	writeAudit(tenantId, 'archive', updated.id, { previousState: customer.state });
	return toCustomer(updated);
}

export async function mockUnarchiveCustomer(id: Uuid): Promise<Customer> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CUSTOMER_ARCHIVE);
	const customer = findCustomer(tenantId, id);

	if (customer.state !== 'archived') {
		throw conflict('Only archived customers can be unarchived.');
	}

	const updated: CustomerRecord = {
		...customer,
		state: 'active',
		archivedAt: null,
		updatedAt: demoNow().toISOString()
	};

	replaceCustomer(updated);
	writeAudit(tenantId, 'unarchive', updated.id, {});
	return toCustomer(updated);
}

export async function mockReviewCustomerDedup(
	id: Uuid,
	input: DedupReviewInput
): Promise<Customer> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CUSTOMER_UPDATE);
	const customer = findCustomer(tenantId, id);

	if (customer.state !== 'pending_review') throw conflict(DEDUP_ALREADY_REVIEWED);

	const note = typeof input.reviewNote === 'string' ? input.reviewNote.trim() : '';
	const now = demoNow().toISOString();
	let updated: CustomerRecord;

	if (input.decision === 'confirm_distinct') {
		if (note.length === 0) {
			throw validation(DEDUP_NOTE_REQUIRED, { reviewNote: DEDUP_NOTE_REQUIRED });
		}
		updated = {
			...customer,
			state: 'active',
			dedupOfId: null,
			reviewNote: note,
			updatedAt: now
		};
	} else if (input.decision === 'link_to_existing') {
		if (typeof input.targetId !== 'string' || input.targetId.trim().length === 0) {
			throw validation(DEDUP_TARGET_INVALID, { targetId: DEDUP_TARGET_INVALID });
		}
		if (input.targetId === customer.id) {
			throw validation(DEDUP_TARGET_INVALID, { targetId: DEDUP_TARGET_INVALID });
		}
		const target = getCollection<CustomerRecord>(COLLECTIONS.customers).find(
			(row) => row.tenantId === tenantId && row.id === input.targetId
		);
		if (!target) throw notFound(DEDUP_TARGET_NOT_FOUND);

		updated = {
			...customer,
			state: 'cancelled',
			dedupOfId: target.id,
			reviewNote: note.length > 0 ? note : null,
			updatedAt: now
		};
	} else {
		throw validation('Choose whether this is a different customer or an existing one.');
	}

	replaceCustomer(updated);
	writeAudit(tenantId, 'dedup_review', updated.id, {
		decision: input.decision,
		targetId: updated.dedupOfId,
		reviewNote: note.length > 0 ? note : null
	});
	return toCustomer(updated);
}

export async function mockListCustomerAudit(id: Uuid): Promise<AuditTrailRow[]> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CUSTOMER_VIEW);
	findCustomer(tenantId, id);
	return listTenantAudit(tenantId, 'customer', id);
}
