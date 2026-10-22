import { describe, expect, it } from 'vitest';
import { isUuid } from '$shared/domain/uuid';
import {
	DETERMINISTIC_UUID_NAMESPACE,
	deterministicUuid,
	hashString,
	seededRng
} from '$shared/lib/deterministic';

describe('hashString', () => {
	it('matches the FNV-1a 32-bit vector for "hello"', () => {
		expect(hashString('hello')).toBe(0x4f9f2cab);
		expect(hashString('hello')).toBe(1335831723);
	});

	it('is stable and unsigned for ASCII and unicode input', () => {
		expect(hashString('survey:42')).toBe(hashString('survey:42'));
		expect(hashString('café')).toBe(hashString('café'));
		expect(hashString('café')).toBeGreaterThanOrEqual(0);
		expect(hashString('café')).toBeLessThanOrEqual(0xffffffff);
	});

	it('separates different inputs and the empty string', () => {
		expect(hashString('a')).not.toBe(hashString('b'));
		expect(hashString('')).not.toBe(hashString('a'));
	});
});

describe('seededRng', () => {
	it('returns the same sequence for the same string seed', () => {
		const first = seededRng('interio-seed');
		const second = seededRng('interio-seed');
		const firstRun = [first(), first(), first(), first()];
		const secondRun = [second(), second(), second(), second()];

		expect(firstRun).toEqual(secondRun);
		expect(new Set(firstRun).size).toBe(4);
	});

	it('returns the same sequence for the same number seed', () => {
		const first = seededRng(20261022);
		const second = seededRng(20261022);
		expect([first(), first(), first()]).toEqual([second(), second(), second()]);
	});

	it('produces different sequences for different seeds', () => {
		const a = seededRng('alpha');
		const b = seededRng('beta');
		expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
	});

	it('stays inside [0, 1)', () => {
		const next = seededRng('range-check');
		for (let index = 0; index < 1000; index += 1) {
			const value = next();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe('deterministicUuid', () => {
	it('is a stable name-based UUID v5', () => {
		const uuid = deterministicUuid('survey:1');
		expect(uuid).toBe('f8905bca-201e-52a3-86dc-1198e9861b8a');
		expect(deterministicUuid('survey:1')).toBe(uuid);
	});

	it('sets the version and RFC 4122 variant bits, lowercase', () => {
		const uuid = deterministicUuid('part:12');
		expect(uuid).toHaveLength(36);
		expect(uuid).toBe(uuid.toLowerCase());
		expect(uuid.charAt(14)).toBe('5');
		expect(['8', '9', 'a', 'b']).toContain(uuid.charAt(19));
	});

	it('differs per name and is accepted by the domain guard', () => {
		const names = ['customer:1', 'property:1', 'project:1', 'job:1', 'part:1'];
		const uuids = names.map((name) => deterministicUuid(name));

		expect(new Set(uuids).size).toBe(names.length);
		for (const uuid of uuids) {
			expect(isUuid(uuid)).toBe(true);
		}
	});

	it('exposes a valid fixed namespace', () => {
		expect(isUuid(DETERMINISTIC_UUID_NAMESPACE)).toBe(true);
		expect(deterministicUuid('')).not.toBe(deterministicUuid(' '));
	});
});
