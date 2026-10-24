import type { ZodError } from 'zod';
import { recordTenantAudit } from '$shared/data/audit';
import { COLLECTIONS } from '$shared/data/collections';
import { demoNow } from '$shared/data/demo-clock';
import { requireTenantSession } from '$shared/data/mock-session';
import type {
	DecorAttributeRecord,
	DecorEdgingRecord,
	DecorRecord,
	DecorSupplierRecord,
	EdgingRecord,
	ManufacturerRecord,
	MaterialCollectionRecord,
	SupplierRecord
} from '$shared/data/records';
import { toPage } from '$shared/domain/pagination';
import { PERMISSIONS } from '$shared/domain/permissions';
import type { Uuid } from '$shared/domain/uuid';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, registerSeeder, updateCollection } from '$network/mock-backend';
import type {
	CreateCollectionInput,
	CreateDecorInput,
	CreateManufacturerInput,
	Decor,
	DecorAttribute,
	DecorAttributeInput,
	DecorCreateResult,
	DecorDetail,
	DecorDuplicateCandidate,
	DecorEdgingInput,
	DecorEdgingLink,
	DecorListParams,
	DecorListRow,
	DecorPage,
	DecorSort,
	DecorSupplierInput,
	DecorSupplierLink,
	Edging,
	EdgingInput,
	EdgingListParams,
	EdgingPage,
	Manufacturer,
	ManufacturerNode,
	MaterialCollection,
	Supplier,
	SupplierCreateResult,
	SupplierDetail,
	SupplierDuplicateCandidate,
	SupplierInput,
	SupplierLinkedDecor,
	SupplierListParams,
	SupplierPage,
	UpdateCollectionInput,
	UpdateDecorInput,
	UpdateManufacturerInput,
	UpdateSupplierInput
} from '../domain/types';
import {
	collectionFormSchema,
	collectionUpdateSchema,
	decorAttributeFormSchema,
	decorEdgingFormSchema,
	decorFormSchema,
	decorSampleAssetSchema,
	decorSupplierFormSchema,
	edgingFormSchema,
	fieldErrorsFrom,
	manufacturerFormSchema,
	normaliseCollectionInput,
	normaliseDecorAttributeInput,
	normaliseDecorEdgingInput,
	normaliseDecorInput,
	normaliseDecorSupplierInput,
	normaliseEdgingInput,
	normaliseManufacturerInput,
	normaliseSupplierInput,
	supplierFormSchema
} from '../domain/validations';
import { seedMaterials } from './seed';

/** The mock backend behaves like the server: every call is authorised first. */
registerSeeder(seedMaterials);

const SUBJECT = {
	manufacturer: 'manufacturer',
	collection: 'material_collection',
	decor: 'decor',
	edging: 'edging',
	supplier: 'supplier'
} as const;

const DECOR_SORTS: readonly DecorSort[] = ['caption', 'decorCode', 'manufacturer', 'updatedAt'];
const EDGING_SORTS = ['caption', 'edgingCode', 'updatedAt'] as const;
const SUPPLIER_SORTS = ['caption', 'leadTimeDays', 'updatedAt'] as const;

function notFound(message: string): ApiError {
	return new ApiError({ code: ApiErrorCode.NOT_FOUND, status: 404, message });
}

function conflict(message: string, details?: unknown): ApiError {
	return new ApiError({ code: ApiErrorCode.CONFLICT, status: 409, message, details });
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

function matches(value: string | null | undefined, needle: string): boolean {
	return typeof value === 'string' && value.toLowerCase().includes(needle);
}

function normaliseKey(value: string | null): string {
	return value === null ? '' : value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function compareText(first: string, second: string): number {
	return first.localeCompare(second, 'en-GB');
}

function writeAudit(
	tenantId: Uuid,
	subjectType: string,
	subjectId: Uuid,
	action: string,
	payload: Record<string, unknown> | null = null
): void {
	recordTenantAudit({ tenantId, action, subjectType, subjectId, payload });
}

/* ------------------------------------------------------------------ */
/* Record ↔ domain mapping.                                           */
/* ------------------------------------------------------------------ */

function toManufacturer(record: ManufacturerRecord): Manufacturer {
	return { ...record };
}

function toCollection(record: MaterialCollectionRecord): MaterialCollection {
	return { ...record };
}

function toDecor(record: DecorRecord): Decor {
	return { ...record, sheetSizeMm: { ...record.sheetSizeMm } };
}

function toEdging(record: EdgingRecord): Edging {
	return { ...record };
}

function toSupplier(record: SupplierRecord): Supplier {
	return { ...record };
}

function toAttribute(record: DecorAttributeRecord): DecorAttribute {
	return {
		id: record.id,
		decorId: record.decorId,
		attrName: record.attrName,
		attrValue: record.attrValue,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt
	};
}

/* ------------------------------------------------------------------ */
/* Lookups — tenant is always taken from the session.                 */
/* ------------------------------------------------------------------ */

function findManufacturer(tenantId: Uuid, id: Uuid): ManufacturerRecord {
	const record = getCollection<ManufacturerRecord>(COLLECTIONS.manufacturers).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!record) throw notFound('Manufacturer not found.');
	return record;
}

function findCollection(tenantId: Uuid, id: Uuid): MaterialCollectionRecord {
	const record = getCollection<MaterialCollectionRecord>(COLLECTIONS.materialCollections).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!record) throw notFound('Collection not found.');
	return record;
}

function findDecor(tenantId: Uuid, id: Uuid): DecorRecord {
	const record = getCollection<DecorRecord>(COLLECTIONS.decors).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!record) throw notFound('Decor not found.');
	return record;
}

function findEdging(tenantId: Uuid, id: Uuid): EdgingRecord {
	const record = getCollection<EdgingRecord>(COLLECTIONS.edgings).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!record) throw notFound('Edging not found.');
	return record;
}

function findSupplier(tenantId: Uuid, id: Uuid): SupplierRecord {
	const record = getCollection<SupplierRecord>(COLLECTIONS.suppliers).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!record) throw notFound('Supplier not found.');
	return record;
}

function replaceDecor(record: DecorRecord): void {
	updateCollection<DecorRecord>(COLLECTIONS.decors, (rows) =>
		rows.map((row) => (row.id === record.id ? record : row))
	);
}

