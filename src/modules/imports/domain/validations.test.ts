import { describe, expect, it } from 'vitest';
import { importStageSchema, requiredFieldsMapped } from './validations';

describe('importStageSchema', () => {
	const valid = {
		kind: 'customer' as const,
		fileName: 'customers.csv',
		columnMap: { caption: 'caption' },
		rows: 3
	};

	it('accepts a staged batch with a mapped column and at least one row', () => {
		expect(importStageSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects an unknown kind', () => {
		const parsed = importStageSchema.safeParse({ ...valid, kind: 'price_list' });
		expect(parsed.success).toBe(false);
	});

	it('rejects a blank file name with a readable message', () => {
		const parsed = importStageSchema.safeParse({ ...valid, fileName: '   ' });
		expect(parsed.success).toBe(false);
		if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe('Choose a file to import.');
	});

	it('rejects a file with no data rows', () => {
		const parsed = importStageSchema.safeParse({ ...valid, rows: 0 });
		expect(parsed.success).toBe(false);
		if (!parsed.success)
			expect(parsed.error.issues[0]?.message).toBe('That file has no data rows.');
	});

	it('requires columnMap to be a string record', () => {
		const parsed = importStageSchema.safeParse({ ...valid, columnMap: { caption: 1 } });
		expect(parsed.success).toBe(false);
	});
});

describe('requiredFieldsMapped', () => {
	it('lists the required labels that no column maps to', () => {
		expect(requiredFieldsMapped('customer', { email: 'email' })).toEqual(['Caption']);
		expect(requiredFieldsMapped('property', { address_line1: 'address_line1' })).toEqual([
			'Customer email'
		]);
		expect(
			requiredFieldsMapped('project', {
				customer_email: 'customer_email',
				property_address: 'property_address',
				caption: 'caption',
				project_type: 'project_type'
			})
		).toEqual([]);
	});

	it('is satisfied when the required field is mapped from any header', () => {
		expect(requiredFieldsMapped('customer', { 'Customer name': 'caption' })).toEqual([]);
	});
});
