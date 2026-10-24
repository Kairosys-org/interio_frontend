import type { ZodError } from 'zod';
import { listTenantAudit, recordTenantAudit } from '$shared/data/audit';
import { COLLECTIONS } from '$shared/data/collections';
import { requireTenantSession } from '$shared/data/mock-session';
import type {
	CustomerRecord,
	DecorRecord,
	ImportBatchRecord,
	ImportRowRecord,
	ManufacturerRecord,
	MaterialCollectionRecord,
	ProjectRecord,
	PropertyRecord,
	SupplierRecord,
	TenantRecord
} from '$shared/data/records';
import type { AuditTrailRow } from '$shared/domain/audit';
import {
	customerMatchReasons,
	normaliseEmail,
	normalisePhone,
	normalisePostcode,
	projectMatchReasons,
	propertyMatchReasons
} from '$shared/domain/dedup';
import { toPage } from '$shared/domain/pagination';
import { PERMISSIONS } from '$shared/domain/permissions';
import {
	DECOR_COLOUR_FAMILIES,
	DECOR_CORES,
	DECOR_MATERIAL_TYPES,
	GRAIN_DIRECTIONS,
	PREFERRED_CHANNELS,
	PREMIUM_TIERS,
	type DecorColourFamily,
	type DecorCore,
	type DecorMaterialType,
	type GrainDirection,
	type ImportOutcome,
	type ImportValidation,
	type PreferredChannel,
	type PremiumTier,
	type ProjectType
} from '$shared/domain/record-states';
import type { Uuid } from '$shared/domain/uuid';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, registerSeeder, updateCollection } from '$network/mock-backend';
import {
	CsvParseError,
	IMPORT_FIELDS,
	parseCsv,
	rowsToRecords,
	validateImportRows
} from '../domain/csv';
import type { ImportMatchContext, ParsedImportRow } from '../domain/csv';
import type {
	CreateImportInput,
	ImportBatch,
	ImportBatchListParams,
	ImportBatchPage,
	ImportCommitResult,
	ImportRow,
	ImportRowListParams,
	ImportRowPage
} from '../domain/types';
import { importStageSchema, requiredFieldsMapped } from '../domain/validations';
import { seedImports } from './seed';

/**
 * Import mock server (architecture §4.6, spec Part 10 §26, phase-1 §5.3).
 *
 * Behaves like the backend: the tenant always comes from the session, both
 * permissions are re-checked here, staging persists rows without creating
 * entities, and commit is the only path that writes customers/properties/
 * projects. Commit never updates or deletes an existing record: a clash
 * becomes a `pending_review` record so the dedup queue can resolve it (R5).
 */

registerSeeder(seedImports);

const SUBJECT_TYPE = 'import_batch';
const NOT_FOUND_MESSAGE = 'Import batch not found.';

function notFound(): ApiError {
	return new ApiError({ code: ApiErrorCode.NOT_FOUND, status: 404, message: NOT_FOUND_MESSAGE });
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
	return validation('Check the file and column mapping, then try again.', fieldErrorsFrom(error));
}

function nowIso(): string {
	return new Date().toISOString();
}

function toBatch(record: ImportBatchRecord): ImportBatch {
	return { ...record, columnMap: { ...record.columnMap } };
}

function toRow(record: ImportRowRecord): ImportRow {
	return { ...record, payload: { ...record.payload } };
}

function findBatch(tenantId: Uuid, id: Uuid): ImportBatchRecord {
	const batch = getCollection<ImportBatchRecord>(COLLECTIONS.importBatches).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!batch) throw notFound();
	return batch;
}

/* ------------------------------------------------------------------ */
/* Match context (shared collections + shared dedup helpers only).    */
/* ------------------------------------------------------------------ */

function liveCustomers(tenantId: Uuid): CustomerRecord[] {
	return getCollection<CustomerRecord>(COLLECTIONS.customers).filter(
		(row) => row.tenantId === tenantId && row.state !== 'archived' && row.state !== 'cancelled'
	);
}

function liveProperties(tenantId: Uuid): PropertyRecord[] {
	return getCollection<PropertyRecord>(COLLECTIONS.properties).filter(
		(row) => row.tenantId === tenantId && row.state !== 'archived'
	);
}