function replaceEdging(record: EdgingRecord): void {
	updateCollection<EdgingRecord>(COLLECTIONS.edgings, (rows) =>
		rows.map((row) => (row.id === record.id ? record : row))
	);
}

function replaceSupplier(record: SupplierRecord): void {
	updateCollection<SupplierRecord>(COLLECTIONS.suppliers, (rows) =>
		rows.map((row) => (row.id === record.id ? record : row))
	);
}

function replaceManufacturer(record: ManufacturerRecord): void {
	updateCollection<ManufacturerRecord>(COLLECTIONS.manufacturers, (rows) =>
		rows.map((row) => (row.id === record.id ? record : row))
	);
}

function replaceCollection(record: MaterialCollectionRecord): void {
	updateCollection<MaterialCollectionRecord>(COLLECTIONS.materialCollections, (rows) =>
		rows.map((row) => (row.id === record.id ? record : row))
	);
}

/* ------------------------------------------------------------------ */
/* Decor list and detail.                                             */
/* ------------------------------------------------------------------ */

interface DecorEntry {
	decor: DecorRecord;
	collection: MaterialCollectionRecord;
	manufacturer: ManufacturerRecord;
}

/** Decors joined to their collection and manufacturer, scoped to a tenant. */
function decorEntries(tenantId: Uuid): DecorEntry[] {
	const collections = new Map(
		getCollection<MaterialCollectionRecord>(COLLECTIONS.materialCollections)
			.filter((row) => row.tenantId === tenantId)
			.map((row) => [row.id, row])
	);
	const manufacturers = new Map(
		getCollection<ManufacturerRecord>(COLLECTIONS.manufacturers)
			.filter((row) => row.tenantId === tenantId)
			.map((row) => [row.id, row])
	);

	const entries: DecorEntry[] = [];
	for (const decor of getCollection<DecorRecord>(COLLECTIONS.decors).filter(
		(row) => row.tenantId === tenantId
	)) {
		const collection = collections.get(decor.collectionId);
		if (!collection) continue;
		const manufacturer = manufacturers.get(collection.manufacturerId);
		if (!manufacturer) continue;
		entries.push({ decor, collection, manufacturer });
	}
	return entries;
}

function toDecorListRow(entry: DecorEntry): DecorListRow {
	return {
		id: entry.decor.id,
		caption: entry.decor.caption,
		decorCode: entry.decor.decorCode,
		manufacturerId: entry.manufacturer.id,
		manufacturerCaption: entry.manufacturer.caption,
		collectionId: entry.collection.id,
		collectionCaption: entry.collection.caption,
		colourFamily: entry.decor.colourFamily,
		materialType: entry.decor.materialType,
		premiumTier: entry.decor.premiumTier,
		status: entry.decor.status,
		customerVisible: entry.decor.customerVisible,
		updatedAt: entry.decor.updatedAt
	};
}

function compareDecorEntries(
	first: DecorEntry,
	second: DecorEntry,
	sort: DecorSort,
	sortDir: 'asc' | 'desc'
): number {
	let primary = 0;
	switch (sort) {
		case 'caption':
			primary = compareText(first.decor.caption, second.decor.caption);
			break;
		case 'decorCode':
			primary = compareText(first.decor.decorCode, second.decor.decorCode);
			break;
		case 'manufacturer':
			primary =
				compareText(first.manufacturer.caption, second.manufacturer.caption) ||
				compareText(first.collection.caption, second.collection.caption);
			break;
		case 'updatedAt':
		default:
			primary = first.decor.updatedAt.localeCompare(second.decor.updatedAt);
			break;
	}
	if (primary === 0) return first.decor.id.localeCompare(second.decor.id);
	return sortDir === 'asc' ? primary : -primary;
}

export async function mockListDecors(params: DecorListParams = {}): Promise<DecorPage> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_VIEW);

	const search = params.search?.trim().toLowerCase() ?? '';
	const manufacturerId = params.manufacturerId ?? 'all';
	const colourFamily = params.colourFamily ?? 'all';
	const materialType = params.materialType ?? 'all';
	const premiumTier = params.premiumTier ?? 'all';
	const status = params.status ?? 'all';
	const customerVisible = params.customerVisible ?? 'all';
	const sort: DecorSort = DECOR_SORTS.includes(params.sort ?? 'updatedAt')
		? (params.sort ?? 'updatedAt')
		: 'updatedAt';
	const sortDir = params.sortDir ?? (sort === 'updatedAt' ? 'desc' : 'asc');

	const rows = decorEntries(tenantId)
		.filter((entry) => manufacturerId === 'all' || entry.manufacturer.id === manufacturerId)
		.filter((entry) => colourFamily === 'all' || entry.decor.colourFamily === colourFamily)
		.filter((entry) => materialType === 'all' || entry.decor.materialType === materialType)
		.filter((entry) => premiumTier === 'all' || entry.decor.premiumTier === premiumTier)
		.filter((entry) => status === 'all' || entry.decor.status === status)
		.filter(
			(entry) =>
				customerVisible === 'all' ||
				(customerVisible === 'visible' && entry.decor.customerVisible) ||
				(customerVisible === 'hidden' && !entry.decor.customerVisible)
		)
		.filter(
			(entry) =>
				search.length === 0 ||
				matches(entry.decor.caption, search) ||
				matches(entry.decor.decorCode, search) ||
				matches(entry.manufacturer.caption, search) ||
				matches(entry.collection.caption, search)
		)
		.sort((first, second) => compareDecorEntries(first, second, sort, sortDir))
		.map(toDecorListRow);

	return toPage(rows, { page: params.page, pageSize: params.pageSize });
}

