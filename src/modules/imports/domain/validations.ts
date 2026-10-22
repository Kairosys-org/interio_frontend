import { z } from 'zod';
import { IMPORT_KINDS } from '$shared/domain/record-states';
import type { ImportKind } from './types';
import { IMPORT_FIELDS } from './csv';

/**
 * Staging input gate (spec Part 10 §26, phase-1 §4.1).
 *
 * The wizard validates the same shape client-side, and the mock repository
 * validates it again because it behaves like the server. `rows` is the number
 * of parsed data rows: a header-only file is not a batch.
 */
export const importStageSchema = z.object({
	kind: z.enum(IMPORT_KINDS),
	fileName: z.string().trim().min(1, 'Choose a file to import.'),
	columnMap: z.record(z.string(), z.string()),
	rows: z.number().int().min(1, 'That file has no data rows.')
});

export type ImportStageValues = z.infer<typeof importStageSchema>;

/** Labels of the required fields that no column maps to, in catalog order. */
export function requiredFieldsMapped(
	kind: ImportKind,
	columnMap: Readonly<Record<string, string>>
): string[] {
	const mapped = new Set(Object.values(columnMap));
	return IMPORT_FIELDS[kind]
		.filter((field) => field.required && !mapped.has(field.key))
		.map((field) => field.label);
}