function liveProjects(tenantId: Uuid): ProjectRecord[] {
	return getCollection<ProjectRecord>(COLLECTIONS.projects).filter(
		(row) =>
			row.tenantId === tenantId && row.state !== 'archived' && (row.state as string) !== 'cancelled'
	);
}

/** Master data is matched across every status: a code stays unique forever. */
function tenantSuppliers(tenantId: Uuid): SupplierRecord[] {
	return getCollection<SupplierRecord>(COLLECTIONS.suppliers).filter(
		(row) => row.tenantId === tenantId
	);
}

function tenantManufacturers(tenantId: Uuid): ManufacturerRecord[] {
	return getCollection<ManufacturerRecord>(COLLECTIONS.manufacturers).filter(
		(row) => row.tenantId === tenantId
	);
}

function tenantCollections(tenantId: Uuid): MaterialCollectionRecord[] {
	return getCollection<MaterialCollectionRecord>(COLLECTIONS.materialCollections).filter(
		(row) => row.tenantId === tenantId
	);
}

function tenantDecors(tenantId: Uuid): DecorRecord[] {
	return getCollection<DecorRecord>(COLLECTIONS.decors).filter((row) => row.tenantId === tenantId);
}

/** Mutable context so rows created earlier in the same commit are visible. */
type MutableContext = {
	[K in keyof ImportMatchContext]: Array<ImportMatchContext[K][number]>;
};

function buildContext(tenantId: Uuid): MutableContext {
	return {
		customers: liveCustomers(tenantId).map((row) => ({
			id: row.id,
			caption: row.caption,
			email: row.email,
			phone: row.phone,
			postcode: row.postcode
		})),
		properties: liveProperties(tenantId).map((row) => ({
			id: row.id,
			addressLine1: row.addressLine1,
			town: row.town,
			postcode: row.postcode
		})),
		projects: liveProjects(tenantId).map((row) => ({
			id: row.id,
			propertyId: row.propertyId,
			projectType: row.projectType,
			caption: row.caption
		})),
		suppliers: tenantSuppliers(tenantId).map((row) => ({
			id: row.id,
			caption: row.caption,
			contact: row.contact
		})),
		manufacturers: tenantManufacturers(tenantId).map((row) => ({
			id: row.id,
			caption: row.caption
		})),
		collections: tenantCollections(tenantId).map((row) => ({
			id: row.id,
			manufacturerId: row.manufacturerId,
			caption: row.caption
		})),
		decors: tenantDecors(tenantId).map((row) => ({
			id: row.id,
			collectionId: row.collectionId,
			caption: row.caption,
			decorCode: row.decorCode
		}))
	};
}

function text(value: string | undefined): string {
	return (value ?? '').trim();
}

function optionalText(value: string | undefined): string | null {
	const trimmed = text(value);
	return trimmed.length > 0 ? trimmed : null;
}

function matchCustomer(
	context: MutableContext,
	fields: { caption: string; email: string | null; phone: string | null; postcode: string | null }
): Uuid | null {
	const match = context.customers.find(
		(candidate) => customerMatchReasons(fields, candidate).length > 0
	);
	return match?.id ?? null;
}

function matchProperty(
	context: MutableContext,
	fields: { addressLine1: string; postcode: string | null }
): Uuid | null {
	const match = context.properties.find(
		(candidate) => propertyMatchReasons(fields, candidate).length > 0
	);
	return match?.id ?? null;
}

