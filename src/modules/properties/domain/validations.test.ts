import { describe, expect, it } from 'vitest';
import { normalisePropertyInput, propertyFormSchema } from './validations';

const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';

describe('propertyFormSchema', () => {
	it('accepts a complete property and trims the address', () => {
		const parsed = propertyFormSchema.parse({
			customerId: CUSTOMER_ID,
			addressLine1: '  14 Oak Street  ',
			addressLine2: '  Flat 2 ',
			town: ' Richmond ',
			postcode: 'tw9 1aa',
			accessNotes: '  Key safe at the side gate.  '
		});

		expect(parsed).toEqual({
			customerId: CUSTOMER_ID,
			addressLine1: '14 Oak Street',
			addressLine2: 'Flat 2',
			town: 'Richmond',
			postcode: 'tw9 1aa',
			accessNotes: 'Key safe at the side gate.'
		});
	});

	it('treats blank and null optionals as not provided', () => {
		const parsed = propertyFormSchema.parse({
			customerId: CUSTOMER_ID,
			addressLine1: '14 Oak Street',
			addressLine2: '',
			town: '   ',
			postcode: null,
			accessNotes: null
		});

		expect(parsed.addressLine2).toBeUndefined();
		expect(parsed.town).toBeUndefined();
		expect(parsed.postcode).toBeUndefined();
		expect(parsed.accessNotes).toBeUndefined();
	});

	it('rejects a missing customer, a blank address and oversized notes', () => {
		const result = propertyFormSchema.safeParse({
			customerId: 'not-a-uuid',
			addressLine1: '   ',
			accessNotes: 'x'.repeat(2001)
		});

		expect(result.success).toBe(false);
		if (result.success) return;

		const errors = Object.fromEntries(
			result.error.issues.map((issue) => [issue.path.join('.'), issue.message])
		);
		expect(errors.customerId).toBe('Choose a customer.');
		expect(errors.addressLine1).toBe('Enter the address.');
		expect(errors.accessNotes).toBe('Keep access notes to 2000 characters or fewer.');
	});
});

describe('normalisePropertyInput', () => {
	it('collapses address whitespace, uppercases the postcode and trims notes', () => {
		const normalised = normalisePropertyInput({
			customerId: CUSTOMER_ID,
			addressLine1: '  14   Oak    Street ',
			addressLine2: '  Flat   2 ',
			town: '  Richmond  Upon   Thames ',
			postcode: ' tw9   1aa ',
			accessNotes: '\n  Key safe beside the gate.\n\n'
		});

		expect(normalised).toEqual({
			customerId: CUSTOMER_ID,
			addressLine1: '14 Oak Street',
			addressLine2: 'Flat 2',
			town: 'Richmond Upon Thames',
			postcode: 'TW9 1AA',
			accessNotes: 'Key safe beside the gate.'
		});
	});

	it('turns blank optional values into null', () => {
		const normalised = normalisePropertyInput({
			customerId: CUSTOMER_ID,
			addressLine1: '14 Oak Street',
			addressLine2: '   ',
			town: '',
			postcode: '   ',
			accessNotes: ' '
		});

		expect(normalised.addressLine2).toBeNull();
		expect(normalised.town).toBeNull();
		expect(normalised.postcode).toBeNull();
		expect(normalised.accessNotes).toBeNull();
	});

	it('normalises only the fields present in a partial update', () => {
		const normalised = normalisePropertyInput({ postcode: ' n1   3cc ' });

		expect(normalised).toEqual({ postcode: 'N1 3CC' });
		expect('addressLine1' in normalised).toBe(false);
	});
});
