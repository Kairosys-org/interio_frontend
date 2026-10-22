import { describe, expect, it } from 'vitest';
import { customerFormSchema, fieldErrorsFrom, normaliseCustomerInput } from './validations';

const VALID = {
	caption: 'The Hartley Family',
	contactName: 'James Hartley',
	email: 'james.hartley@example.com',
	phone: '020 7946 0102',
	addressLine1: null,
	addressLine2: null,
	town: 'Wimbledon',
	postcode: 'SW19 2BB',
	preferredChannel: 'phone' as const
};

describe('customerFormSchema', () => {
	it('accepts a valid customer form and trims the caption', () => {
		const parsed = customerFormSchema.parse({ ...VALID, caption: '  The   Hartley  Family ' });

		expect(parsed.caption).toBe('The Hartley Family');
		expect(parsed.email).toBe('james.hartley@example.com');
		expect(parsed.preferredChannel).toBe('phone');
	});

	it('turns an empty email and blank optional fields into null', () => {
		const parsed = customerFormSchema.parse({
			...VALID,
			email: '   ',
			phone: '',
			contactName: '   ',
			town: '',
			postcode: '    '
		});

		expect(parsed.email).toBeNull();
		expect(parsed.phone).toBeNull();
		expect(parsed.contactName).toBeNull();
		expect(parsed.town).toBeNull();
		expect(parsed.postcode).toBeNull();
	});

	it('lowercases an email address', () => {
		const parsed = customerFormSchema.parse({ ...VALID, email: ' James.Hartley@Example.COM ' });
		expect(parsed.email).toBe('james.hartley@example.com');
	});

	it('rejects a missing or empty caption', () => {
		const empty = customerFormSchema.safeParse({ ...VALID, caption: '   ' });
		expect(empty.success).toBe(false);
		if (!empty.success) {
			expect(fieldErrorsFrom(empty.error)).toMatchObject({
				caption: 'Enter a customer caption.'
			});
		}
	});

	it('rejects a caption longer than 200 characters', () => {
		const result = customerFormSchema.safeParse({ ...VALID, caption: 'x'.repeat(201) });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrorsFrom(result.error).caption).toBe(
				'Keep the caption to 200 characters or fewer.'
			);
		}
	});

	it('rejects an invalid email address', () => {
		const result = customerFormSchema.safeParse({ ...VALID, email: 'not-an-email' });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrorsFrom(result.error).email).toBe('Enter a valid email address.');
		}
	});

	it('rejects a phone number longer than 40 characters', () => {
		const result = customerFormSchema.safeParse({ ...VALID, phone: '1'.repeat(41) });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrorsFrom(result.error).phone).toBe(
				'Keep the phone number to 40 characters or fewer.'
			);
		}
	});

	it('accepts every preferred channel and rejects an unknown one', () => {
		for (const preferredChannel of ['email', 'phone', 'sms', 'none'] as const) {
			expect(customerFormSchema.safeParse({ ...VALID, preferredChannel }).success).toBe(true);
		}

		const invalid = customerFormSchema.safeParse({ ...VALID, preferredChannel: 'whatsapp' });
		expect(invalid.success).toBe(false);
	});
});

describe('normaliseCustomerInput', () => {
	it('collapses caption and contact whitespace and normalises contact keys', () => {
		expect(
			normaliseCustomerInput({
				caption: '  The   Hartley  Family ',
				contactName: '  James   Hartley ',
				email: ' James.Hartley@Example.COM ',
				phone: '020 7946 0102',
				town: '  Wimble  don ',
				postcode: 'sw19  2bb'
			})
		).toEqual({
			caption: 'The Hartley Family',
			contactName: 'James Hartley',
			email: 'james.hartley@example.com',
			phone: '02079460102',
			town: 'Wimble don',
			postcode: 'SW19 2BB'
		});
	});

	it('turns blank optional values into null', () => {
		expect(
			normaliseCustomerInput({
				caption: 'A. Smith',
				contactName: '   ',
				email: '',
				phone: '   ',
				addressLine1: null,
				postcode: '   '
			})
		).toEqual({
			caption: 'A. Smith',
			contactName: null,
			email: null,
			phone: null,
			addressLine1: null,
			postcode: null
		});
	});

	it('keeps omitted keys absent so an update patch cannot clear a field', () => {
		const patch = normaliseCustomerInput({ email: null });

		expect(patch).toEqual({ email: null });
		expect(patch).not.toHaveProperty('phone');
		expect(patch).not.toHaveProperty('caption');
		expect(patch).not.toHaveProperty('postcode');
	});

	it('uppercases a postcode and inserts the standard single space', () => {
		expect(normaliseCustomerInput({ postcode: ' e81 2ab ' }).postcode).toBe('E81 2AB');
		expect(normaliseCustomerInput({ postcode: 'e812ab' }).postcode).toBe('E81 2AB');
	});

	it('reduces a phone number to digits', () => {
		expect(normaliseCustomerInput({ phone: '+44 (0)20 7946-0102' }).phone).toBe('4402079460102');
	});
});
