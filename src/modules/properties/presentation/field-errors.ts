import type { ZodError } from 'zod';

/**
 * Presentation-only mapping of zod issues to inline field errors.
 *
 * `properties/domain/validations.ts` does not export the shared helper the
 * other record modules ship, and the domain layer is owned by the data wave,
 * so the page keeps its own copy and reports the missing export to the
 * orchestrator. No rule lives here: the schema is authority.
 */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.') || 'form';
		if (!(key in errors)) errors[key] = issue.message;
	}
	return errors;
}