export async function mockGetDecor(id: Uuid): Promise<DecorDetail> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_VIEW);
	const decor = findDecor(tenantId, id);
	const collection = findCollection(tenantId, decor.collectionId);
	const manufacturer = findManufacturer(tenantId, collection.manufacturerId);

	const edgingsById = new Map(
		getCollection<EdgingRecord>(COLLECTIONS.edgings)
			.filter((row) => row.tenantId === tenantId)
			.map((row) => [row.id, row])
	);
	const edgings = getCollection<DecorEdgingRecord>(COLLECTIONS.decorEdgings)
		.filter((row) => row.tenantId === tenantId && row.decorId === decor.id)
		.map((row): DecorEdgingLink | null => {
			const edging = edgingsById.get(row.edgingId);
			if (!edging) return null;
			return {
				edgingId: row.edgingId,
				matchType: row.matchType,
				edging: toEdging(edging)
			};
		})
		.filter((row): row is DecorEdgingLink => row !== null)
		.sort((first, second) => compareText(first.edging.caption, second.edging.caption));

	const suppliersById = new Map(
		getCollection<SupplierRecord>(COLLECTIONS.suppliers)
			.filter((row) => row.tenantId === tenantId)
			.map((row) => [row.id, row])
	);
	const suppliers = getCollection<DecorSupplierRecord>(COLLECTIONS.decorSuppliers)
		.filter((row) => row.tenantId === tenantId && row.decorId === decor.id)
		.map((row): DecorSupplierLink | null => {
			const supplier = suppliersById.get(row.supplierId);
			if (!supplier) return null;
			return {
				supplierId: row.supplierId,
				supplierCode: row.supplierCode,
				isPrimary: row.isPrimary,
				altSupplierCode: row.altSupplierCode,
				supplier: toSupplier(supplier)
			};
		})
		.filter((row): row is DecorSupplierLink => row !== null)
		.sort(
			(first, second) =>
				Number(second.isPrimary) - Number(first.isPrimary) ||
				compareText(first.supplier.caption, second.supplier.caption)
		);

	const attributes = getCollection<DecorAttributeRecord>(COLLECTIONS.decorAttributes)
		.filter((row) => row.tenantId === tenantId && row.decorId === decor.id)
		.sort(
			(first, second) =>
				compareText(first.attrName, second.attrName) || first.id.localeCompare(second.id)
		)
		.map(toAttribute);

	return {
		decor: toDecor(decor),
		manufacturer: toManufacturer(manufacturer),
		collection: toCollection(collection),
		edgings,
		suppliers,
		attributes
	};
}

/* ------------------------------------------------------------------ */
/* Decor mutations.                                                   */
/* ------------------------------------------------------------------ */

function decorMatchReasons(caption: string, decorCode: string, row: DecorRecord): string[] {
	const reasons: string[] = [];
	if (normaliseKey(row.caption) === normaliseKey(caption)) reasons.push('Name matches');
	if (row.decorCode.toLowerCase() === decorCode.toLowerCase()) reasons.push('Code matches');
	return reasons;
}

function decorCandidates(
	tenantId: Uuid,
	caption: string,
	decorCode: string
): DecorDuplicateCandidate[] {
	const collections = new Map(
		getCollection<MaterialCollectionRecord>(COLLECTIONS.materialCollections)
			.filter((row) => row.tenantId === tenantId)
			.map((row) => [row.id, row])
	);

	return getCollection<DecorRecord>(COLLECTIONS.decors)
		.filter((row) => row.tenantId === tenantId)
		.map((row) => ({ row, matchReasons: decorMatchReasons(caption, decorCode, row) }))
		.filter((candidate) => candidate.matchReasons.length > 0)
		.sort(
			(first, second) =>
				first.row.createdAt.localeCompare(second.row.createdAt) ||
				first.row.id.localeCompare(second.row.id)
		)
		.map((candidate) => ({
			id: candidate.row.id,
			caption: candidate.row.caption,
			decorCode: candidate.row.decorCode,
			collectionCaption: collections.get(candidate.row.collectionId)?.caption ?? '',
			createdAt: candidate.row.createdAt,
			matchReasons: [...candidate.matchReasons]
		}));
}

function findDecorCodeConflict(
	tenantId: Uuid,
	collectionId: Uuid,
	decorCode: string,
	excludeId: Uuid | null = null
): DecorRecord | null {
	return (
		getCollection<DecorRecord>(COLLECTIONS.decors).find(
			(row) =>
				row.tenantId === tenantId &&
				row.collectionId === collectionId &&
				row.id !== excludeId &&
				row.decorCode.toLowerCase() === decorCode.toLowerCase()
		) ?? null
	);
}

function decorCodeConflict(existing: DecorRecord): ApiError {
	return conflict(
		`Decor code "${existing.decorCode}" already belongs to "${existing.caption}" in this collection.`,
		{ decorId: existing.id, caption: existing.caption, decorCode: existing.decorCode }
	);
}

