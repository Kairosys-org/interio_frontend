/**
 * Field-level comparison for R5 duplicate review (DESIGN §9.2
 * `DedupReviewModal`). Framework-free on purpose: the modal renders the
 * result, the comparison rules live here and are unit-tested.
 */

export interface DedupField {
	label: string;
	value: string;
}

export interface DedupFieldDiff {
	label: string;
	heldValue: string;
	candidateValue: string;
	different: boolean;
}

/** Case- and whitespace-insensitive; values are display strings, not keys. */
function normalise(value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Union of both field lists, held fields first in their captured order, then
 * any candidate-only field. `different` is true when the normalised values
 * differ, so a candidate that omits a field is always a difference.
 */
export function diffFields(
	held: readonly DedupField[],
	candidate: readonly DedupField[]
): DedupFieldDiff[] {
	const candidateValues = new Map<string, string>();
	for (const field of candidate) candidateValues.set(field.label, field.value);

	const compared = new Set<string>();
	const diffs: DedupFieldDiff[] = [];

	for (const field of held) {
		compared.add(field.label);
		const candidateValue = candidateValues.get(field.label) ?? '';
		diffs.push({
			label: field.label,
			heldValue: field.value,
			candidateValue,
			different: normalise(field.value) !== normalise(candidateValue)
		});
	}

	for (const field of candidate) {
		if (compared.has(field.label)) continue;
		compared.add(field.label);
		diffs.push({
			label: field.label,
			heldValue: '',
			candidateValue: field.value,
			different: normalise(field.value) !== ''
		});
	}

	return diffs;
}