function matchProject(
	context: MutableContext,
	fields: { propertyId: Uuid; projectType: string; caption: string }
): Uuid | null {
	const match = context.projects.find(
		(candidate) => projectMatchReasons(fields, candidate).length > 0
	);
	return match?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Reads.                                                             */
/* ------------------------------------------------------------------ */

export async function mockListImports(
	params: ImportBatchListParams = {}
): Promise<ImportBatchPage> {
	const { tenantId } = requireTenantSession(PERMISSIONS.IMPORT_VIEW);

	const kind = params.kind ?? 'all';
	const status = params.status ?? 'all';

	const rows = getCollection<ImportBatchRecord>(COLLECTIONS.importBatches)
		.filter((batch) => batch.tenantId === tenantId)
		.filter((batch) => kind === 'all' || batch.kind === kind)
		.filter((batch) => status === 'all' || batch.status === status)
		.sort(
			(first, second) =>
				second.createdAt.localeCompare(first.createdAt) || second.id.localeCompare(first.id)
		)
		.map(toBatch);

	return toPage(rows, { page: params.page, pageSize: params.pageSize });
}

export async function mockGetImport(id: Uuid): Promise<ImportBatch> {
	const { tenantId } = requireTenantSession(PERMISSIONS.IMPORT_VIEW);
	return toBatch(findBatch(tenantId, id));
}

export async function mockListImportRows(
	id: Uuid,
	params: ImportRowListParams = {}
): Promise<ImportRowPage> {
	const { tenantId } = requireTenantSession(PERMISSIONS.IMPORT_VIEW);
	const batch = findBatch(tenantId, id);
	const result = params.result ?? 'all';

	const rows = getCollection<ImportRowRecord>(COLLECTIONS.importRows)
		.filter((row) => row.tenantId === tenantId && row.batchId === batch.id)
		.filter((row) => {
			if (result === 'all') return true;
			// While staged the column shows the validation state; after commit it
			// shows the final outcome.
			const value = batch.status === 'staged' ? row.validation : row.outcome;
			return value === result;
		})
		.sort((first, second) => first.rowNo - second.rowNo || first.id.localeCompare(second.id))
		.map(toRow);

	return toPage(rows, { page: params.page, pageSize: params.pageSize });
}

/* ------------------------------------------------------------------ */
/* Staging.                                                           */
/* ------------------------------------------------------------------ */

function assertColumnMap(
	kind: keyof typeof IMPORT_FIELDS,
	columnMap: Record<string, string>
): void {
	const allowed = new Set(IMPORT_FIELDS[kind].map((field) => field.key));
	for (const key of Object.values(columnMap)) {
		if (!allowed.has(key)) {
			const message = `The column mapping includes "${key}", which is not a field for this import.`;
			throw validation(message, { columnMap: message });
		}
	}
}

function countBy(rows: readonly ParsedImportRow[], value: ImportValidation): number {
	return rows.filter((row) => row.validation === value).length;
}

export async function mockCreateImport(input: CreateImportInput): Promise<ImportBatch> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.IMPORT_CREATE);

	let parsed;
	try {
		parsed = parseCsv(input.csvText);
	} catch (error) {
		if (error instanceof CsvParseError) {
			throw validation(error.message, { csvText: error.message });
		}
		throw error;
	}

	const staged = importStageSchema.safeParse({
		kind: input.kind,
		fileName: input.fileName,
		columnMap: input.columnMap,
		rows: parsed.rows.length
	});
	if (!staged.success) throw mapZodError(staged.error);

	const { kind, fileName, columnMap } = staged.data;
	assertColumnMap(kind, columnMap);

	const missing = requiredFieldsMapped(kind, columnMap);
	if (missing.length > 0) {
		const message = `Map the required columns: ${missing.join(', ')}.`;
		throw validation(message, { columnMap: message });
	}

	const validated = validateImportRows(
		kind,
		rowsToRecords(parsed.headers, parsed.rows),
		columnMap,
		buildContext(tenantId)
	);

	const now = nowIso();
	const batch: ImportBatchRecord = {
		id: newUuid(),
		tenantId,
		kind,
		status: 'staged',
		fileName,
		columnMap: { ...columnMap },
		totalRows: validated.length,
		importedRows: 0,
		readyRows: countBy(validated, 'ready'),
		reviewRows: countBy(validated, 'needs_review'),
		rejectedRows: countBy(validated, 'rejected'),
		createdAt: now,
		updatedAt: now,
		createdBy: user.id,
		committedAt: null
	};

	const rows: ImportRowRecord[] = validated.map((row) => ({
		id: newUuid(),
		tenantId,
		batchId: batch.id,
		rowNo: row.rowNo,
		payload: { ...row.payload },
		validation: row.validation,
		outcome: null,
		error: row.error,
		entityType: null,
		entityId: null,
		createdAt: now
	}));

	// Everything is computed before the first write: a bad file leaves no trace.
	updateCollection<ImportBatchRecord>(COLLECTIONS.importBatches, (existing) => [
		...existing,
		batch
	]);
	updateCollection<ImportRowRecord>(COLLECTIONS.importRows, (existing) => [...existing, ...rows]);

	recordTenantAudit({
		tenantId,
		action: 'create',
		subjectType: SUBJECT_TYPE,
		subjectId: batch.id,
		payload: { kind: batch.kind, totalRows: batch.totalRows }
	});

	return toBatch(batch);
}

