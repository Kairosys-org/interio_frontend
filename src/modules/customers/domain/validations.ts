import { z } from 'zod';
import { normaliseEmail, normalisePhone, normalisePostcode } from '$shared/domain/dedup';
import { PREFERRED_CHANNELS, type PreferredChannel } from '$shared/domain/record-states';

/**
 * Customer create/edit form plus the normalisers both the mock repository and
 * the UI use.
 *
 * Values are normalised before validation (R4): the server stores emails
 * lowercased, phones as digits and postcodes uppercase with a single space.
 * Messages are user-readable sentences (DESIGN §12.5).
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

/** No spec length: the database stores it as plain text. */
function optionalString() {
	return z.preprocess(blankToNull, z.string().trim().nullable());
}

const optionalEmail = z.preprocess(
	blankToNull,
	z
		.string()
		.trim()
		.email('Enter a valid email address.')
		.transform((value) => value.toLowerCase())
		.nullable()
);

export const customerFormSchema = z.object({
	caption: z
		.string()
		.trim()
		.min(1, 'Enter a customer caption.')
		.max(200, 'Keep the caption to 200 characters or fewer.')
		.transform((value) => value.replace(/\s+/g, ' ')),
	contactName: optionalString(),
	email: optionalEmail,
	phone: optionalText(40, 'Keep the phone number to 40 characters or fewer.'),
	addressLine1: optionalString(),
	addressLine2: optionalString(),
	town: optionalString(),
	postcode: optionalString(),
	preferredChannel: z.enum(PREFERRED_CHANNELS)
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export interface CustomerInputDraft {
	caption?: string;
	contactName?: string | null;
	email?: string | null;
	phone?: string | null;
	addressLine1?: string | null;
	addressLine2?: string | null;
	town?: string | null;
	postcode?: string | null;
	preferredChannel?: PreferredChannel;
}

/**
 * Only the keys that were supplied are returned, so an update patch never
 * clears a field the caller did not mention (`undefined` means "leave as is",
 * an explicit `null` means "clear").
 */
export type NormalisedCustomerInput = CustomerInputDraft;

function collapseText(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

function collapseOrNull(value: string | null): string | null {
	if (value === null) return null;
	const collapsed = collapseText(value);
	return collapsed.length > 0 ? collapsed : null;
}

/** Pure, storage-free normalisation shared by the mock repository and tests. */
export function normaliseCustomerInput(input: CustomerInputDraft): NormalisedCustomerInput {
	const result: NormalisedCustomerInput = {};

	if (input.caption !== undefined) result.caption = collapseText(input.caption);
	if (input.contactName !== undefined) result.contactName = collapseOrNull(input.contactName);
	if (input.email !== undefined) result.email = normaliseEmail(input.email);
	if (input.phone !== undefined) result.phone = normalisePhone(input.phone);
	if (input.addressLine1 !== undefined) result.addressLine1 = collapseOrNull(input.addressLine1);
	if (input.addressLine2 !== undefined) result.addressLine2 = collapseOrNull(input.addressLine2);
	if (input.town !== undefined) result.town = collapseOrNull(input.town);
	if (input.postcode !== undefined) result.postcode = normalisePostcode(input.postcode);
	if (input.preferredChannel !== undefined) result.preferredChannel = input.preferredChannel;

	return result;
}

/** First message per field, keyed by the schema path. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.') || 'form';
		if (!(key in errors)) errors[key] = issue.message;
	}
	return errors;
}