export async function mockCreateDecor(input: CreateDecorInput): Promise<DecorCreateResult> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.MATERIALS_CREATE);
	const normalised = normaliseDecorInput(input);

	const parsed = decorFormSchema.safeParse({
		collectionId: normalised.collectionId ?? '',
		caption: normalised.caption ?? '',
		decorCode: normalised.decorCode ?? '',
		colourFamily: normalised.colourFamily ?? null,
		materialType: normalised.materialType,
		core: normalised.core,
		defaultThicknessMm: normalised.defaultThicknessMm,
		sheetSizeMm: normalised.sheetSizeMm,
		grainDirection: normalised.grainDirection ?? null,
		premiumTier: normalised.premiumTier ?? 'standard',
		status: normalised.status ?? 'active',
		customerVisible: normalised.customerVisible ?? true
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const values = parsed.data;
	const collection = getCollection<MaterialCollectionRecord>(COLLECTIONS.materialCollections).find(
		(row) => row.tenantId === tenantId && row.id === values.collectionId
	);
	if (!collection) {
		throw validation('Choose an existing collection.', {
			collectionId: 'Choose an existing collection.'
		});
	}

	const existing = findDecorCodeConflict(tenantId, values.collectionId, values.decorCode);
	if (existing) throw decorCodeConflict(existing);

	const candidates = decorCandidates(tenantId, values.caption, values.decorCode);
	const now = demoNow().toISOString();
	const record: DecorRecord = {
		id: newUuid(),
		tenantId,
		collectionId: values.collectionId,
		caption: values.caption,
		decorCode: values.decorCode,
		textureSurface: normalised.textureSurface ?? null,
		colourFamily: values.colourFamily,
		materialType: values.materialType,
		core: values.core,
		defaultThicknessMm: values.defaultThicknessMm,
		sheetSizeMm: { ...values.sheetSizeMm },
		grainDirection: values.grainDirection,
		premiumTier: values.premiumTier,
		status: values.status,
		customerVisible: values.customerVisible,
		sampleAssetId: null,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<DecorRecord>(COLLECTIONS.decors, (rows) => [...rows, record]);
	writeAudit(tenantId, SUBJECT.decor, record.id, 'create', {
		decorCode: record.decorCode,
		collectionId: record.collectionId,
		candidateIds: candidates.map((candidate) => candidate.id),
		createdBy: user.id
	});

	return { decor: toDecor(record), candidates };
}

export async function mockUpdateDecor(id: Uuid, input: UpdateDecorInput): Promise<Decor> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_UPDATE);
	const current = findDecor(tenantId, id);
	const patch = normaliseDecorInput(input);

	const parsed = decorFormSchema.safeParse({
		collectionId: patch.collectionId ?? current.collectionId,
		caption: patch.caption ?? current.caption,
		decorCode: patch.decorCode ?? current.decorCode,
		colourFamily: patch.colourFamily !== undefined ? patch.colourFamily : current.colourFamily,
		materialType: patch.materialType ?? current.materialType,
		core: patch.core ?? current.core,
		defaultThicknessMm: patch.defaultThicknessMm ?? current.defaultThicknessMm,
		sheetSizeMm: patch.sheetSizeMm ?? current.sheetSizeMm,
		grainDirection:
			patch.grainDirection !== undefined ? patch.grainDirection : current.grainDirection,
		premiumTier: patch.premiumTier ?? current.premiumTier,
		status: patch.status ?? current.status,
		customerVisible: patch.customerVisible ?? current.customerVisible
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const values = parsed.data;
	findCollection(tenantId, values.collectionId);
	const existing = findDecorCodeConflict(
		tenantId,
		values.collectionId,
		values.decorCode,
		current.id
	);
	if (existing) throw decorCodeConflict(existing);

	let sampleAssetId = current.sampleAssetId;
	if (input.sampleAssetId !== undefined) {
		const parsedAsset = decorSampleAssetSchema.safeParse(input.sampleAssetId);
		if (!parsedAsset.success) {
			throw validation('Choose a valid sample asset.', {
				sampleAssetId: 'Choose a valid sample asset.'
			});
		}
		sampleAssetId = parsedAsset.data;
	}

	const textureSurface =
		patch.textureSurface !== undefined ? patch.textureSurface : current.textureSurface;

	const updated: DecorRecord = {
		...current,
		...values,
		textureSurface,
		sheetSizeMm: { ...values.sheetSizeMm },
		sampleAssetId,
		updatedAt: demoNow().toISOString()
	};

	const changedFields: string[] = [];
	if (values.collectionId !== current.collectionId) changedFields.push('collectionId');
	if (values.caption !== current.caption) changedFields.push('caption');
	if (values.decorCode !== current.decorCode) changedFields.push('decorCode');
	if (textureSurface !== current.textureSurface) changedFields.push('textureSurface');
	if (values.colourFamily !== current.colourFamily) changedFields.push('colourFamily');
	if (values.materialType !== current.materialType) changedFields.push('materialType');
	if (values.core !== current.core) changedFields.push('core');
	if (values.defaultThicknessMm !== current.defaultThicknessMm) {
		changedFields.push('defaultThicknessMm');
	}
	if (
		values.sheetSizeMm.length !== current.sheetSizeMm.length ||
		values.sheetSizeMm.width !== current.sheetSizeMm.width
	) {
		changedFields.push('sheetSizeMm');
	}
	if (values.grainDirection !== current.grainDirection) changedFields.push('grainDirection');
	if (values.premiumTier !== current.premiumTier) changedFields.push('premiumTier');
	if (values.status !== current.status) changedFields.push('status');
	if (values.customerVisible !== current.customerVisible) changedFields.push('customerVisible');
	if (sampleAssetId !== current.sampleAssetId) changedFields.push('sampleAssetId');

	if (changedFields.length === 0) return toDecor(current);

	replaceDecor(updated);
	writeAudit(tenantId, SUBJECT.decor, updated.id, 'update', { changedFields });

	if (values.status !== current.status) {
		writeAudit(
			tenantId,
			SUBJECT.decor,
			updated.id,
			values.status === 'discontinued' ? 'deactivate' : 'activate',
			{ previousStatus: current.status, newStatus: values.status }
		);
	}

	return toDecor(updated);
}

/* ------------------------------------------------------------------ */
/* Edgings.                                                           */
/* ------------------------------------------------------------------ */

export async function mockListEdgings(params: EdgingListParams = {}): Promise<EdgingPage> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_VIEW);

	const search = params.search?.trim().toLowerCase() ?? '';
	const active = params.active ?? 'all';
	const sort = EDGING_SORTS.includes(params.sort ?? 'caption')
		? (params.sort ?? 'caption')
		: 'caption';
	const sortDir = params.sortDir ?? (sort === 'updatedAt' ? 'desc' : 'asc');

	const rows = getCollection<EdgingRecord>(COLLECTIONS.edgings)
		.filter((row) => row.tenantId === tenantId)
		.filter(
			(row) =>
				active === 'all' ||
				(active === 'active' && row.active) ||
				(active === 'inactive' && !row.active)
		)
		.filter(
			(row) =>
				search.length === 0 ||
				matches(row.caption, search) ||
				matches(row.edgingCode, search) ||
				matches(row.materialType, search)
		)
		.sort((first, second) => {
			let primary = 0;
			if (sort === 'edgingCode') primary = compareText(first.edgingCode, second.edgingCode);
			else if (sort === 'updatedAt') primary = first.updatedAt.localeCompare(second.updatedAt);
			else primary = compareText(first.caption, second.caption);
			const result = primary || first.id.localeCompare(second.id);
			return sortDir === 'asc' ? result : -result;
		})
		.map(toEdging);

	return toPage(rows, { page: params.page, pageSize: params.pageSize });
}