/* ------------------------------------------------------------------ */
/* Commit.                                                            */
/* ------------------------------------------------------------------ */

interface RowOutcome {
	outcome: ImportOutcome;
	entityType: string | null;
	entityId: Uuid | null;
	error: string | null;
}

class Committer {
	readonly customers: CustomerRecord[] = [];
	readonly properties: PropertyRecord[] = [];
	readonly projects: ProjectRecord[] = [];
	readonly suppliers: SupplierRecord[] = [];
	readonly decors: DecorRecord[] = [];
	readonly rows = new Map<Uuid, RowOutcome>();
	imported = 0;
	held = 0;
	rejected = 0;

	constructor(
		private readonly tenantId: Uuid,
		private readonly userId: Uuid | null,
		private readonly now: string,
		private readonly kind: keyof typeof IMPORT_FIELDS,
		private readonly context: MutableContext,
		private readonly tenantProjects: ProjectRecord[],
		private readonly tenant: TenantRecord | undefined
	) {}

	apply(row: ImportRowRecord): void {
		if (row.validation === 'rejected') {
			this.rejected += 1;
			this.rows.set(row.id, {
				outcome: 'rejected',
				entityType: null,
				entityId: null,
				error: row.error
			});
			return;
		}

		const outcome = this.createEntity(row);
		this.rows.set(row.id, outcome);
		if (outcome.outcome === 'imported') this.imported += 1;
		else this.held += 1;
	}

	private createEntity(row: ImportRowRecord): RowOutcome {
		switch (this.kind) {
			case 'property':
				return this.createProperty(row);
			case 'project':
				return this.createProject(row);
			case 'supplier':
				return this.createSupplier(row);
			case 'decor':
				return this.createDecor(row);
			case 'customer':
			default:
				return this.createCustomer(row);
		}
	}

	private base() {
		return {
			tenantId: this.tenantId,
			createdAt: this.now,
			updatedAt: this.now,
			createdBy: this.userId,
			archivedAt: null,
			reviewNote: null
		};
	}

	private createCustomer(row: ImportRowRecord): RowOutcome {
		const caption = text(row.payload.caption);
		const email = normaliseEmail(row.payload.email);
		const phone = normalisePhone(row.payload.phone);
		const postcode = normalisePostcode(row.payload.postcode);
		const channel = text(row.payload.preferred_channel).toLowerCase();
		const preferredChannel = PREFERRED_CHANNELS.includes(channel as PreferredChannel)
			? (channel as PreferredChannel)
			: 'none';

		const matchId = matchCustomer(this.context, { caption, email, phone, postcode });
		const record: CustomerRecord = {
			id: newUuid(),
			...this.base(),
			caption,
			contactName: optionalText(row.payload.contact_name),
			email,
			phone,
			addressLine1: optionalText(row.payload.address_line1),
			addressLine2: optionalText(row.payload.address_line2),
			town: optionalText(row.payload.town),
			postcode,
			preferredChannel,
			source: 'other',
			leadUuid: null,
			state: matchId ? 'pending_review' : 'active',
			dedupOfId: matchId
		};

		this.customers.push(record);
		this.context.customers.push({
			id: record.id,
			caption: record.caption,
			email: record.email,
			phone: record.phone,
			postcode: record.postcode
		});

		return {
			outcome: matchId ? 'needs_review' : 'imported',
			entityType: 'customer',
			entityId: record.id,
			error: null
		};
	}

	private createProperty(row: ImportRowRecord): RowOutcome {
		const customer = this.context.customers.find(
			(candidate) => normaliseEmail(candidate.email) === normaliseEmail(row.payload.customer_email)
		);
		if (!customer) {
			return {
				outcome: 'needs_review',
				entityType: null,
				entityId: null,
				error: 'The customer for this row could not be found when the batch was committed.'
			};
		}

		const addressLine1 = text(row.payload.address_line1);
		const postcode = normalisePostcode(row.payload.postcode);
		const matchId = matchProperty(this.context, { addressLine1, postcode });
		const record: PropertyRecord = {
			id: newUuid(),
			...this.base(),
			customerId: customer.id,
			addressLine1,
			addressLine2: optionalText(row.payload.address_line2),
			town: optionalText(row.payload.town),
			postcode,
			accessNotes: optionalText(row.payload.access_notes),
			state: matchId ? 'pending_review' : 'active',
			dedupOfId: matchId
		};

		this.properties.push(record);
		this.context.properties.push({
			id: record.id,
			addressLine1: record.addressLine1,
			town: record.town,
			postcode: record.postcode
		});

		return {
			outcome: matchId ? 'needs_review' : 'imported',
			entityType: 'property',
			entityId: record.id,
			error: null
		};
	}

