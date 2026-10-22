import { z } from 'zod';
import { normalisePostcode } from '$shared/domain/dedup';
import type { CreatePropertyInput, UpdatePropertyInput } from './types';

/**
 * Property create/edit forms (spec Part 5 §4.2).
 *
 * These schemas are the client-side gate only; the mock repository validates the
 * same input again because it behaves like the server (R4, architecture §4.6).
 * Empty strings arrive from form fields and mean "not provided", never `''`.
 */

const ACCESS_NOTES_MAX = 2000;

function blankToUndefined(value: unknown): unknown {
	if (value === null || value === undefined) return undefined;
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

const optionalText = (max: number, message: string) =>
	z.preprocess(blankToUndefined, z.string().trim().max(max, message).optional());

export const propertyFormSchema = z.object({
	customerId: z.string().uuid('Choose a customer.'),
	addressLine1: z
		.string()
		.trim()
		.min(1, 'Enter the address.')
		.max(200, 'Keep the address to 200 characters or fewer.'),
	addressLine2: optionalText(200, 'Keep address line 2 to 200 characters or fewer.'),
	town: optionalText(120, 'Keep the town to 120 characters or fewer.'),
	postcode: optionalText(12, 'Keep the postcode to 12 characters or fewer.'),
	accessNotes: optionalText(ACCESS_NOTES_MAX, 'Keep access notes to 2000 characters or fewer.')
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

function collapseWhitespace(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function collapsedOrNull(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const collapsed = collapseWhitespace(value);
	return collapsed.length > 0 ? collapsed : null;
}

function trimmedOrNull(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normaliseFields(input: UpdatePropertyInput): UpdatePropertyInput {
	const next: UpdatePropertyInput = { ...input };
	if (input.addressLine1 !== undefined) next.addressLine1 = collapseWhitespace(input.addressLine1);
	if (input.addressLine2 !== undefined) next.addressLine2 = collapsedOrNull(input.addressLine2);
	if (input.town !== undefined) next.town = collapsedOrNull(input.town);
	if (input.postcode !== undefined) next.postcode = normalisePostcode(input.postcode);
	if (input.accessNotes !== undefined) next.accessNotes = trimmedOrNull(input.accessNotes);
	return next;
}

/** Trim/collapse address lines, uppercase the postcode and single-space it. */
export function normalisePropertyInput(input: CreatePropertyInput): CreatePropertyInput;
export function normalisePropertyInput(input: UpdatePropertyInput): UpdatePropertyInput;
export function normalisePropertyInput(
	input: CreatePropertyInput | UpdatePropertyInput
): CreatePropertyInput | UpdatePropertyInput {
	return normaliseFields(input);
}
