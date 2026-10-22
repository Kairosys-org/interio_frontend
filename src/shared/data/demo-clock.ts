/** Deterministic demo clock: seed data must be identical on every run. */
const DEMO_NOW_ISO = '2026-10-22T09:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;

export function demoNow(): Date {
	return new Date(DEMO_NOW_ISO);
}

export function demoDays(n: number): string {
	return new Date(demoNow().getTime() - n * DAY_MS).toISOString();
}

export function demoMonths(n: number): string {
	const date = demoNow();
	date.setUTCMonth(date.getUTCMonth() - n);
	return date.toISOString();
}
