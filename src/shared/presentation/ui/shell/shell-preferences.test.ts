import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	readDensity,
	readSidebarCollapsed,
	writeDensity,
	writeSidebarCollapsed
} from './shell-preferences';

/** Minimal in-memory Storage so the helper can be tested outside a browser. */
class MemoryStorage implements Storage {
	#items = new Map<string, string>();

	get length(): number {
		return this.#items.size;
	}

	clear(): void {
		this.#items.clear();
	}

	getItem(key: string): string | null {
		return this.#items.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.#items.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.#items.delete(key);
	}

	setItem(key: string, value: string): void {
		this.#items.set(key, value);
	}
}

function installStorage(storage: Storage | undefined): void {
	Object.defineProperty(globalThis, 'localStorage', {
		value: storage,
		configurable: true,
		writable: true
	});
}

beforeEach(() => {
	installStorage(new MemoryStorage());
});

afterEach(() => {
	installStorage(undefined);
});

describe('sidebar preference', () => {
	it('defaults to expanded when nothing is stored', () => {
		expect(readSidebarCollapsed('user-1')).toBe(false);
	});

	it('round-trips a collapsed sidebar per user', () => {
		writeSidebarCollapsed('user-1', true);
		expect(readSidebarCollapsed('user-1')).toBe(true);
		expect(readSidebarCollapsed('user-2')).toBe(false);

		writeSidebarCollapsed('user-1', false);
		expect(readSidebarCollapsed('user-1')).toBe(false);
	});

	it('stores booleans as JSON under the documented key', () => {
		writeSidebarCollapsed('user-1', true);
		expect(localStorage.getItem('interio.ui.user-1.sidebar')).toBe('true');
	});

	it('falls back to expanded when the stored payload is corrupt', () => {
		localStorage.setItem('interio.ui.user-1.sidebar', '{not json');
		expect(readSidebarCollapsed('user-1')).toBe(false);

		localStorage.setItem('interio.ui.user-1.sidebar', '"collapsed"');
		expect(readSidebarCollapsed('user-1')).toBe(false);
	});

	it('ignores an empty user id', () => {
		writeSidebarCollapsed('', true);
		expect(localStorage.length).toBe(0);
		expect(readSidebarCollapsed('')).toBe(false);
	});
});

describe('density preference', () => {
	it('defaults to comfortable', () => {
		expect(readDensity('user-1')).toBe('comfortable');
	});

	it('round-trips compact and comfortable per user', () => {
		writeDensity('user-1', 'compact');
		expect(readDensity('user-1')).toBe('compact');
		expect(readDensity('user-2')).toBe('comfortable');

		writeDensity('user-1', 'comfortable');
		expect(readDensity('user-1')).toBe('comfortable');
	});

	it('stores the density as JSON under the documented key', () => {
		writeDensity('user-1', 'compact');
		expect(localStorage.getItem('interio.ui.user-1.density')).toBe('"compact"');
	});

	it('rejects unknown values and corrupt payloads', () => {
		localStorage.setItem('interio.ui.user-1.density', '"dense"');
		expect(readDensity('user-1')).toBe('comfortable');

		localStorage.setItem('interio.ui.user-1.density', 'compact');
		expect(readDensity('user-1')).toBe('comfortable');
	});
});

describe('missing storage', () => {
	it('reads defaults and writes nothing without throwing', () => {
		installStorage(undefined);

		expect(readSidebarCollapsed('user-1')).toBe(false);
		expect(readDensity('user-1')).toBe('comfortable');
		expect(() => writeSidebarCollapsed('user-1', true)).not.toThrow();
		expect(() => writeDensity('user-1', 'compact')).not.toThrow();
	});
});
