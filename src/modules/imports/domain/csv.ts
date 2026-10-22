import type { Uuid } from '$shared/domain/uuid';
import {
	customerMatchReasons,
	normaliseAddressLine,
	normaliseCaption,
	normaliseEmail,
	projectMatchReasons,
	propertyMatchReasons
} from '$shared/domain/dedup';
import {
	PREFERRED_CHANNELS,
	PROJECT_TYPES,
	type ImportKind,
	type ImportValidation,
	type PreferredChannel,
	type ProjectType
} from '$shared/domain/record-states';

/**
 * CSV parsing, column suggestion and row validation (architecture §2 domain
 * parsers, spec Part 10 §26, phase-1 §4.1).
 *
 * Everything here is pure: no storage, no network, no mock backend. The mock
 * server and the import wizard call the same functions, so the preview the
 * user sees is exactly what `create` persists.
 */

export class CsvParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CsvParseError';
	}
}

export interface ParsedCsv {
	headers: string[];
	rows: string[][];
}

const UNCLOSED_QUOTE =
	'The file has an unclosed quoted value. Check the quotation marks and try again.';
const NO_HEADER = 'That file has no header row. Add a heading row and try again.';
const NO_DATA = 'That file has no data rows. Add at least one row below the headings.';
const EMPTY_HEADER = 'Every column needs a heading. Add a heading to each column and try again.';

/**
 * RFC 4180-style parser: UTF-8, comma separated, optional BOM, CRLF or LF,
 * quoted fields with `""` escapes and newlines inside quotes.
 */
export function parseCsv(text: string): ParsedCsv {
	const source = typeof text === 'string' ? text.replace(/^\uFEFF/, '') : '';
	const records: string[][] = [];
	let field = '';
	let row: string[] = [];
	let inQuotes = false;

	for (let index = 0; index < source.length; index += 1) {
		const character = source[index];

		if (inQuotes) {
			if (character === '"') {
				if (source[index + 1] === '"') {
					field += '"';
					index += 1;
				} else {
					inQuotes = false;
				}
			} else {
				field += character;
			}
			continue;
		}

		if (character === '"' && field.length === 0) {
			inQuotes = true;
			continue;
		}
		if (character === ',') {
			row.push(field);
			field = '';
			continue;
		}
		if (character === '\r' || character === '\n') {
			if (character === '\r' && source[index + 1] === '\n') index += 1;
			row.push(field);
			records.push(row);
			row = [];
			field = '';
			continue;
		}
		field += character;
	}

	if (inQuotes) throw new CsvParseError(UNCLOSED_QUOTE);
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		records.push(row);
	}

	const headerRow = records[0];
	if (!headerRow) throw new CsvParseError(NO_HEADER);

	const headers = headerRow.map((header) => header.trim());
	if (headers.some((header) => header.length === 0)) throw new CsvParseError(EMPTY_HEADER);

	const rows = records.slice(1).filter((cells) => cells.some((cell) => cell.trim().length > 0));
	if (rows.length === 0) throw new CsvParseError(NO_DATA);

	return { headers, rows };
}

/** Turns positional rows into header-keyed records before validation. */
export function rowsToRecords(
	headers: readonly string[],
	rows: ReadonlyArray<readonly string[]>
): Array<Record<string, string>> {
	return rows.map((cells) => {
		const record: Record<string, string> = {};
		headers.forEach((header, index) => {
			record[header] = cells[index] ?? '';
		});
		return record;
	});
}

/* ------------------------------------------------------------------ */
/* Field catalog.                                                     */
/* ------------------------------------------------------------------ */

export interface ImportField {
	key: string;
	label: string;
	required: boolean;
}

const CUSTOMER_FIELDS: readonly ImportField[] = [
	{ key: 'caption', label: 'Caption', required: true },
	{ key: 'contact_name', label: 'Contact name', required: false },
	{ key: 'email', label: 'Email', required: false },
	{ key: 'phone', label: 'Phone', required: false },
	{ key: 'address_line1', label: 'Address line 1', required: false },
	{ key: 'address_line2', label: 'Address line 2', required: false },
	{ key: 'town', label: 'Town', required: false },
	{ key: 'postcode', label: 'Postcode', required: false },
	{ key: 'preferred_channel', label: 'Preferred channel', required: false }
];

const PROPERTY_FIELDS: readonly ImportField[] = [
	{ key: 'customer_email', label: 'Customer email', required: true },
	{ key: 'address_line1', label: 'Address line 1', required: true },
	{ key: 'address_line2', label: 'Address line 2', required: false },
	{ key: 'town', label: 'Town', required: false },
	{ key: 'postcode', label: 'Postcode', required: false },
	{ key: 'access_notes', label: 'Access notes', required: false }
];

