import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	MIGRATIONS,
	MOCK_DB_SCHEMA_VERSION,
	ensureMockDb,
	getCollection,
	getMockDbStorageKey,
	readMockDb,
	registerSeeder,
	resetMockDb,
	setCollection,
	updateCollection
} from '../mock-backend';
import type { MockDbEnvelope } from '../mock-backend';

interface FixtureRow {
	id: string;
	label: string;
}

const DEMO_SEEDED_AT = '2026-10-22T09:00:00.000Z';

registerSeeder(() => ({
	merge_check: [
		{ id: 'seed-a-1', label: 'From seeder A' },
		{ id: 'seed-a-2', label: 'From seeder A' }
	],
	merge_other: [{ id: 'other-1', label: 'Other collection' }]
}));

registerSeeder(() => ({
	merge_check: [{ id: 'seed-b-1', label: 'From seeder B' }]
}));

function createMemoryStorage(): Storage {
	const values = new Map<string, string>();
	return {
		get length() {
			return values.size;
		},
		clear() {
			values.clear();
		},
		getItem(key: string) {
			return values.has(key) ? (values.get(key) ?? null) : null;
		},
		key(index: number) {
			return Array.from(values.keys())[index] ?? null;
		},
		removeItem(key: string) {
			values.delete(key);
		},
		setItem(key: string, value: string) {
			values.set(key, String(value));
		}
	};
}

function installStorage(): Storage {
	const storage = createMemoryStorage();
	(globalThis as { localStorage?: Storage }).localStorage = storage;
	return storage;
}

beforeEach(() => {
	installStorage();
	resetMockDb();
});

afterEach(() => {
	delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('mock backend seeding', () => {
	it('merges arrays emitted by several seeders for the same collection', () => {
		ensureMockDb();

		const merged = getCollection<FixtureRow>('merge_check');
		expect(merged.map((row) => row.id)).toEqual(['seed-a-1', 'seed-a-2', 'seed-b-1']);
		expect(getCollection<FixtureRow>('merge_other')).toHaveLength(1);
	});

	it('uses a deterministic seededAt timestamp', () => {
		const first = readMockDb();
		expect(first.seededAt).toBe(DEMO_SEEDED_AT);
		expect(first.schemaVersion).toBe(MOCK_DB_SCHEMA_VERSION);

		resetMockDb();
		const second = readMockDb();
		expect(second.seededAt).toBe(first.seededAt);
	});

	it('returns deep clones so callers cannot mutate stored data', () => {
		const rows = getCollection<FixtureRow>('merge_check');
		rows[0].label = 'mutated';
		rows.push({ id: 'injected', label: 'Injected' });

		const reloaded = getCollection<FixtureRow>('merge_check');
		expect(reloaded.map((row) => row.id)).toEqual(['seed-a-1', 'seed-a-2', 'seed-b-1']);
		expect(reloaded[0].label).toBe('From seeder A');

		const payload: FixtureRow[] = [{ id: 'custom-1', label: 'Custom' }];
		setCollection('custom_rows', payload);
		payload[0].label = 'mutated after write';

		expect(getCollection<FixtureRow>('custom_rows')[0].label).toBe('Custom');
	});
});

describe('mock backend reset and migrations', () => {
	it('replaces rows through updateCollection', () => {
		updateCollection<FixtureRow>('custom_rows', (rows) => [
			...rows,
			{ id: 'added', label: 'Added' }
		]);

		expect(getCollection<FixtureRow>('custom_rows').map((row) => row.id)).toEqual(['added']);
	});

	it('resetMockDb clears persisted data and drops custom collections', () => {
		setCollection('temp_rows', [{ id: 'temp-1', label: 'Temporary' }]);
		expect(globalThis.localStorage.getItem(getMockDbStorageKey())).not.toBeNull();

		resetMockDb();

		expect(globalThis.localStorage.getItem(getMockDbStorageKey())).toBeNull();
		expect(getCollection<FixtureRow>('temp_rows')).toEqual([]);
		expect(getCollection<FixtureRow>('merge_check').length).toBeGreaterThan(0);
	});

	it('declares a migration map and upgrades older schema versions', () => {
		expect(MOCK_DB_SCHEMA_VERSION).toBe(1);
		expect(typeof MIGRATIONS).toBe('object');
		expect(typeof MIGRATIONS).not.toBe('function');

		globalThis.localStorage.setItem(
			getMockDbStorageKey(),
			JSON.stringify({
				schemaVersion: 0,
				seededAt: '2020-01-01T00:00:00.000Z',
				data: { legacy_rows: [{ id: 'legacy-1', label: 'Legacy' }] }
			})
		);

		MIGRATIONS[0] = (db: MockDbEnvelope): MockDbEnvelope => ({
			...db,
			data: { ...db.data, legacy_rows: [...(db.data.legacy_rows ?? []), { id: 'migrated' }] }
		});

		try {
			const upgraded = readMockDb();
			expect(upgraded.schemaVersion).toBe(MOCK_DB_SCHEMA_VERSION);
			expect(upgraded.seededAt).toBe('2020-01-01T00:00:00.000Z');
			expect(upgraded.data.legacy_rows).toHaveLength(2);
			expect(upgraded.data.merge_check).toHaveLength(3);
		} finally {
			delete MIGRATIONS[0];
		}
	});

	it('is browser-only and throws a clear error without localStorage', () => {
		delete (globalThis as { localStorage?: Storage }).localStorage;

		expect(() => readMockDb()).toThrow(/browser-only/);
	});
});
