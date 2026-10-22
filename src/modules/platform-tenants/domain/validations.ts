import { z } from 'zod';

/**
 * Platform tenant provisioning and lifecycle forms.
 *
 * These schemas are the client-side gate only; the mock repository validates
 * the same input again because it behaves like the server (R4, architecture
 * §4.6). Messages are user-readable sentences (DESIGN §12.5).
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Empty form fields mean "not provided"; they never reach the server as `''`. */
function blankToUndefined(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

const optionalText = (max: number, message: string) =>
	z.preprocess(blankToUndefined, z.string().trim().max(max, message).optional());

const optionalAccent = z.preprocess(
	blankToUndefined,
	z.string().trim().regex(HEX_PATTERN, 'Enter a hex colour such as #8A5A2B.').optional()
);

const defaultCurrency = z.preprocess(
	blankToUndefined,
	z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z]{3}$/, 'Use a three-letter currency code.')
		.default('GBP')
);

export const tenantFormSchema = z.object({
	legalName: z
		.string()
		.trim()
		.min(2, 'Enter the legal name.')
		.max(120, 'Keep the legal name to 120 characters or fewer.'),
	slug: z
		.string()
		.trim()
		.min(3, 'Use at least 3 characters.')
		.max(32, 'Use 32 characters or fewer.')
		.regex(SLUG_PATTERN, 'Use lowercase letters, numbers and hyphens.'),
	displayName: optionalText(60, 'Keep the display name to 60 characters or fewer.'),
	accent: optionalAccent,
	defaultCurrency,
	vatNumber: optionalText(32, 'Keep the VAT number to 32 characters or fewer.'),
	referencePattern: optionalText(64, 'Keep the reference pattern to 64 characters or fewer.'),
	emailDomain: optionalText(255, 'Keep the email domain to 255 characters or fewer.'),
	adminEmail: z.string().trim().email('Enter a valid email address.')
});

export type TenantFormValues = z.infer<typeof tenantFormSchema>;

export const transitionFormSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(3, 'Enter a reason of at least 3 characters.')
		.max(200, 'Keep the reason to 200 characters or fewer.'),
	to: z.enum(['active', 'suspended', 'offboarded'])
});

export type TransitionFormValues = z.infer<typeof transitionFormSchema>;

/** First message per field, keyed by the schema path. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.') || 'form';
		if (!(key in errors)) errors[key] = issue.message;
	}
	return errors;
}

/** Re-exported for the mock, which mirrors `transitionFormSchema.to`. */
export const TENANT_TRANSITION_TARGETS = transitionFormSchema.shape.to.options;