export async function mockCreateEdging(input: EdgingInput): Promise<Edging> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_CREATE);
	const normalised = normaliseEdgingInput(input);

	const parsed = edgingFormSchema.safeParse({
		caption: normalised.caption ?? '',
		edgingCode: normalised.edgingCode ?? '',
		materialType: normalised.materialType ?? '',
		thicknessMm: normalised.thicknessMm,
		colourFamily: normalised.colourFamily ?? null,
		active: normalised.active ?? true
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const now = demoNow().toISOString();
	const record: EdgingRecord = {
		id: newUuid(),
		tenantId,
		caption: parsed.data.caption,
		edgingCode: parsed.data.edgingCode,
		materialType: parsed.data.materialType,
		thicknessMm: parsed.data.thicknessMm,
		colourFamily: parsed.data.colourFamily,
		active: parsed.data.active,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<EdgingRecord>(COLLECTIONS.edgings, (rows) => [...rows, record]);
	writeAudit(tenantId, SUBJECT.edging, record.id, 'create', {
		edgingCode: record.edgingCode
	});

	return toEdging(record);
}

export async function mockUpdateEdging(id: Uuid, input: Partial<EdgingInput>): Promise<Edging> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_UPDATE);
	const current = findEdging(tenantId, id);
	const patch = normaliseEdgingInput(input);

	const parsed = edgingFormSchema.safeParse({
		caption: patch.caption ?? current.caption,
		edgingCode: patch.edgingCode ?? current.edgingCode,
		materialType: patch.materialType ?? current.materialType,
		thicknessMm: patch.thicknessMm ?? current.thicknessMm,
		colourFamily: patch.colourFamily !== undefined ? patch.colourFamily : current.colourFamily,
		active: patch.active ?? current.active
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const values = parsed.data;
	const changedFields: string[] = [];
	if (values.caption !== current.caption) changedFields.push('caption');
	if (values.edgingCode !== current.edgingCode) changedFields.push('edgingCode');
	if (values.materialType !== current.materialType) changedFields.push('materialType');
	if (values.thicknessMm !== current.thicknessMm) changedFields.push('thicknessMm');
	if (values.colourFamily !== current.colourFamily) changedFields.push('colourFamily');
	if (values.active !== current.active) changedFields.push('active');

	if (changedFields.length === 0) return toEdging(current);

	const updated: EdgingRecord = {
		...current,
		...values,
		updatedAt: demoNow().toISOString()
	};
	replaceEdging(updated);
	writeAudit(tenantId, SUBJECT.edging, updated.id, 'update', { changedFields });

	if (values.active !== current.active) {
		writeAudit(tenantId, SUBJECT.edging, updated.id, values.active ? 'activate' : 'deactivate', {
			previousActive: current.active,
			active: values.active
		});
	}

	return toEdging(updated);
}

export async function mockLinkEdging(
	decorId: Uuid,
	input: DecorEdgingInput
): Promise<DecorEdgingLink> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_UPDATE);
	const decor = findDecor(tenantId, decorId);

	const normalised = normaliseDecorEdgingInput(input);
	const parsed = decorEdgingFormSchema.safeParse({
		edgingId: normalised.edgingId ?? '',
		matchType: normalised.matchType
	});
	if (!parsed.success) throw mapZodError(parsed.error);
	const edging = findEdging(tenantId, parsed.data.edgingId);

	const existing = getCollection<DecorEdgingRecord>(COLLECTIONS.decorEdgings).find(
		(row) => row.tenantId === tenantId && row.decorId === decor.id && row.edgingId === edging.id
	);
	const now = demoNow().toISOString();
	const record: DecorEdgingRecord = existing
		? { ...existing, matchType: parsed.data.matchType }
		: {
				id: newUuid(),
				tenantId,
				decorId: decor.id,
				edgingId: edging.id,
				matchType: parsed.data.matchType,
				createdAt: now
			};

	updateCollection<DecorEdgingRecord>(COLLECTIONS.decorEdgings, (rows) =>
		existing ? rows.map((row) => (row.id === record.id ? record : row)) : [...rows, record]
	);
	writeAudit(tenantId, SUBJECT.decor, decor.id, 'link', {
		edgingId: edging.id,
		matchType: record.matchType,
		updated: Boolean(existing)
	});

	return {
		edgingId: record.edgingId,
		matchType: record.matchType,
		edging: toEdging(edging)
	};
}

export async function mockUnlinkEdging(decorId: Uuid, edgingId: Uuid): Promise<void> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_UPDATE);
	const decor = findDecor(tenantId, decorId);
	findEdging(tenantId, edgingId);

	const existing = getCollection<DecorEdgingRecord>(COLLECTIONS.decorEdgings).find(
		(row) => row.tenantId === tenantId && row.decorId === decor.id && row.edgingId === edgingId
	);
	if (!existing) throw notFound('Edging link not found.');

	updateCollection<DecorEdgingRecord>(COLLECTIONS.decorEdgings, (rows) =>
		rows.filter((row) => row.id !== existing.id)
	);
	writeAudit(tenantId, SUBJECT.decor, decor.id, 'unlink', { edgingId });
}

/* ------------------------------------------------------------------ */
/* Suppliers.                                                         */
/* ------------------------------------------------------------------ */

function supplierMatchReasons(
	fields: { caption: string; contact: string | null },
	row: SupplierRecord
): string[] {
	const reasons: string[] = [];
	if (normaliseKey(row.caption) === normaliseKey(fields.caption)) reasons.push('Name matches');
	if (fields.contact !== null && normaliseKey(row.contact) === normaliseKey(fields.contact)) {
		reasons.push('Contact matches');
	}
	return reasons;
}

function supplierCandidates(
	tenantId: Uuid,
	caption: string,
	contact: string | null
): SupplierDuplicateCandidate[] {
	return getCollection<SupplierRecord>(COLLECTIONS.suppliers)
		.filter((row) => row.tenantId === tenantId)
		.map((row) => ({ row, matchReasons: supplierMatchReasons({ caption, contact }, row) }))
		.filter((candidate) => candidate.matchReasons.length > 0)
		.sort(
			(first, second) =>
				first.row.createdAt.localeCompare(second.row.createdAt) ||
				first.row.id.localeCompare(second.row.id)
		)
		.map((candidate) => ({
			id: candidate.row.id,
			caption: candidate.row.caption,
			contact: candidate.row.contact,
			createdAt: candidate.row.createdAt,
			matchReasons: [...candidate.matchReasons]
		}));
}

