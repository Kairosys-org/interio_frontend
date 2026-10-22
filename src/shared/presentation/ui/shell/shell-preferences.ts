/**
 * Shell preferences (DESIGN §5.5): sidebar collapse and density are persisted
 * per user so a reload never resets the workspace. Storage access is guarded
 * and total: a missing, disabled or corrupt store always yields the default.
 */

export type Density = 'comfortable' | 'compact';

export const DEFAULT_DENSITY: Density = 'comfortable';

const KEY_PREFIX = 'interio.ui';

type PreferenceField = 'sidebar' | 'density';

function storageKey(userId: string, field: PreferenceField): string {
	return `${KEY_PREFIX}.${userId}.${field}`;
}

/** localStorage is absent during SSR and can throw in sandboxed frames. */
function store(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

function readRaw(userId: string, field: PreferenceField): string | null {
	if (!userId) return null;
	try {
		return store()?.getItem(storageKey(userId, field)) ?? null;
	} catch {
		return null;
	}
}

function writeRaw(userId: string, field: PreferenceField, value: string): void {
	if (!userId) return;
	try {
		store()?.setItem(storageKey(userId, field), value);
	} catch {
		// Quota, private mode or a disabled store: preferences stay in memory.
	}
}

/** JSON payloads are only trusted when they decode to the expected shape. */
function readJson(userId: string, field: PreferenceField): unknown {
	const raw = readRaw(userId, field);
	if (raw === null) return null;
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
}

export function readSidebarCollapsed(userId: string): boolean {
	return readJson(userId, 'sidebar') === true;
}

export function writeSidebarCollapsed(userId: string, value: boolean): void {
	writeRaw(userId, 'sidebar', JSON.stringify(value === true));
}

export function readDensity(userId: string): Density {
	const parsed = readJson(userId, 'density');
	return parsed === 'compact' || parsed === 'comfortable' ? parsed : DEFAULT_DENSITY;
}

export function writeDensity(userId: string, value: Density): void {
	writeRaw(userId, 'density', JSON.stringify(value === 'compact' ? 'compact' : DEFAULT_DENSITY));
}
