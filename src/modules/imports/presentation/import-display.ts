import { PROJECT_TYPES, PROJECT_TYPE_LABELS } from '$shared/domain/record-states';
import type { ProjectType } from '$shared/domain/record-states';
import { formatCount } from '$shared/lib/format';
import type { ParsedImportRow } from '../domain/csv';
import type { ImportBatch, ImportKind } from '../domain/types';

/**
 * Display-only mappings for the imports module (DESIGN §4.3).
 *
 * Nothing here decides what an import does: it turns domain values into the
 * words and layouts the list, wizard and detail pages show. Kind labels are
 * plural because they name the collection the user is importing into.
 */

export const IMPORT_KIND_LABELS: Readonly<Record<ImportKind, string>> = Object.freeze({
	customer: 'Customers',
	property: 'Properties',
	project: 'Projects'
});

export const IMPORT_KIND_DESCRIPTIONS: Readonly<Record<ImportKind, string>> = Object.freeze({
	customer: 'Create customer records with contact details, address and preferred channel.',
	property: 'Create properties for customers who already exist, matched by email address.',
	project: 'Create projects for an existing customer and property, with a project type.'
});

const EM_DASH = '\u2014';

/** `1536` -> `1.5 KB`; unknown sizes render an em dash. */
export function formatFileSize(bytes: number | null): string {
	if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return EM_DASH;
	if (bytes < 1024) return `${Math.round(bytes)} B`;

	const kilobytes = bytes / 1024;
	if (kilobytes < 1024)
		return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;

	return `${(kilobytes / 1024).toFixed(1)} MB`;
}

export interface RowValues {
	primary: string;
	secondary: string | null;
}

function text(value: string | undefined): string {
	return (value ?? '').trim();
}

function valueOrDash(value: string | undefined): string {
	const trimmed = text(value);
	return trimmed.length > 0 ? trimmed : EM_DASH;
}

function joined(parts: ReadonlyArray<string | undefined>, separator = ' · '): string | null {
	const clean = parts.map(text).filter((part) => part.length > 0);
	return clean.length > 0 ? clean.join(separator) : null;
}

/** The two lines the preview and outcome tables show for a row's payload. */
export function rowValues(kind: ImportKind, payload: Readonly<Record<string, string>>): RowValues {
	if (kind === 'customer') {
		return {
			primary: valueOrDash(payload.caption),
			secondary: joined([payload.contact_name, payload.email])
		};
	}

	if (kind === 'property') {
		return {
			primary: valueOrDash(payload.address_line1),
			secondary:
				joined([payload.address_line2, payload.town, payload.postcode]) ??
				joined([payload.customer_email])
		};
	}

	const type = text(payload.project_type);
	const typeLabel = (PROJECT_TYPES as readonly string[]).includes(type)
		? PROJECT_TYPE_LABELS[type as ProjectType]
		: type;

	return {
		primary: valueOrDash(payload.caption),
		secondary: joined([payload.property_address, typeLabel])
	};
}

/** Row-count breakdown for the list's Rows column. */
export function batchRowBreakdown(batch: ImportBatch): string {
	if (batch.status === 'cancelled') return 'No records created';

	const parts: string[] = [];

	if (batch.status === 'staged') {
		if (batch.readyRows > 0) parts.push(`${formatCount(batch.readyRows)} ready`);
	} else if (batch.importedRows > 0) {
		parts.push(`${formatCount(batch.importedRows)} imported`);
	}

	if (batch.reviewRows > 0) parts.push(`${formatCount(batch.reviewRows)} for review`);
	if (batch.rejectedRows > 0) parts.push(`${formatCount(batch.rejectedRows)} rejected`);

	return parts.length > 0 ? parts.join(' · ') : 'No rows';
}

/** Reported by the preview so the wizard can gate the next step. */
export interface ImportPreviewState {
	status: 'loading' | 'error' | 'ready';
	rows: ParsedImportRow[];
	error: string | null;
}
