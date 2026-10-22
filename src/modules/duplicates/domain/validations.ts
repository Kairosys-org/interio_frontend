import { z } from 'zod';
import { DEDUP_NOTE_REQUIRED, DEDUP_TARGET_INVALID } from '$shared/domain/dedup';

/**
 * Duplicate-review decision (R5, spec Part 5 §5 and Part 10 §5).
 *
 * The same rules are enforced by the mock server: `confirm_distinct` needs a
 * written reason so the audit trail explains why two near-identical records
 * live side by side; `link_to_existing` needs the record it attaches to.
 * Nothing here merges anything — the decision is recorded, never applied.
 */

export const DEDUP_DECISIONS = ['confirm_distinct', 'link_to_existing'] as const;

export const dedupReviewSchema = z
	.object({
		decision: z.enum(DEDUP_DECISIONS),
		targetId: z.string().uuid(DEDUP_TARGET_INVALID).nullable(),
		reviewNote: z.string().trim().max(2000, 'Keep the note to 2000 characters or fewer.')
	})
	.refine((values) => values.decision !== 'confirm_distinct' || values.reviewNote.length > 0, {
		message: DEDUP_NOTE_REQUIRED,
		path: ['reviewNote']
	})
	.refine(
		(values) =>
			values.decision !== 'link_to_existing' ||
			(typeof values.targetId === 'string' && values.targetId.trim().length > 0),
		{ message: DEDUP_TARGET_INVALID, path: ['targetId'] }
	);

export type DedupReviewValues = z.infer<typeof dedupReviewSchema>;

/** First message per field, keyed by the schema path. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.') || 'form';
		if (!(key in errors)) errors[key] = issue.message;
	}
	return errors;
}
