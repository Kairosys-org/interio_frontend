import { describe, expect, it } from 'vitest';
import {
	formatCount,
	formatDate,
	formatDateTime,
	formatDimension,
	formatMoney,
	formatPercent
} from '$shared/lib/format';

const THIN_SPACE = '\u2009';
const MINUS = '\u2212';

describe('formatMoney', () => {
	it('formats integer pence as GBP with two decimals and grouping', () => {
		expect(formatMoney(1248000)).toBe('£12,480.00');
		expect(formatMoney(123456789)).toBe('£1,234,567.89');
		expect(formatMoney(5)).toBe('£0.05');
	});

	it('handles zero', () => {
		expect(formatMoney(0)).toBe('£0.00');
	});

	it('uses a true minus sign and never parentheses or an ASCII hyphen', () => {
		const negative = formatMoney(-48000);
		expect(negative).toBe(`${MINUS}£480.00`);
		expect(negative).not.toContain('(');
		expect(negative).not.toContain('-');
	});
});

describe('formatDimension', () => {
	it('groups millimetres with thin spaces and appends a thin space before mm', () => {
		expect(formatDimension(2400)).toBe(`2${THIN_SPACE}400${THIN_SPACE}mm`);
		expect(formatDimension(12500)).toBe(`12${THIN_SPACE}500${THIN_SPACE}mm`);
		expect(formatDimension(999)).toBe(`999${THIN_SPACE}mm`);
	});

	it('handles zero and negative dimensions', () => {
		expect(formatDimension(0)).toBe(`0${THIN_SPACE}mm`);
		expect(formatDimension(-1500)).toBe(`${MINUS}1${THIN_SPACE}500${THIN_SPACE}mm`);
	});
});

describe('formatDate', () => {
	it('formats ISO strings as en-GB day-month-year', () => {
		expect(formatDate('2026-10-22T09:00:00.000Z')).toBe('22 Oct 2026');
		expect(formatDate('2026-01-01T00:00:00.000Z')).toBe('01 Jan 2026');
	});

	it('accepts Date objects and respects the Europe/London calendar day', () => {
		expect(formatDate(new Date('2026-12-31T23:30:00.000Z'))).toBe('31 Dec 2026');
		expect(formatDate(new Date('2026-06-30T23:30:00.000Z'))).toBe('01 Jul 2026');
	});

	it('returns an em dash instead of throwing for unparseable dates', () => {
		expect(formatDate('not-a-date')).toBe('\u2014');
		expect(formatDate(new Date('invalid'))).toBe('\u2014');
		expect(formatDate('')).toBe('\u2014');
	});
});

describe('formatDateTime', () => {
	it('formats winter dates in GMT', () => {
		expect(formatDateTime('2026-01-15T14:05:00.000Z')).toBe('15 Jan 2026, 14:05');
		expect(formatDateTime('2026-01-15T00:00:00.000Z')).toBe('15 Jan 2026, 00:00');
	});

	it('formats British Summer Time dates one hour ahead', () => {
		expect(formatDateTime('2026-07-01T12:05:00.000Z')).toBe('01 Jul 2026, 13:05');
		expect(formatDateTime('2026-07-01T12:00:00.000Z')).toBe('01 Jul 2026, 13:00');
	});

	it('returns an em dash for invalid dates', () => {
		expect(formatDateTime('2026-13-45T00:00:00.000Z')).toBe('\u2014');
		expect(formatDateTime('nope')).toBe('\u2014');
	});
});

describe('formatPercent', () => {
	it('keeps one decimal only when the value is not exact', () => {
		expect(formatPercent(32.5)).toBe(`32.5${THIN_SPACE}%`);
		expect(formatPercent(32)).toBe(`32${THIN_SPACE}%`);
		expect(formatPercent(0)).toBe(`0${THIN_SPACE}%`);
		expect(formatPercent(100)).toBe(`100${THIN_SPACE}%`);
	});

	it('uses a true minus sign for negative percentages', () => {
		expect(formatPercent(-12.5)).toBe(`${MINUS}12.5${THIN_SPACE}%`);
	});
});

describe('formatCount', () => {
	it('uses the locale group separator', () => {
		expect(formatCount(1284)).toBe('1,284');
		expect(formatCount(1234567)).toBe('1,234,567');
	});

	it('handles zero', () => {
		expect(formatCount(0)).toBe('0');
	});
});
