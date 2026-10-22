/**
 * Presentation formatting only (DESIGN §4.3).
 *
 * Money arrives as integer pence, dimensions as integer millimetres.
 * Nothing here is allowed to decide business rules, and nothing here may
 * throw on bad user/API data: unparseable dates render as an em dash.
 *
 * Tabular figures are a CSS concern (`font-variant-numeric`), not this module.
 */

const LOCALE = 'en-GB';
const TIME_ZONE = 'Europe/London';
const EM_DASH = '\u2014';
const MINUS = '\u2212';
const THIN_SPACE = '\u2009';

const groupFormat = new Intl.NumberFormat(LOCALE, {
	useGrouping: true,
	maximumFractionDigits: 0
});

const percentFormat = new Intl.NumberFormat(LOCALE, {
	maximumFractionDigits: 1,
	minimumFractionDigits: 0
});

const countFormat = new Intl.NumberFormat(LOCALE, {
	maximumFractionDigits: 0
});

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
	day: '2-digit',
	month: 'short',
	year: 'numeric',
	timeZone: TIME_ZONE
});

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
	day: '2-digit',
	month: 'short',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
	timeZone: TIME_ZONE
});

/** True minus sign (U+2212), never an ASCII hyphen or parentheses. */
function withTrueMinus(value: string): string {
	return value.startsWith('-') ? `${MINUS}${value.slice(1)}` : value;
}

function toValidDate(value: string | Date): Date | null {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** `1248000` -> `£12,480.00`; `-48000` -> `−£480.00`. */
export function formatMoney(pence: number): string {
	if (!Number.isFinite(pence)) return EM_DASH;

	const rounded = Math.round(pence);
	const absolute = Math.abs(rounded);
	const pounds = Math.floor(absolute / 100);
	const minor = absolute % 100;
	const sign = rounded < 0 ? MINUS : '';

	return `${sign}£${groupFormat.format(pounds)}.${String(minor).padStart(2, '0')}`;
}

/** `2400` -> `2 400 mm` (thin spaces, U+2009). */
export function formatDimension(mm: number): string {
	if (!Number.isFinite(mm)) return EM_DASH;

	const rounded = Math.round(mm);
	const absolute = Math.abs(rounded);
	const grouped = groupFormat.format(absolute).split(',').join(THIN_SPACE);
	const sign = rounded < 0 ? MINUS : '';

	return `${sign}${grouped}${THIN_SPACE}mm`;
}

/** `2026-10-22T...` -> `22 Oct 2026`, Europe/London. */
export function formatDate(iso: string | Date): string {
	const date = toValidDate(iso);
	return date ? dateFormat.format(date) : EM_DASH;
}

/** `2026-10-22T...` -> `22 Oct 2026, 14:05`, Europe/London. */
export function formatDateTime(iso: string | Date): string {
	const date = toValidDate(iso);
	return date ? dateTimeFormat.format(date) : EM_DASH;
}

/** `32.5` -> `32.5 %`; `32` -> `32 %`. */
export function formatPercent(value: number): string {
	if (!Number.isFinite(value)) return EM_DASH;

	return `${withTrueMinus(percentFormat.format(value))}${THIN_SPACE}%`;
}

/** `1284` -> `1,284` (locale grouping). */
export function formatCount(value: number): string {
	if (!Number.isFinite(value)) return EM_DASH;

	return countFormat.format(value);
}