export async function mockListSuppliers(params: SupplierListParams = {}): Promise<SupplierPage> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_VIEW);

	const search = params.search?.trim().toLowerCase() ?? '';
	const active = params.active ?? 'all';
	const sort = SUPPLIER_SORTS.includes(params.sort ?? 'caption')
		? (params.sort ?? 'caption')
		: 'caption';
	const sortDir = params.sortDir ?? (sort === 'updatedAt' ? 'desc' : 'asc');

	const rows = getCollection<SupplierRecord>(COLLECTIONS.suppliers)
		.filter((row) => row.tenantId === tenantId)
		.filter(
			(row) =>
				active === 'all' ||
				(active === 'active' && row.active) ||
				(active === 'inactive' && !row.active)
		)
		.filter(
			(row) => search.length === 0 || matches(row.caption, search) || matches(row.contact, search)
		)
		.sort((first, second) => {
			let primary = 0;
			if (sort === 'leadTimeDays') {
				primary =
					(first.leadTimeDays ?? Number.MAX_SAFE_INTEGER) -
					(second.leadTimeDays ?? Number.MAX_SAFE_INTEGER);
			} else if (sort === 'updatedAt') primary = first.updatedAt.localeCompare(second.updatedAt);
			else primary = compareText(first.caption, second.caption);
			const result = primary || first.id.localeCompare(second.id);
			return sortDir === 'asc' ? result : -result;
		})
		.map(toSupplier);

	return toPage(rows, { page: params.page, pageSize: params.pageSize });
}

export async function mockGetSupplier(id: Uuid): Promise<SupplierDetail> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_VIEW);
	const supplier = findSupplier(tenantId, id);

	const decors = decorEntries(tenantId);
	const links = getCollection<DecorSupplierRecord>(COLLECTIONS.decorSuppliers).filter(
		(row) => row.tenantId === tenantId && row.supplierId === supplier.id
	);

	const linkedDecors: SupplierLinkedDecor[] = links
		.map((link): SupplierLinkedDecor | null => {
			const entry = decors.find((candidate) => candidate.decor.id === link.decorId);
			if (!entry) return null;
			return {
				decorId: entry.decor.id,
				caption: entry.decor.caption,
				decorCode: entry.decor.decorCode,
				manufacturerCaption: entry.manufacturer.caption,
				collectionCaption: entry.collection.caption,
				supplierCode: link.supplierCode,
				isPrimary: link.isPrimary,
				altSupplierCode: link.altSupplierCode
			};
		})
		.filter((row): row is SupplierLinkedDecor => row !== null)
		.sort(
			(first, second) =>
				compareText(first.manufacturerCaption, second.manufacturerCaption) ||
				compareText(first.collectionCaption, second.collectionCaption) ||
				compareText(first.caption, second.caption)
		);

	return { supplier: toSupplier(supplier), decors: linkedDecors };
}

export async function mockCreateSupplier(input: SupplierInput): Promise<SupplierCreateResult> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_CREATE);
	const normalised = normaliseSupplierInput(input);

	const parsed = supplierFormSchema.safeParse({
		caption: normalised.caption ?? '',
		contact: normalised.contact ?? null,
		leadTimeDays: normalised.leadTimeDays ?? null
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const candidates = supplierCandidates(tenantId, parsed.data.caption, parsed.data.contact);
	const now = demoNow().toISOString();
	const record: SupplierRecord = {
		id: newUuid(),
		tenantId,
		caption: parsed.data.caption,
		contact: parsed.data.contact,
		leadTimeDays: parsed.data.leadTimeDays,
		active: true,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<SupplierRecord>(COLLECTIONS.suppliers, (rows) => [...rows, record]);
	writeAudit(tenantId, SUBJECT.supplier, record.id, 'create', {
		candidateIds: candidates.map((candidate) => candidate.id)
	});

	return { supplier: toSupplier(record), candidates };
}

export async function mockUpdateSupplier(id: Uuid, input: UpdateSupplierInput): Promise<Supplier> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_UPDATE);
	const current = findSupplier(tenantId, id);
	const patch = normaliseSupplierInput(input);

	const parsed = supplierFormSchema.safeParse({
		caption: patch.caption ?? current.caption,
		contact: patch.contact !== undefined ? patch.contact : current.contact,
		leadTimeDays: patch.leadTimeDays !== undefined ? patch.leadTimeDays : current.leadTimeDays
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const active = patch.active ?? current.active;
	const changedFields: string[] = [];
	if (parsed.data.caption !== current.caption) changedFields.push('caption');
	if (parsed.data.contact !== current.contact) changedFields.push('contact');
	if (parsed.data.leadTimeDays !== current.leadTimeDays) changedFields.push('leadTimeDays');
	if (active !== current.active) changedFields.push('active');

	if (changedFields.length === 0) return toSupplier(current);

	const updated: SupplierRecord = {
		...current,
		caption: parsed.data.caption,
		contact: parsed.data.contact,
		leadTimeDays: parsed.data.leadTimeDays,
		active,
		updatedAt: demoNow().toISOString()
	};
	replaceSupplier(updated);
	writeAudit(tenantId, SUBJECT.supplier, updated.id, 'update', { changedFields });

	if (active !== current.active) {
		writeAudit(tenantId, SUBJECT.supplier, updated.id, active ? 'activate' : 'deactivate', {
			previousActive: current.active,
			active
		});
	}

	return toSupplier(updated);
}

export async function mockLinkSupplier(
	decorId: Uuid,
	input: DecorSupplierInput
): Promise<DecorSupplierLink> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_UPDATE);
	const decor = findDecor(tenantId, decorId);

	const normalised = normaliseDecorSupplierInput(input);
	const parsed = decorSupplierFormSchema.safeParse({
		supplierId: normalised.supplierId ?? '',
		supplierCode: normalised.supplierCode ?? '',
		isPrimary: normalised.isPrimary,
		altSupplierCode: normalised.altSupplierCode ?? null
	});
	if (!parsed.success) throw mapZodError(parsed.error);
	const supplier = findSupplier(tenantId, parsed.data.supplierId);
	const values = parsed.data;

	if (values.isPrimary) {
		const existingPrimary = getCollection<DecorSupplierRecord>(COLLECTIONS.decorSuppliers).find(
			(row) =>
				row.tenantId === tenantId &&
				row.decorId === decor.id &&
				row.isPrimary &&
				row.supplierId !== supplier.id
		);
		if (existingPrimary) {
			const primarySupplier = getCollection<SupplierRecord>(COLLECTIONS.suppliers).find(
				(row) => row.tenantId === tenantId && row.id === existingPrimary.supplierId
			);
			const caption = primarySupplier?.caption ?? 'another supplier';
			throw conflict(
				`This decor already has a primary supplier: ${caption}. Remove its primary flag before setting another.`,
				{ supplierId: existingPrimary.supplierId, caption }
			);
		}
	}

	const existing = getCollection<DecorSupplierRecord>(COLLECTIONS.decorSuppliers).find(
		(row) => row.tenantId === tenantId && row.decorId === decor.id && row.supplierId === supplier.id
	);
	const now = demoNow().toISOString();
	const record: DecorSupplierRecord = existing
		? {
				...existing,
				supplierCode: values.supplierCode,
				isPrimary: values.isPrimary,
				altSupplierCode: values.altSupplierCode,
				updatedAt: now
			}
		: {
				id: newUuid(),
				tenantId,
				decorId: decor.id,
				supplierId: supplier.id,
				supplierCode: values.supplierCode,
				isPrimary: values.isPrimary,
				altSupplierCode: values.altSupplierCode,
				createdAt: now,
				updatedAt: now
			};

	updateCollection<DecorSupplierRecord>(COLLECTIONS.decorSuppliers, (rows) =>
		existing ? rows.map((row) => (row.id === record.id ? record : row)) : [...rows, record]
	);
	writeAudit(tenantId, SUBJECT.decor, decor.id, existing ? 'update' : 'link', {
		supplierId: supplier.id,
		supplierCode: record.supplierCode,
		isPrimary: record.isPrimary
	});

	return {
		supplierId: record.supplierId,
		supplierCode: record.supplierCode,
		isPrimary: record.isPrimary,
		altSupplierCode: record.altSupplierCode,
		supplier: toSupplier(supplier)
	};
}

