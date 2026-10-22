import { describe, expect, it } from 'vitest';
import { demoCustomerId } from '$shared/data/demo-record-plan';
import { DEDUP_NOTE_REQUIRED, DEDUP_TARGET_INVALID } from '$shared/domain/dedup';
import { dedupReviewSchema, fieldErrorsFrom } from './validations';

const TARGET = demoCustomerId(1);

describe('dedupReviewSchema', () => {
	it('accepts confirm_distinct with a written reason and trims the note', () => {
		const parsed = dedupReviewSchema.parse({
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: '  Different branch of the family. '
		});

		expect(parsed).toEqual({
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: 'Different branch of the family.'
		});
	});

	it('rejects confirm_distinct with a blank note', () => {
		const result = dedupReviewSchema.safeParse({
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: '   '
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrorsFrom(result.error)).toEqual({ reviewNote: DEDUP_NOTE_REQUIRED });
		}
	});

	it('rejects confirm_distinct with no note at all', () => {
		const result = dedupReviewSchema.safeParse({
			decision: 'confirm_distinct',
			targetId: null
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrorsFrom(result.error)).toHaveProperty('reviewNote');
		}
	});

	it('accepts link_to_existing with a same-tenant target and an empty note', () => {
		const parsed = dedupReviewSchema.parse({
			decision: 'link_to_existing',
			targetId: TARGET,
			reviewNote: ''
		});

		expect(parsed).toEqual({
			decision: 'link_to_existing',
			targetId: TARGET,
			reviewNote: ''
		});
	});

	it('rejects link_to_existing without a target', () => {
		const result = dedupReviewSchema.safeParse({
			decision: 'link_to_existing',
			targetId: null,
			reviewNote: ''
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrorsFrom(result.error)).toEqual({ targetId: DEDUP_TARGET_INVALID });
		}
	});

	it('rejects a target that is not a UUID', () => {
		const result = dedupReviewSchema.safeParse({
			decision: 'link_to_existing',
			targetId: 'customer-1',
			reviewNote: ''
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrorsFrom(result.error)).toHaveProperty('targetId');
		}
	});

	it('rejects an unknown decision', () => {
		const result = dedupReviewSchema.safeParse({
			decision: 'merge',
			targetId: null,
			reviewNote: 'Merge them.'
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrorsFrom(result.error)).toHaveProperty('decision');
		}
	});

	it('rejects a note longer than 2000 characters', () => {
		const result = dedupReviewSchema.safeParse({
			decision: 'confirm_distinct',
			targetId: null,
			reviewNote: 'x'.repeat(2001)
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrorsFrom(result.error).reviewNote).toBe(
				'Keep the note to 2000 characters or fewer.'
			);
		}
	});
});

describe('fieldErrorsFrom', () => {
	it('keeps the first message per field and names a pathless issue "form"', () => {
		const result = dedupReviewSchema.safeParse({
			decision: 'link_to_existing',
			targetId: null,
			reviewNote: ''
		});
		expect(result.success).toBe(false);
		if (result.success) return;

		const errors = fieldErrorsFrom(result.error);
		expect(errors.targetId).toBe(DEDUP_TARGET_INVALID);
		expect(Object.keys(errors)).toEqual(['targetId']);
	});
});
