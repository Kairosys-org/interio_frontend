import { describe, expect, it } from 'vitest';
import {
	decorAttributeFormSchema,
	decorEdgingFormSchema,
	decorFormSchema,
	decorSupplierFormSchema,
	edgingFormSchema,
	fieldErrorsFrom,
	manufacturerFormSchema,
	normaliseDecorAttributeInput,
	normaliseDecorInput,
	normaliseSupplierInput,
	supplierFormSchema
} from './validations';

const VALID_DECOR = {
	collectionId: '11111111-1111-4111-8111-111111111111',
	caption: 'Arctic White',
	decorCode: 'KL-1001',
	colourFamily: 'white',
	materialType: 'melamine_board',
	core: 'chipboard',
	defaultThicknessMm: 18,
	sheetSizeMm: { length: 2800, width: 2070 },
	grainDirection: 'along_length',
	premiumTier: 'standard',
	status: 'active',
	customerVisible: true
} as const;

describe('decorFormSchema', () => {
	it('accepts a complete decor and collapses caption whitespace', () => {
		const parsed = decorFormSchema.parse({
			...VALID_DECOR,
			caption: '  Arctic   White '
		});

		expect(parsed.caption).toBe('Arctic White');
		expect(parsed.sheetSizeMm).toEqual({ length: 2800, width: 2070 });
	});

	it('allows nullable colour family and grain direction', () => {
		const parsed = decorFormSchema.parse({
			...VALID_DECOR,
			colourFamily: null,
			grainDirection: null
		});

		expect(parsed.colourFamily).toBeNull();
		expect(parsed.grainDirection).toBeNull();
	});

	it('rejects a missing caption, code and collection id', () => {
		const result = decorFormSchema.safeParse({
			...VALID_DECOR,
			collectionId: 'not-a-uuid',
			caption: '   ',
			decorCode: '  '
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrorsFrom(result.error)).toMatchObject({
			collectionId: 'Choose a collection.',
			caption: 'Enter a decor caption.',
			decorCode: 'Enter a decor code.'
		});
	});

	it('bounds thickness above 0 and at 100 mm', () => {
		const zero = decorFormSchema.safeParse({ ...VALID_DECOR, defaultThicknessMm: 0 });
		expect(zero.success).toBe(false);
		if (!zero.success) {
			expect(fieldErrorsFrom(zero.error).defaultThicknessMm).toBe(
				'Enter a thickness greater than 0 mm.'
			);
		}

		const tooThick = decorFormSchema.safeParse({
			...VALID_DECOR,
			defaultThicknessMm: 101
		});
		expect(tooThick.success).toBe(false);
		if (!tooThick.success) {
			expect(fieldErrorsFrom(tooThick.error).defaultThicknessMm).toBe(
				'Enter a thickness of 100 mm or less.'
			);
		}
	});

	it('requires positive sheet dimensions', () => {
		const result = decorFormSchema.safeParse({
			...VALID_DECOR,
			sheetSizeMm: { length: 0, width: -10 }
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		const errors = fieldErrorsFrom(result.error);
		expect(errors['sheetSizeMm.length']).toBe('Enter a sheet length greater than 0.');
		expect(errors['sheetSizeMm.width']).toBe('Enter a sheet width greater than 0.');
	});

	it('accepts only canonical facet values', () => {
		const result = decorFormSchema.safeParse({
			...VALID_DECOR,
			materialType: 'cardboard',
			premiumTier: 'gold'
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		const errors = fieldErrorsFrom(result.error);
		expect(errors.materialType).toBeDefined();
		expect(errors.premiumTier).toBeDefined();
	});
});

describe('normaliseDecorInput', () => {
	it('collapses text, trims blanks to null and copies the sheet size', () => {
		const sheetSizeMm = { length: 3050, width: 1220 };
		const normalised = normaliseDecorInput({
			caption: '  Natural   Oak ',
			decorCode: ' NV-1004 ',
			textureSurface: '   ',
			sheetSizeMm
		});

		expect(normalised).toMatchObject({
			caption: 'Natural Oak',
			decorCode: 'NV-1004',
			textureSurface: null
		});
		expect(normalised.sheetSizeMm).toEqual(sheetSizeMm);
		expect(normalised.sheetSizeMm).not.toBe(sheetSizeMm);
	});
});

describe('manufacturerFormSchema', () => {
	it('requires a caption and accepts a URL-ish website', () => {
		const parsed = manufacturerFormSchema.parse({
			caption: '  Kairos   Laminates ',
			country: ' ',
			website: 'kairos-laminates.example'
		});

		expect(parsed.caption).toBe('Kairos Laminates');
		expect(parsed.country).toBeNull();
		expect(parsed.website).toBe('kairos-laminates.example');
	});

	it('rejects a blank caption and a website with spaces', () => {
		const result = manufacturerFormSchema.safeParse({
			caption: ' ',
			website: 'not a website'
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		const errors = fieldErrorsFrom(result.error);
		expect(errors.caption).toBe('Enter a manufacturer caption.');
		expect(errors.website).toBe('Enter a valid website address.');
	});
});

describe('edgingFormSchema', () => {
	it('requires a positive thickness and defaults to active', () => {
		const parsed = edgingFormSchema.parse({
			caption: ' Alpine White 22 mm ',
			edgingCode: 'EDG-2201',
			materialType: 'ABS',
			thicknessMm: 22,
			colourFamily: null
		});

		expect(parsed.caption).toBe('Alpine White 22 mm');
		expect(parsed.active).toBe(true);
	});

	it('rejects a zero thickness', () => {
		const result = edgingFormSchema.safeParse({
			caption: 'Edging',
			edgingCode: 'EDG-1',
			materialType: 'ABS',
			thicknessMm: 0,
			colourFamily: null
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(fieldErrorsFrom(result.error).thicknessMm).toBe('Enter a thickness greater than 0 mm.');
	});
});

describe('supplierFormSchema', () => {
	it('accepts a null lead time and normalises blank contact', () => {
		const parsed = supplierFormSchema.parse({
			caption: ' Thames Timber ',
			contact: '  ',
			leadTimeDays: null
		});

		expect(parsed).toMatchObject({
			caption: 'Thames Timber',
			contact: null,
			leadTimeDays: null
		});
	});

	it('bounds lead time between 0 and 365 whole days', () => {
		const tooLong = supplierFormSchema.safeParse({
			caption: 'Supplier',
			leadTimeDays: 366
		});
		expect(tooLong.success).toBe(false);
		if (!tooLong.success) {
			expect(fieldErrorsFrom(tooLong.error).leadTimeDays).toBe(
				'Enter a lead time of 365 days or less.'
			);
		}

		const negative = supplierFormSchema.safeParse({
			caption: 'Supplier',
			leadTimeDays: -1
		});
		expect(negative.success).toBe(false);
		if (!negative.success) {
			expect(fieldErrorsFrom(negative.error).leadTimeDays).toBe(
				'Enter a lead time of 0 days or more.'
			);
		}

		const fraction = supplierFormSchema.safeParse({
			caption: 'Supplier',
			leadTimeDays: 1.5
		});
		expect(fraction.success).toBe(false);
	});

	it('normalises a blank contact to null', () => {
		expect(
			normaliseSupplierInput({ caption: '  Supplier ', contact: '   ', leadTimeDays: 14 })
		).toEqual({
			caption: 'Supplier',
			contact: null,
			leadTimeDays: 14
		});
	});
});

describe('decor link and attribute schemas', () => {
	it('requires a UUID edging and a canonical match type', () => {
		expect(
			decorEdgingFormSchema.safeParse({
				edgingId: '11111111-1111-4111-8111-111111111111',
				matchType: 'exact'
			}).success
		).toBe(true);

		const invalid = decorEdgingFormSchema.safeParse({
			edgingId: 'edging-1',
			matchType: 'close'
		});
		expect(invalid.success).toBe(false);
	});

	it('requires a supplier code and a boolean primary flag', () => {
		const result = decorSupplierFormSchema.safeParse({
			supplierId: '11111111-1111-4111-8111-111111111111',
			supplierCode: '   ',
			isPrimary: 'yes',
			altSupplierCode: ' '
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		const errors = fieldErrorsFrom(result.error);
		expect(errors.supplierCode).toBe('Enter the supplier code for this decor.');
		expect(errors.isPrimary).toBeDefined();
	});

	it('trims an empty attribute name and value away', () => {
		const result = decorAttributeFormSchema.safeParse({
			attrName: '   ',
			attrValue: '  '
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		const errors = fieldErrorsFrom(result.error);
		expect(errors.attrName).toBe('Enter an attribute name.');
		expect(errors.attrValue).toBe('Enter an attribute value.');
	});

	it('collapses the attribute name but only trims its value', () => {
		expect(
			normaliseDecorAttributeInput({
				attrName: '  Edge   profile ',
				attrValue: '  Class  D-s2,d0 '
			})
		).toEqual({
			attrName: 'Edge profile',
			attrValue: 'Class  D-s2,d0'
		});
	});
});

describe('fieldErrorsFrom', () => {
	it('keeps the first message per field path', () => {
		const result = decorFormSchema.safeParse({
			...VALID_DECOR,
			caption: ' ',
			decorCode: ' '
		});
		expect(result.success).toBe(false);
		if (result.success) return;

		const errors = fieldErrorsFrom(result.error);
		expect(Object.keys(errors).sort()).toEqual(['caption', 'decorCode']);
		expect(errors.caption).toBe('Enter a decor caption.');
	});
});