export async function mockUnlinkSupplier(decorId: Uuid, supplierId: Uuid): Promise<void> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_UPDATE);
	const decor = findDecor(tenantId, decorId);
	findSupplier(tenantId, supplierId);

	const existing = getCollection<DecorSupplierRecord>(COLLECTIONS.decorSuppliers).find(
		(row) => row.tenantId === tenantId && row.decorId === decor.id && row.supplierId === supplierId
	);
	if (!existing) throw notFound('Supplier link not found.');

	updateCollection<DecorSupplierRecord>(COLLECTIONS.decorSuppliers, (rows) =>
		rows.filter((row) => row.id !== existing.id)
	);
	writeAudit(tenantId, SUBJECT.decor, decor.id, 'unlink', { supplierId });
}

/* ------------------------------------------------------------------ */
/* Attributes.                                                        */
/* ------------------------------------------------------------------ */

export async function mockUpsertAttribute(
	decorId: Uuid,
	input: DecorAttributeInput
): Promise<DecorAttribute> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_UPDATE);
	const decor = findDecor(tenantId, decorId);
	const normalised = normaliseDecorAttributeInput(input);

	const parsed = decorAttributeFormSchema.safeParse({
		attrName: normalised.attrName ?? '',
		attrValue: normalised.attrValue ?? ''
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const existing = getCollection<DecorAttributeRecord>(COLLECTIONS.decorAttributes).find(
		(row) =>
			row.tenantId === tenantId &&
			row.decorId === decor.id &&
			normaliseKey(row.attrName) === normaliseKey(parsed.data.attrName)
	);
	const now = demoNow().toISOString();
	const record: DecorAttributeRecord = existing
		? {
				...existing,
				attrName: parsed.data.attrName,
				attrValue: parsed.data.attrValue,
				updatedAt: now
			}
		: {
				id: newUuid(),
				tenantId,
				decorId: decor.id,
				attrName: parsed.data.attrName,
				attrValue: parsed.data.attrValue,
				createdAt: now,
				updatedAt: now
			};

	updateCollection<DecorAttributeRecord>(COLLECTIONS.decorAttributes, (rows) =>
		existing ? rows.map((row) => (row.id === record.id ? record : row)) : [...rows, record]
	);
	writeAudit(tenantId, SUBJECT.decor, decor.id, existing ? 'update' : 'create', {
		attrName: record.attrName
	});

	return toAttribute(record);
}

export async function mockRemoveAttribute(decorId: Uuid, attrName: string): Promise<void> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_UPDATE);
	const decor = findDecor(tenantId, decorId);

	const existing = getCollection<DecorAttributeRecord>(COLLECTIONS.decorAttributes).find(
		(row) =>
			row.tenantId === tenantId &&
			row.decorId === decor.id &&
			normaliseKey(row.attrName) === normaliseKey(attrName)
	);
	if (!existing) throw notFound('Attribute not found.');

	updateCollection<DecorAttributeRecord>(COLLECTIONS.decorAttributes, (rows) =>
		rows.filter((row) => row.id !== existing.id)
	);
	writeAudit(tenantId, SUBJECT.decor, decor.id, 'remove', { attrName: existing.attrName });
}

/* ------------------------------------------------------------------ */
/* Manufacturers and collections.                                     */
/* ------------------------------------------------------------------ */

export async function mockListManufacturers(): Promise<ManufacturerNode[]> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_VIEW);

	const decors = getCollection<DecorRecord>(COLLECTIONS.decors).filter(
		(row) => row.tenantId === tenantId
	);
	const collections = getCollection<MaterialCollectionRecord>(
		COLLECTIONS.materialCollections
	).filter((row) => row.tenantId === tenantId);

	const nodes: ManufacturerNode[] = getCollection<ManufacturerRecord>(COLLECTIONS.manufacturers)
		.filter((row) => row.tenantId === tenantId)
		.sort(
			(first, second) =>
				compareText(first.caption, second.caption) || first.id.localeCompare(second.id)
		)
		.map((manufacturer) => ({
			manufacturer: toManufacturer(manufacturer),
			collections: collections
				.filter((collection) => collection.manufacturerId === manufacturer.id)
				.sort(
					(first, second) =>
						compareText(first.caption, second.caption) || first.id.localeCompare(second.id)
				)
				.map((collection) => ({
					collection: toCollection(collection),
					decorCount: decors.filter((decor) => decor.collectionId === collection.id).length
				}))
		}));

	return nodes;
}