	private createProject(row: ImportRowRecord): RowOutcome {
		const customer = this.context.customers.find(
			(candidate) => normaliseEmail(candidate.email) === normaliseEmail(row.payload.customer_email)
		);
		const property = this.context.properties.find(
			(candidate) =>
				normaliseText(candidate.addressLine1) === normaliseText(row.payload.property_address) ||
				normaliseText(fullAddress(candidate)) === normaliseText(row.payload.property_address)
		);

		if (!customer) {
			return {
				outcome: 'needs_review',
				entityType: null,
				entityId: null,
				error: 'The customer for this row could not be found when the batch was committed.'
			};
		}
		if (!property) {
			return {
				outcome: 'needs_review',
				entityType: null,
				entityId: null,
				error: 'The property for this row could not be found when the batch was committed.'
			};
		}

		const caption = text(row.payload.caption);
		const projectType = text(row.payload.project_type).toLowerCase() as ProjectType;
		const matchId = matchProject(this.context, {
			propertyId: property.id,
			projectType,
			caption
		});
		const record: ProjectRecord = {
			id: newUuid(),
			...this.base(),
			customerId: customer.id,
			propertyId: property.id,
			caption,
			reference: buildReference(
				this.tenant,
				[...this.tenantProjects, ...this.projects],
				this.tenantId
			),
			projectType,
			status: 'active',
			state: matchId ? 'pending_review' : 'active',
			dedupOfId: null
		};

		this.projects.push(record);
		this.context.projects.push({
			id: record.id,
			propertyId: record.propertyId,
			projectType: record.projectType,
			caption: record.caption
		});

		return {
			outcome: matchId ? 'needs_review' : 'imported',
			entityType: 'project',
			entityId: record.id,
			error: null
		};
	}

	private matchSupplier(caption: string, contact: string | null): Uuid | null {
		const match = this.context.suppliers.find(
			(candidate) =>
				normaliseText(candidate.caption) === normaliseText(caption) ||
				(contact !== null &&
					candidate.contact !== null &&
					normaliseText(candidate.contact) === normaliseText(contact))
		);
		return match?.id ?? null;
	}

	/** A supplier is always created; a name clash is reported, never merged. */
	private createSupplier(row: ImportRowRecord): RowOutcome {
		const caption = text(row.payload.caption);
		const contact = optionalText(row.payload.contact);
		const leadRaw = text(row.payload.lead_time_days);
		const leadTimeDays = leadRaw.length > 0 ? Number(leadRaw) : null;
		const matchId = this.matchSupplier(caption, contact);

		const record: SupplierRecord = {
			id: newUuid(),
			tenantId: this.tenantId,
			caption,
			contact,
			leadTimeDays,
			active: true,
			createdAt: this.now,
			updatedAt: this.now
		};
		this.suppliers.push(record);
		this.context.suppliers.push({ id: record.id, caption, contact });

		return {
			outcome: matchId ? 'needs_review' : 'imported',
			entityType: 'supplier',
			entityId: record.id,
			error: null
		};
	}

