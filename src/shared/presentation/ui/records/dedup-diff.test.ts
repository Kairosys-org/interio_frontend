import { describe, expect, it } from 'vitest';
import { diffFields, type DedupField } from './dedup-diff';

const held: DedupField[] = [
	{ label: 'Name', value: 'Jane Smith' },
	{ label: 'Email', value: 'jane@example.com' },
	{ label: 'Phone', value: '07700 900123' },
	{ label: 'Address', value: '12 Mill Lane, Bath BA1 2CD' }
];

function field(diffs: ReturnType<typeof diffFields>, label: string) {
	const match = diffs.find((diff) => diff.label === label);
	if (!match) throw new Error(`Missing diff for ${label}`);
	return match;
}

describe('diffFields', () => {
	it('marks equal fields as not different and keeps both display values', () => {
		const diffs = diffFields(held, held);

		expect(diffs).toHaveLength(held.length);
		expect(diffs.map((diff) => diff.label)).toEqual(held.map((entry) => entry.label));
		expect(diffs.every((diff) => diff.different)).toBe(false);
		expect(field(diffs, 'Name').heldValue).toBe('Jane Smith');
		expect(field(diffs, 'Name').candidateValue).toBe('Jane Smith');
	});

	it('flags a changed value', () => {
		const candidate = held.map((entry) =>
			entry.label === 'Email' ? { ...entry, value: 'jane.smith@example.com' } : entry
		);

		const diffs = diffFields(held, candidate);

		expect(field(diffs, 'Email').different).toBe(true);
		expect(field(diffs, 'Email').candidateValue).toBe('jane.smith@example.com');
		expect(field(diffs, 'Name').different).toBe(false);
	});

	it('ignores case and repeated whitespace when comparing', () => {
		const candidate: DedupField[] = [
			{ label: 'Name', value: '  jane   SMITH ' },
			{ label: 'Email', value: 'JANE@example.com' }
		];

		const diffs = diffFields(held, candidate);

		expect(field(diffs, 'Name').different).toBe(false);
		expect(field(diffs, 'Email').different).toBe(false);
	});

	it('treats a field the candidate omits as different', () => {
		const candidate: DedupField[] = [{ label: 'Name', value: 'Jane Smith' }];

		const diffs = diffFields(held, candidate);

		expect(field(diffs, 'Email')).toEqual({
			label: 'Email',
			heldValue: 'jane@example.com',
			candidateValue: '',
			different: true
		});
	});

	it('appends candidate-only fields after the held fields', () => {
		const candidate: DedupField[] = [...held, { label: 'Company', value: 'Smith & Co' }];

		const diffs = diffFields(held, candidate);

		expect(diffs.map((diff) => diff.label)).toEqual([
			'Name',
			'Email',
			'Phone',
			'Address',
			'Company'
		]);
		expect(field(diffs, 'Company')).toEqual({
			label: 'Company',
			heldValue: '',
			candidateValue: 'Smith & Co',
			different: true
		});
	});

	it('does not flag an empty candidate-only field as different', () => {
		const diffs = diffFields([], [{ label: 'Company', value: '   ' }]);

		expect(diffs).toEqual([
			{ label: 'Company', heldValue: '', candidateValue: '   ', different: false }
		]);
	});

	it('returns an empty list when both sides have no fields', () => {
		expect(diffFields([], [])).toEqual([]);
	});

	it('never mutates its inputs', () => {
		const heldCopy = structuredClone(held);
		const candidateCopy = structuredClone(held);

		diffFields(held, candidateCopy);

		expect(held).toEqual(heldCopy);
		expect(candidateCopy).toEqual(heldCopy);
	});
});