const PROJECT_FIELDS: readonly ImportField[] = [
	{ key: 'customer_email', label: 'Customer email', required: true },
	{ key: 'property_address', label: 'Property address', required: true },
	{ key: 'caption', label: 'Caption', required: true },
	{ key: 'project_type', label: 'Project type', required: true }
];

export const IMPORT_FIELDS: Readonly<Record<ImportKind, readonly ImportField[]>> = Object.freeze({
	customer: CUSTOMER_FIELDS,
	property: PROPERTY_FIELDS,
	project: PROJECT_FIELDS
});

/* ------------------------------------------------------------------ */
/* Column suggestion.                                                 */
/* ------------------------------------------------------------------ */

/** Lowercase, non-alphanumerics to `_`, no leading/trailing/duplicate `_`. */
export function normaliseHeader(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

const SHARED_ALIASES: Readonly<Record<string, readonly string[]>> = {
	town: ['city', 'locality'],
	postcode: ['post_code', 'zip', 'zip_code'],
	address_line2: ['address_2', 'line2', 'line_2'],
	email: ['email_address', 'e_mail', 'mail'],
	phone: ['phone_number', 'telephone', 'tel', 'mobile']
};

const KIND_ALIASES: Readonly<Record<ImportKind, Readonly<Record<string, readonly string[]>>>> = {
	customer: {
		caption: ['name', 'customer_name', 'customer', 'title', 'account', 'account_name'],
		contact_name: ['contact', 'contact_person', 'full_name'],
		address_line1: ['address', 'address_1', 'address1', 'line1', 'line_1', 'street'],
		preferred_channel: [
			'channel',
			'preferred_contact',
			'preferred_contact_method',
			'contact_preference'
		]
	},
	property: {
		customer_email: ['customer_email_address', 'customer_mail', 'customer_e_mail', 'email'],
		address_line1: ['address', 'address_1', 'address1', 'line1', 'line_1', 'street'],
		town: ['city', 'locality'],
		access_notes: ['access', 'notes', 'access_instructions']
	},
	project: {
		customer_email: ['customer_email_address', 'customer_mail', 'customer_e_mail', 'email'],
		property_address: ['property', 'site_address', 'address'],
		caption: ['name', 'project_name', 'title', 'job_name'],
		project_type: ['type', 'job_type', 'category']
	}
};

/** Header → canonical field key. Unknown headers are left out of the map. */
export function suggestColumnMap(
	kind: ImportKind,
	headers: readonly string[]
): Record<string, string> {
	const fields = IMPORT_FIELDS[kind];
	const fieldKeys = new Set(fields.map((field) => field.key));
	const aliases = KIND_ALIASES[kind];
	const map: Record<string, string> = {};

	for (const header of headers) {
		const normalised = normaliseHeader(header);
		if (normalised.length === 0) continue;

		if (fieldKeys.has(normalised)) {
			map[header] = normalised;
			continue;
		}

		const kindMatch = Object.entries(aliases).find(([, candidates]) =>
			candidates.includes(normalised)
		);
		if (kindMatch) {
			map[header] = kindMatch[0];
			continue;
		}

		const sharedMatch = Object.entries(SHARED_ALIASES).find(([key, candidates]) => {
			if (!fieldKeys.has(key)) return false;
			return candidates.includes(normalised);
		});
		if (sharedMatch) map[header] = sharedMatch[0];
	}

	return map;
}

/* ------------------------------------------------------------------ */
/* Row validation.                                                    */
/* ------------------------------------------------------------------ */

export interface ImportCustomerMatch {
	id: Uuid;
	caption: string;
	email: string | null;
	phone: string | null;
	postcode: string | null;
}

export interface ImportPropertyMatch {
	id: Uuid;
	addressLine1: string;
	town: string | null;
	postcode: string | null;
}

export interface ImportProjectMatch {
	id: Uuid;
	propertyId: Uuid;
	projectType: string;
	caption: string;
}

/** Tenant-scoped records the validator may match against (never storage). */
export interface ImportMatchContext {
	customers: readonly ImportCustomerMatch[];
	properties: readonly ImportPropertyMatch[];
	projects: readonly ImportProjectMatch[];
}

export interface ParsedImportRow {
	rowNo: number;
	payload: Record<string, string>;
	validation: ImportValidation;
	error: string | null;
	matchId: Uuid | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimmed(payload: Record<string, string>, key: string): string {
	return (payload[key] ?? '').trim();
}

function nullish(value: string): string | null {
	return value.length > 0 ? value : null;
}

function fullAddress(property: ImportPropertyMatch): string {
	return [property.addressLine1, property.town, property.postcode]
		.filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
		.join(', ');
}

function findCustomerByEmail(
	context: ImportMatchContext,
	email: string
): ImportCustomerMatch | null {
	const needle = normaliseEmail(email);
	if (needle === null) return null;
	return context.customers.find((customer) => normaliseEmail(customer.email) === needle) ?? null;
}

function findPropertyByAddress(
	context: ImportMatchContext,
	address: string
): ImportPropertyMatch | null {
	const line = normaliseAddressLine(address);
	const full = normaliseCaption(address);
	return (
		context.properties.find((property) => normaliseAddressLine(property.addressLine1) === line) ??
		context.properties.find((property) => normaliseCaption(fullAddress(property)) === full) ??
		null
	);
}

function reject(rowNo: number, payload: Record<string, string>, error: string): ParsedImportRow {
	return { rowNo, payload, validation: 'rejected', error, matchId: null };
}

function readyOrReview(
	rowNo: number,
	payload: Record<string, string>,
	matchId: Uuid | null
): ParsedImportRow {
	if (matchId === null) {
		return { rowNo, payload, validation: 'ready', error: null, matchId: null };
	}
	return { rowNo, payload, validation: 'needs_review', error: null, matchId };
}

/**
 * Validates already parsed rows against the kind's field catalog.
 *
 * `rowNo` is 1-based and refers to the first data row, matching the preview
 * table. The payload keeps the parsed values verbatim so the detail page can
 * show exactly what the file contained.
 */
export function validateImportRows(
	kind: ImportKind,
	rows: ReadonlyArray<Readonly<Record<string, string>>>,
	columnMap: Readonly<Record<string, string>>,
	context: ImportMatchContext
): ParsedImportRow[] {
	const fields = IMPORT_FIELDS[kind];
	const mappedKeys = new Set(Object.values(columnMap));

	return rows.map((record, index) => {
		const rowNo = index + 1;
		const payload: Record<string, string> = {};
		for (const field of fields) {
			if (!mappedKeys.has(field.key)) continue;
			const header = Object.entries(columnMap).find(([, key]) => key === field.key)?.[0];
			payload[field.key] = header === undefined ? '' : (record[header] ?? '');
		}

		for (const field of fields.filter((entry) => entry.required)) {
			if (trimmed(payload, field.key).length === 0) {
				return reject(rowNo, payload, `${field.label} is required.`);
			}
		}

		const emailField = kind === 'customer' ? 'email' : 'customer_email';
		const email = trimmed(payload, emailField);
		if (email.length > 0 && !EMAIL_PATTERN.test(email)) {
			return reject(rowNo, payload, 'Enter a valid email address.');
		}

		if (kind === 'customer') {
			const channel = trimmed(payload, 'preferred_channel').toLowerCase();
			if (channel.length > 0 && !PREFERRED_CHANNELS.includes(channel as PreferredChannel)) {
				return reject(rowNo, payload, 'Choose a preferred channel: email, phone, sms or none.');
			}

			const match = context.customers.find(
				(customer) =>
					customerMatchReasons(
						{
							caption: trimmed(payload, 'caption'),
							email: nullish(trimmed(payload, 'email')),
							phone: nullish(trimmed(payload, 'phone')),
							postcode: nullish(trimmed(payload, 'postcode'))
						},
						customer
					).length > 0
			);
			return readyOrReview(rowNo, payload, match?.id ?? null);
		}

		if (kind === 'property') {
			const customer = findCustomerByEmail(context, email);
			if (!customer) {
				return reject(rowNo, payload, 'No customer matches that email address.');
			}

			const match = context.properties.find(
				(property) =>
					propertyMatchReasons(
						{
							addressLine1: trimmed(payload, 'address_line1'),
							postcode: nullish(trimmed(payload, 'postcode'))
						},
						property
					).length > 0
			);
			return readyOrReview(rowNo, payload, match?.id ?? null);
		}

		const customer = findCustomerByEmail(context, email);
		if (!customer) {
			return reject(rowNo, payload, 'No customer matches that email address.');
		}

		const projectType = trimmed(payload, 'project_type').toLowerCase();
		if (!PROJECT_TYPES.includes(projectType as ProjectType)) {
			return reject(
				rowNo,
				payload,
				'Choose a project type: kitchen, bedroom, bathroom, whole house, commercial or other.'
			);
		}

		const property = findPropertyByAddress(context, trimmed(payload, 'property_address'));
		if (!property) {
			return reject(rowNo, payload, 'No property matches that address.');
		}

		const match = context.projects.find(
			(project) =>
				projectMatchReasons(
					{
						propertyId: property.id,
						projectType,
						caption: trimmed(payload, 'caption')
					},
					project
				).length > 0
		);
		return readyOrReview(rowNo, payload, match?.id ?? null);
	});
}
