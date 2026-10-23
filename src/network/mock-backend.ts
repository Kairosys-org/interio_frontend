/**
 * Browser-only, versioned localStorage database backing every mock adapter.
 * It behaves like a small server: collections persist across reloads, seeders
 * merge instead of overwriting, and readers receive clones.
 */
export const MOCK_DB_SCHEMA_VERSION = 3;

const MOCK_DB_STORAGE_KEY = 'interio_mock_db_v1';
const DEMO_SEEDED_AT = '2026-10-22T09:00:00.000Z';

export interface MockDbEnvelope {
	schemaVersion: number;
	seededAt: string;
	data: Record<string, unknown[]>;
}

export const MIGRATIONS: Record<number, (db: MockDbEnvelope) => MockDbEnvelope> = {
	/**
	 * v1 → v2 (Phase 1 records spine). The six new collections are absent from
	 * a v1 envelope and `readMockDb` seeds them on first read, so the migration
	 * only has to keep existing rows and stamp the new version. No collection
	 * shape changed, so nothing is rewritten or dropped.
	 */
	1: (db) => db,
	/**
	 * v2 → v3 (Phase 2 survey capture). The survey, asset and outbox
	 * collections are absent from a v2 envelope and `readMockDb` seeds them on
	 * the first read, so existing Phase 0/1 rows are kept and only the version
	 * is stamped. No earlier collection shape changed.
	 */
	2: (db) => db
};

export type Seeder = () => Record<string, unknown[]>;

const seeders: Seeder[] = [];
let cachedSeed: Record<string, unknown[]> | null = null;

function requireStorage(): Storage {
	const storage = (globalThis as { localStorage?: Storage }).localStorage;
	if (!storage) {
		throw new Error(
			'The mock backend is browser-only. localStorage is unavailable in this environment.'
		);
	}
	return storage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function deepClone<T>(value: T): T {
	return structuredClone(value);
}

function buildSeed(): Record<string, unknown[]> {
	if (cachedSeed) return cachedSeed;

	const merged: Record<string, unknown[]> = {};
	for (const seeder of seeders) {
		const seed = seeder();
		for (const [name, rows] of Object.entries(seed)) {
			merged[name] = [...(merged[name] ?? []), ...rows];
		}
	}

	cachedSeed = merged;
	return merged;
}

function parseEnvelope(raw: string | null): MockDbEnvelope | null {
	if (!raw) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
	if (!isRecord(parsed)) return null;

	const { schemaVersion, seededAt, data } = parsed;
	if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 0) {
		return null;
	}
	if (typeof seededAt !== 'string' || seededAt.length === 0) return null;
	if (!isRecord(data)) return null;

	const collections: Record<string, unknown[]> = {};
	for (const [name, rows] of Object.entries(data)) {
		if (!Array.isArray(rows)) return null;
		collections[name] = rows;
	}

	return { schemaVersion, seededAt, data: collections };
}

function writeMockDb(db: MockDbEnvelope): void {
	requireStorage().setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(db));
}

function applyMigrations(db: MockDbEnvelope): MockDbEnvelope {
	let current = db;
	for (let version = current.schemaVersion; version < MOCK_DB_SCHEMA_VERSION; version += 1) {
		const migrate = MIGRATIONS[version];
		if (migrate) current = migrate(current);
		current = { ...current, schemaVersion: version + 1 };
	}
	return current;
}

/** Registers a seed source. Seeder outputs are merged per collection key. */
export function registerSeeder(fn: Seeder): void {
	if (!seeders.includes(fn)) seeders.push(fn);
	cachedSeed = null;
}

export function getMockDbStorageKey(): string {
	return MOCK_DB_STORAGE_KEY;
}

export function readMockDb(): MockDbEnvelope {
	const storage = requireStorage();
	const stored = parseEnvelope(storage.getItem(MOCK_DB_STORAGE_KEY));
	let db = stored;
	let dirty = false;

	if (!db) {
		db = { schemaVersion: MOCK_DB_SCHEMA_VERSION, seededAt: DEMO_SEEDED_AT, data: {} };
		dirty = true;
	} else if (db.schemaVersion > MOCK_DB_SCHEMA_VERSION) {
		// A future schema cannot be downgraded safely: rebuild from seed.
		db = { ...db, schemaVersion: MOCK_DB_SCHEMA_VERSION, data: {} };
		dirty = true;
	} else if (db.schemaVersion < MOCK_DB_SCHEMA_VERSION) {
		db = applyMigrations(db);
		dirty = true;
	}

	const seed = buildSeed();
	const data: Record<string, unknown[]> = { ...db.data };
	for (const [name, rows] of Object.entries(seed)) {
		if (!(name in data)) {
			data[name] = deepClone(rows);
			dirty = true;
		}
	}

	const next: MockDbEnvelope = {
		schemaVersion: MOCK_DB_SCHEMA_VERSION,
		seededAt: db.seededAt,
		data
	};
	if (dirty) writeMockDb(next);
	return next;
}

export function ensureMockDb(): void {
	readMockDb();
}

export function getCollection<T>(name: string): T[] {
	const rows = readMockDb().data[name] ?? [];
	return deepClone(rows) as T[];
}

export function setCollection<T>(name: string, rows: T[]): void {
	const db = readMockDb();
	db.data[name] = deepClone(rows) as unknown[];
	writeMockDb(db);
}

export function updateCollection<T>(name: string, fn: (rows: T[]) => T[]): void {
	const current = getCollection<T>(name);
	setCollection(name, fn(current));
}

export function resetMockDb(): void {
	requireStorage().removeItem(MOCK_DB_STORAGE_KEY);
	void import('./token-storage').then(({ clearTokens }) => {
		clearTokens();
	});
}
