import { z } from 'zod';
import {
	DECOR_COLOUR_FAMILIES,
	DECOR_CORES,
	DECOR_MATERIAL_TYPES,
	EDGING_MATCH_TYPES,
	GRAIN_DIRECTIONS,
	MATERIAL_STATUSES,
	PREMIUM_TIERS
} from '$shared/domain/record-states';
import type {
	CreateDecorInput,
	CreateManufacturerInput,
	DecorAttributeInput,
	DecorEdgingInput,
	DecorSupplierInput,
	EdgingInput,
	SupplierInput,
	UpdateCollectionInput,
	UpdateDecorInput,
	UpdateManufacturerInput,
	UpdateSupplierInput
} from './types';

/**
 * Materials master-data schemas plus the normalisers shared by the mock
 * repository and the UI.
 *
 * Captions and codes are collapsed before validation (R4), optional blanks
 * become `null` so they never reach storage as `''`, and every message is a
 * user-readable sentence (DESIGN §12.5). No price field exists here: pricing
 * belongs to costing in Phase 5 (phase-3 §9.8).
 */

/** An empty form field means "not provided"; it never reaches the server as `''`. */
function blankToNull(value: unknown): unknown {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function optionalText(max: number, message: string) {
	return z.preprocess(blankToNull, z.string().trim().max(max, message).nullable());
}

/** Website values are "URL-ish": a scheme is optional, a dot is required. */
function isWebsiteAddress(value: string): boolean {
	if (/\s/.test(value) || value.length < 3) return false;
	const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
	try {
		const parsed = new URL(candidate);
		return parsed.hostname.includes('.');
	} catch {
		return false;
	}
}

const websiteSchema = z.preprocess(
	blankToNull,
	z
		.string()
		.trim()
		.max(200, 'Keep the website to 200 characters or fewer.')
		.refine(isWebsiteAddress, 'Enter a valid website address.')
		.nullable()
);

function positiveNumber(message: string) {
	return z.number({ error: message }).finite(message).positive(message);
}

function collapseText(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

function collapseOrNull(value: string | null): string | null {
	if (value === null) return null;
	const collapsed = collapseText(value);
	return collapsed.length > 0 ? collapsed : null;
}

function trimOrNull(value: string | null): string | null {
	if (value === null) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/* ------------------------------------------------------------------ */
/* Manufacturer and collection.                                       */
/* ------------------------------------------------------------------ */

export const manufacturerFormSchema = z.object({
	caption: z
		.string()
		.trim()
		.min(1, 'Enter a manufacturer caption.')
		.max(200, 'Keep the caption to 200 characters or fewer.')
		.transform(collapseText),
	country: optionalText(100, 'Keep the country to 100 characters or fewer.'),
	website: websiteSchema
});

export type ManufacturerFormValues = z.infer<typeof manufacturerFormSchema>;

export type ManufacturerInputDraft = Partial<
	Pick<CreateManufacturerInput, 'caption' | 'country' | 'website'> &
		Pick<UpdateManufacturerInput, 'active'>
>;

export function normaliseManufacturerInput(input: ManufacturerInputDraft): ManufacturerInputDraft {
	const result: ManufacturerInputDraft = {};
	if (input.caption !== undefined) result.caption = collapseText(input.caption);
	if (input.country !== undefined) result.country = collapseOrNull(input.country);
	if (input.website !== undefined) result.website = trimOrNull(input.website);
	if (input.active !== undefined) result.active = input.active;
	return result;
}

export const collectionCaptionSchema = z
	.string()
	.trim()
	.min(1, 'Enter a collection caption.')
	.max(200, 'Keep the caption to 200 characters or fewer.')
	.transform(collapseText);

export const collectionFormSchema = z.object({
	manufacturerId: z.string().uuid('Choose a manufacturer.'),
	caption: collectionCaptionSchema
});

export const collectionUpdateSchema = z.object({
	caption: collectionCaptionSchema,
	active: z.boolean()
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

export type CollectionInputDraft = Partial<
	Pick<CollectionFormValues, 'manufacturerId' | 'caption'> & Pick<UpdateCollectionInput, 'active'>
>;

export function normaliseCollectionInput(input: CollectionInputDraft): CollectionInputDraft {
	const result: CollectionInputDraft = {};
	if (input.manufacturerId !== undefined) result.manufacturerId = input.manufacturerId;
	if (input.caption !== undefined) result.caption = collapseText(input.caption);
	if (input.active !== undefined) result.active = input.active;
	return result;
}

/* ------------------------------------------------------------------ */
/* Decor.                                                             */
/* ------------------------------------------------------------------ */

export const decorSheetSizeSchema = z.object({
	length: positiveNumber('Enter a sheet length greater than 0.'),
	width: positiveNumber('Enter a sheet width greater than 0.')
});

export const decorFormSchema = z.object({
	collectionId: z.string().uuid('Choose a collection.'),
	caption: z
		.string()
		.trim()
		.min(1, 'Enter a decor caption.')
		.max(200, 'Keep the caption to 200 characters or fewer.')
		.transform(collapseText),
	decorCode: z
		.string()
		.trim()
		.min(1, 'Enter a decor code.')
		.max(64, 'Keep the decor code to 64 characters or fewer.')
		.transform(collapseText),
	colourFamily: z.enum(DECOR_COLOUR_FAMILIES).nullable(),
	materialType: z.enum(DECOR_MATERIAL_TYPES),
	core: z.enum(DECOR_CORES),
	defaultThicknessMm: z
		.number({ error: 'Enter a thickness.' })
		.finite('Enter a thickness.')
		.positive('Enter a thickness greater than 0 mm.')
		.max(100, 'Enter a thickness of 100 mm or less.'),
	sheetSizeMm: decorSheetSizeSchema,
	grainDirection: z.enum(GRAIN_DIRECTIONS).nullable(),
	premiumTier: z.enum(PREMIUM_TIERS),
	status: z.enum(MATERIAL_STATUSES),
	customerVisible: z.boolean()
});

export type DecorFormValues = z.infer<typeof decorFormSchema>;

export type DecorInputDraft = Partial<CreateDecorInput> &
	Partial<Pick<UpdateDecorInput, 'sampleAssetId'>>;

export function normaliseDecorInput(input: DecorInputDraft): DecorInputDraft {
	const result: DecorInputDraft = {};

	if (input.collectionId !== undefined) result.collectionId = input.collectionId;
	if (input.caption !== undefined) result.caption = collapseText(input.caption);
	if (input.decorCode !== undefined) result.decorCode = collapseText(input.decorCode);
	if (input.textureSurface !== undefined) {
		result.textureSurface = collapseOrNull(input.textureSurface);
	}
	if (input.colourFamily !== undefined) result.colourFamily = input.colourFamily;
	if (input.materialType !== undefined) result.materialType = input.materialType;
	if (input.core !== undefined) result.core = input.core;
	if (input.defaultThicknessMm !== undefined) {
		result.defaultThicknessMm = input.defaultThicknessMm;
	}
	if (input.sheetSizeMm !== undefined) result.sheetSizeMm = { ...input.sheetSizeMm };
	if (input.grainDirection !== undefined) result.grainDirection = input.grainDirection;
	if (input.premiumTier !== undefined) result.premiumTier = input.premiumTier;
	if (input.status !== undefined) result.status = input.status;
	if (input.customerVisible !== undefined) result.customerVisible = input.customerVisible;
	if (input.sampleAssetId !== undefined) result.sampleAssetId = input.sampleAssetId;

	return result;
}

/** Sample assets are owner-scoped UUIDs; the decor only stores the reference. */
export const decorSampleAssetSchema = z.string().uuid('Choose a valid sample asset.').nullable();

/* ------------------------------------------------------------------ */
/* Edging.                                                            */
/* ------------------------------------------------------------------ */

export const edgingFormSchema = z.object({
	caption: z
		.string()
		.trim()
		.min(1, 'Enter an edging caption.')
		.max(200, 'Keep the caption to 200 characters or fewer.')
		.transform(collapseText),
	edgingCode: z
		.string()
		.trim()
		.min(1, 'Enter an edging code.')
		.max(64, 'Keep the edging code to 64 characters or fewer.')
		.transform(collapseText),
	materialType: z
		.string()
		.trim()
		.min(1, 'Enter the edging material.')
		.max(100, 'Keep the material to 100 characters or fewer.')
		.transform(collapseText),
	thicknessMm: positiveNumber('Enter a thickness greater than 0 mm.'),
	colourFamily: z.enum(DECOR_COLOUR_FAMILIES).nullable(),
	active: z.boolean().default(true)
});

export type EdgingFormValues = z.infer<typeof edgingFormSchema>;

export type EdgingInputDraft = Partial<EdgingInput>;

export function normaliseEdgingInput(input: EdgingInputDraft): EdgingInputDraft {
	const result: EdgingInputDraft = {};
	if (input.caption !== undefined) result.caption = collapseText(input.caption);
	if (input.edgingCode !== undefined) result.edgingCode = collapseText(input.edgingCode);
	if (input.materialType !== undefined) result.materialType = collapseText(input.materialType);
	if (input.thicknessMm !== undefined) result.thicknessMm = input.thicknessMm;
	if (input.colourFamily !== undefined) result.colourFamily = input.colourFamily;
	if (input.active !== undefined) result.active = input.active;
	return result;
}

/* ------------------------------------------------------------------ */
/* Supplier.                                                          */
/* ------------------------------------------------------------------ */

const leadTimeDaysSchema = z.preprocess(
	(value) => (value === undefined || value === '' ? null : value),
	z
		.number({ error: 'Enter the lead time in whole days.' })
		.int('Enter the lead time in whole days.')
		.min(0, 'Enter a lead time of 0 days or more.')
		.max(365, 'Enter a lead time of 365 days or less.')
		.nullable()
);

export const supplierFormSchema = z.object({
	caption: z
		.string()
		.trim()
		.min(1, 'Enter a supplier caption.')
		.max(200, 'Keep the caption to 200 characters or fewer.')
		.transform(collapseText),
	contact: optionalText(200, 'Keep the contact to 200 characters or fewer.'),
	leadTimeDays: leadTimeDaysSchema
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export type SupplierInputDraft = Partial<SupplierInput & Pick<UpdateSupplierInput, 'active'>>;

export function normaliseSupplierInput(input: SupplierInputDraft): SupplierInputDraft {
	const result: SupplierInputDraft = {};
	if (input.caption !== undefined) result.caption = collapseText(input.caption);
	if (input.contact !== undefined) result.contact = collapseOrNull(input.contact);
	if (input.leadTimeDays !== undefined) result.leadTimeDays = input.leadTimeDays;
	if (input.active !== undefined) result.active = input.active;
	return result;
}

/* ------------------------------------------------------------------ */
/* Decor links and attributes.                                        */
/* ------------------------------------------------------------------ */

export const decorEdgingFormSchema = z.object({
	edgingId: z.string().uuid('Choose an edging.'),
	matchType: z.enum(EDGING_MATCH_TYPES)
});

export type DecorEdgingFormValues = z.infer<typeof decorEdgingFormSchema>;

export type DecorEdgingInputDraft = Partial<DecorEdgingInput>;

export function normaliseDecorEdgingInput(input: DecorEdgingInputDraft): DecorEdgingInputDraft {
	const result: DecorEdgingInputDraft = {};
	if (input.edgingId !== undefined) result.edgingId = input.edgingId;
	if (input.matchType !== undefined) result.matchType = input.matchType;
	return result;
}

export const decorSupplierFormSchema = z.object({
	supplierId: z.string().uuid('Choose a supplier.'),
	supplierCode: z
		.string()
		.trim()
		.min(1, 'Enter the supplier code for this decor.')
		.max(64, 'Keep the supplier code to 64 characters or fewer.')
		.transform(collapseText),
	isPrimary: z.boolean(),
	altSupplierCode: z.preprocess(
		blankToNull,
		z.string().trim().max(64, 'Keep the alternative code to 64 characters or fewer.').nullable()
	)
});

export type DecorSupplierFormValues = z.infer<typeof decorSupplierFormSchema>;

export type DecorSupplierInputDraft = Partial<DecorSupplierInput>;

export function normaliseDecorSupplierInput(
	input: DecorSupplierInputDraft
): DecorSupplierInputDraft {
	const result: DecorSupplierInputDraft = {};
	if (input.supplierId !== undefined) result.supplierId = input.supplierId;
	if (input.supplierCode !== undefined) result.supplierCode = collapseText(input.supplierCode);
	if (input.isPrimary !== undefined) result.isPrimary = input.isPrimary;
	if (input.altSupplierCode !== undefined) {
		result.altSupplierCode = collapseOrNull(input.altSupplierCode);
	}
	return result;
}

export const decorAttributeFormSchema = z.object({
	attrName: z.string().trim().min(1, 'Enter an attribute name.').transform(collapseText),
	attrValue: z.string().trim().min(1, 'Enter an attribute value.')
});

export type DecorAttributeFormValues = z.infer<typeof decorAttributeFormSchema>;

export type DecorAttributeInputDraft = Partial<DecorAttributeInput>;

export function normaliseDecorAttributeInput(
	input: DecorAttributeInputDraft
): DecorAttributeInputDraft {
	const result: DecorAttributeInputDraft = {};
	if (input.attrName !== undefined) result.attrName = collapseText(input.attrName);
	if (input.attrValue !== undefined) result.attrValue = input.attrValue.trim();
	return result;
}

/* ------------------------------------------------------------------ */
/* Shared error mapping.                                              */
/* ------------------------------------------------------------------ */

/** First message per field, keyed by the schema path. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.') || 'form';
		if (!(key in errors)) errors[key] = issue.message;
	}
	return errors;
}