	private createDecor(row: ImportRowRecord): RowOutcome {
		const manufacturerName = text(row.payload.manufacturer);
		const manufacturer = this.context.manufacturers.find(
			(candidate) => normaliseText(candidate.caption) === normaliseText(manufacturerName)
		);
		const collection =
			manufacturer === undefined
				? undefined
				: this.context.collections.find(
						(candidate) =>
							candidate.manufacturerId === manufacturer.id &&
							normaliseText(candidate.caption) === normaliseText(row.payload.collection)
					);
		if (!manufacturer || !collection) {
			return {
				outcome: 'needs_review',
				entityType: null,
				entityId: null,
				error: 'The manufacturer or collection for this row could not be found at commit.'
			};
		}

		const decorCode = text(row.payload.decor_code);
		const codeTaken = this.context.decors.some(
			(candidate) =>
				candidate.collectionId === collection.id &&
				normaliseText(candidate.decorCode) === normaliseText(decorCode)
		);
		if (codeTaken) {
			return {
				outcome: 'needs_review',
				entityType: null,
				entityId: null,
				error: 'A decor with that code already exists in this collection.'
			};
		}

		const caption = text(row.payload.caption);
		const matchId =
			this.context.decors.find(
				(candidate) => normaliseText(candidate.caption) === normaliseText(caption)
			)?.id ?? null;

		const thickness = text(row.payload.thickness_mm);
		const sheetLength = text(row.payload.sheet_length_mm);
		const sheetWidth = text(row.payload.sheet_width_mm);
		const visible = text(row.payload.customer_visible).toLowerCase();

		const record: DecorRecord = {
			id: newUuid(),
			tenantId: this.tenantId,
			collectionId: collection.id,
			caption,
			decorCode,
			textureSurface: null,
			colourFamily: pickEnum(
				row.payload.colour_family,
				DECOR_COLOUR_FAMILIES,
				null
			) as DecorColourFamily | null,
			materialType: (pickEnum(row.payload.material_type, DECOR_MATERIAL_TYPES, 'melamine_board') ??
				'melamine_board') as DecorMaterialType,
			core: (pickEnum(row.payload.core, DECOR_CORES, 'chipboard') ?? 'chipboard') as DecorCore,
			defaultThicknessMm: thickness.length > 0 ? Number(thickness) : 18,
			sheetSizeMm: {
				length: sheetLength.length > 0 ? Number(sheetLength) : 2800,
				width: sheetWidth.length > 0 ? Number(sheetWidth) : 2070
			},
			grainDirection: pickEnum(
				row.payload.grain_direction,
				GRAIN_DIRECTIONS,
				null
			) as GrainDirection | null,
			premiumTier: (pickEnum(row.payload.premium_tier, PREMIUM_TIERS, 'standard') ??
				'standard') as PremiumTier,
			status: 'active',
			customerVisible: visible.length === 0 || ['true', 'yes', '1'].includes(visible),
			sampleAssetId: null,
			createdAt: this.now,
			updatedAt: this.now
		};

		this.decors.push(record);
		this.context.decors.push({
			id: record.id,
			collectionId: record.collectionId,
			caption: record.caption,
			decorCode: record.decorCode
		});

		return {
			outcome: matchId ? 'needs_review' : 'imported',
			entityType: 'decor',
			entityId: record.id,
			error: null
		};
	}
}

/** Case-insensitive enum parse with a documented fallback. */
function pickEnum<T extends string>(
	value: string | undefined,
	allowed: readonly T[],
	fallback: T | null
): T | null {
	const candidate = (value ?? '').trim().toLowerCase();
	return (allowed as readonly string[]).includes(candidate) ? (candidate as T) : fallback;
}