export async function mockCreateManufacturer(
	input: CreateManufacturerInput
): Promise<Manufacturer> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_CREATE);
	const normalised = normaliseManufacturerInput(input);

	const parsed = manufacturerFormSchema.safeParse({
		caption: normalised.caption ?? '',
		country: normalised.country ?? null,
		website: normalised.website ?? null
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const now = demoNow().toISOString();
	const record: ManufacturerRecord = {
		id: newUuid(),
		tenantId,
		caption: parsed.data.caption,
		country: parsed.data.country,
		website: parsed.data.website,
		active: true,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<ManufacturerRecord>(COLLECTIONS.manufacturers, (rows) => [...rows, record]);
	writeAudit(tenantId, SUBJECT.manufacturer, record.id, 'create', {
		caption: record.caption
	});

	return toManufacturer(record);
}

export async function mockUpdateManufacturer(
	id: Uuid,
	input: UpdateManufacturerInput
): Promise<Manufacturer> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_UPDATE);
	const current = findManufacturer(tenantId, id);
	const patch = normaliseManufacturerInput(input);

	const parsed = manufacturerFormSchema.safeParse({
		caption: patch.caption ?? current.caption,
		country: patch.country !== undefined ? patch.country : current.country,
		website: patch.website !== undefined ? patch.website : current.website
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const active = patch.active ?? current.active;
	const changedFields: string[] = [];
	if (parsed.data.caption !== current.caption) changedFields.push('caption');
	if (parsed.data.country !== current.country) changedFields.push('country');
	if (parsed.data.website !== current.website) changedFields.push('website');
	if (active !== current.active) changedFields.push('active');

	if (changedFields.length === 0) return toManufacturer(current);

	const updated: ManufacturerRecord = {
		...current,
		caption: parsed.data.caption,
		country: parsed.data.country,
		website: parsed.data.website,
		active,
		updatedAt: demoNow().toISOString()
	};
	replaceManufacturer(updated);
	writeAudit(tenantId, SUBJECT.manufacturer, updated.id, 'update', { changedFields });

	if (active !== current.active) {
		writeAudit(tenantId, SUBJECT.manufacturer, updated.id, active ? 'activate' : 'deactivate', {
			previousActive: current.active,
			active
		});
	}

	return toManufacturer(updated);
}

function collectionCaptionConflict(
	tenantId: Uuid,
	manufacturerId: Uuid,
	caption: string,
	excludeId: Uuid | null = null
): MaterialCollectionRecord | null {
	return (
		getCollection<MaterialCollectionRecord>(COLLECTIONS.materialCollections).find(
			(row) =>
				row.tenantId === tenantId &&
				row.manufacturerId === manufacturerId &&
				row.id !== excludeId &&
				normaliseKey(row.caption) === normaliseKey(caption)
		) ?? null
	);
}

export async function mockCreateCollection(
	input: CreateCollectionInput
): Promise<MaterialCollection> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_CREATE);
	const normalised = normaliseCollectionInput(input);

	const parsed = collectionFormSchema.safeParse({
		manufacturerId: normalised.manufacturerId ?? '',
		caption: normalised.caption ?? ''
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const manufacturer = findManufacturer(tenantId, parsed.data.manufacturerId);
	const existing = collectionCaptionConflict(tenantId, manufacturer.id, parsed.data.caption);
	if (existing) {
		throw conflict(
			`A collection named "${existing.caption}" already exists for this manufacturer.`,
			{ collectionId: existing.id, caption: existing.caption }
		);
	}

	const now = demoNow().toISOString();
	const record: MaterialCollectionRecord = {
		id: newUuid(),
		tenantId,
		manufacturerId: manufacturer.id,
		caption: parsed.data.caption,
		active: true,
		createdAt: now,
		updatedAt: now
	};

	updateCollection<MaterialCollectionRecord>(COLLECTIONS.materialCollections, (rows) => [
		...rows,
		record
	]);
	writeAudit(tenantId, SUBJECT.collection, record.id, 'create', {
		caption: record.caption,
		manufacturerId: record.manufacturerId
	});

	return toCollection(record);
}

export async function mockUpdateCollection(
	id: Uuid,
	input: UpdateCollectionInput
): Promise<MaterialCollection> {
	const { tenantId } = requireTenantSession(PERMISSIONS.MATERIALS_UPDATE);
	const current = findCollection(tenantId, id);
	const patch = normaliseCollectionInput(input);

	const parsed = collectionUpdateSchema.safeParse({
		caption: patch.caption ?? current.caption,
		active: patch.active ?? current.active
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const existing = collectionCaptionConflict(
		tenantId,
		current.manufacturerId,
		parsed.data.caption,
		current.id
	);
	if (existing) {
		throw conflict(
			`A collection named "${existing.caption}" already exists for this manufacturer.`,
			{ collectionId: existing.id, caption: existing.caption }
		);
	}

	const changedFields: string[] = [];
	if (parsed.data.caption !== current.caption) changedFields.push('caption');
	if (parsed.data.active !== current.active) changedFields.push('active');
	if (changedFields.length === 0) return toCollection(current);

	const updated: MaterialCollectionRecord = {
		...current,
		caption: parsed.data.caption,
		active: parsed.data.active,
		updatedAt: demoNow().toISOString()
	};
	replaceCollection(updated);
	writeAudit(tenantId, SUBJECT.collection, updated.id, 'update', { changedFields });

	if (parsed.data.active !== current.active) {
		writeAudit(
			tenantId,
			SUBJECT.collection,
			updated.id,
			parsed.data.active ? 'activate' : 'deactivate',
			{ previousActive: current.active, active: parsed.data.active }
		);
	}

	return toCollection(updated);
}
