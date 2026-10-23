/**
 * Checklist presentation contract (DESIGN §9.2, spec Part 9 §14).
 *
 * The drawer is generic: the surveys page maps `SurveyChecklist` onto these
 * rows, so the primitive never imports the feature module. A row is "fail"
 * only when it blocks the gated action; "pending" is not yet evaluated.
 */

export type ChecklistRowStatus = 'pass' | 'fail' | 'pending';

export interface ChecklistRow {
	id: string;
	label: string;
	status: ChecklistRowStatus;
	detail?: string | null;
	/** Jump target inside the page, e.g. `#room-3`. */
	href?: string | null;
	/** Defaults to true for `fail`; informational rows set false. */
	blocking?: boolean;
}

export interface ChecklistSection {
	id: string;
	label: string;
	rows: ChecklistRow[];
}