function normaliseText(value: string | null | undefined): string {
	return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function fullAddress(property: {
	addressLine1: string;
	town: string | null;
	postcode: string | null;
}): string {
	return [property.addressLine1, property.town, property.postcode]
		.filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
		.join(', ');
}

function nextReferenceNumber(projects: readonly ProjectRecord[], tenantId: Uuid): string {
	let highest = 0;
	for (const project of projects) {
		if (project.tenantId !== tenantId) continue;
		const match = /(\d+)\s*$/.exec(project.reference.trim());
		if (match) highest = Math.max(highest, Number.parseInt(match[1], 10));
	}
	return String(highest + 1).padStart(4, '0');
}

/** Display-only reference, generated like the projects mock (phase-1 §9.3). */
function buildReference(
	tenant: TenantRecord | undefined,
	projects: readonly ProjectRecord[],
	tenantId: Uuid
): string {
	const year = String(new Date().getUTCFullYear());
	const number = nextReferenceNumber(projects, tenantId);
	const pattern = tenant?.referencePattern?.trim();
	if (!pattern) return `OIG-${year}-${number}`;

	let reference = pattern
		.replaceAll('{TENANT}', (tenant?.slug ?? 'OIG').toUpperCase())
		.replaceAll('{YYYY}', year)
		.replaceAll('{NNNN}', number);
	if (!pattern.includes('{NNNN}')) reference = `${reference}-${number}`;
	return reference;
}

export async function mockCommitImport(id: Uuid): Promise<ImportCommitResult> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.IMPORT_CREATE);
	const batch = findBatch(tenantId, id);

	if (batch.status !== 'staged') {
		throw conflict(`This import batch is ${batch.status}. Only staged batches can be committed.`);
	}

	const rows = getCollection<ImportRowRecord>(COLLECTIONS.importRows)
		.filter((row) => row.tenantId === tenantId && row.batchId === batch.id)
		.sort((first, second) => first.rowNo - second.rowNo || first.id.localeCompare(second.id));

	const tenant = getCollection<TenantRecord>(COLLECTIONS.tenants).find(
		(row) => row.id === tenantId
	);
	const now = nowIso();
	const committer = new Committer(
		tenantId,
		user.id,
		now,
		batch.kind,
		buildContext(tenantId),
		getCollection<ProjectRecord>(COLLECTIONS.projects).filter((row) => row.tenantId === tenantId),
		tenant
	);

	// Compute every write first; collections are only touched once the whole
	// batch has been decided (commit is atomic, phase-1 §5.3).
	for (const row of rows) committer.apply(row);

	const updatedBatch: ImportBatchRecord = {
		...batch,
		status: 'committed',
		importedRows: committer.imported,
		readyRows: 0,
		reviewRows: committer.held,
		rejectedRows: committer.rejected,
		updatedAt: now,
		committedAt: now
	};

	const updatedRows = rows.map((row) => {
		const outcome = committer.rows.get(row.id) ?? {
			outcome: row.validation === 'rejected' ? 'rejected' : ('needs_review' as ImportOutcome),
			entityType: null,
			entityId: null,
			error: row.error
		};
		return {
			...row,
			outcome: outcome.outcome,
			entityType: outcome.entityType,
			entityId: outcome.entityId,
			error: outcome.error
		} satisfies ImportRowRecord;
	});

	if (committer.customers.length > 0) {
		updateCollection<CustomerRecord>(COLLECTIONS.customers, (existing) => [
			...existing,
			...committer.customers
		]);
	}
	if (committer.properties.length > 0) {
		updateCollection<PropertyRecord>(COLLECTIONS.properties, (existing) => [
			...existing,
			...committer.properties
		]);
	}
	if (committer.projects.length > 0) {
		updateCollection<ProjectRecord>(COLLECTIONS.projects, (existing) => [
			...existing,
			...committer.projects
		]);
	}
	if (committer.suppliers.length > 0) {
		updateCollection<SupplierRecord>(COLLECTIONS.suppliers, (existing) => [
			...existing,
			...committer.suppliers
		]);
	}
	if (committer.decors.length > 0) {
		updateCollection<DecorRecord>(COLLECTIONS.decors, (existing) => [
			...existing,
			...committer.decors
		]);
	}
	updateCollection<ImportRowRecord>(COLLECTIONS.importRows, (existing) =>
		existing.map((row) => updatedRows.find((updated) => updated.id === row.id) ?? row)
	);
	updateCollection<ImportBatchRecord>(COLLECTIONS.importBatches, (existing) =>
		existing.map((row) => (row.id === updatedBatch.id ? updatedBatch : row))
	);

	recordTenantAudit({
		tenantId,
		action: 'import_commit',
		subjectType: SUBJECT_TYPE,
		subjectId: updatedBatch.id,
		payload: {
			imported: committer.imported,
			held: committer.held,
			rejected: committer.rejected
		}
	});

	// Master-data creates are audited individually as well as through the batch.
	for (const supplier of committer.suppliers) {
		recordTenantAudit({
			tenantId,
			action: 'create',
			subjectType: 'supplier',
			subjectId: supplier.id,
			payload: { source: 'import', batchId: updatedBatch.id }
		});
	}
	for (const decor of committer.decors) {
		recordTenantAudit({
			tenantId,
			action: 'create',
			subjectType: 'decor',
			subjectId: decor.id,
			payload: { source: 'import', batchId: updatedBatch.id }
		});
	}

	return {
		batch: toBatch(updatedBatch),
		created: committer.imported,
		held: committer.held,
		rejected: committer.rejected
	};
}

export async function mockListImportAudit(id: Uuid): Promise<AuditTrailRow[]> {
	const { tenantId } = requireTenantSession(PERMISSIONS.IMPORT_VIEW);
	const batch = findBatch(tenantId, id);
	return listTenantAudit(tenantId, SUBJECT_TYPE, batch.id);
}
