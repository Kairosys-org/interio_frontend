/**
 * Deterministic primitives for seeds and reproducible demo data.
 *
 * Everything here is synchronous and side-effect free. No `Math.random()`,
 * no `Date.now()`, no `crypto.subtle` (async) and no `crypto.randomUUID()` —
 * seeds must produce byte-identical data on every run, in every environment.
 */

/**
 * Fixed namespace for name-based UUIDs. Valid RFC-4122 UUID constant; it never
 * changes, because changing it would re-key every seeded entity id.
 */
export const DETERMINISTIC_UUID_NAMESPACE = '5f0c1a3e-7b2d-5e4a-8c9d-1a2b3c4d5e6f';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Stable FNV-1a (32-bit, UTF-8 bytes) hash as an unsigned integer. */
export function hashString(value: string): number {
	const bytes = new TextEncoder().encode(value);
	let hash = FNV_OFFSET_BASIS;

	for (let index = 0; index < bytes.length; index += 1) {
		hash ^= bytes[index];
		hash = Math.imul(hash, FNV_PRIME);
	}

	return hash >>> 0;
}

/** mulberry32: same seed => same sequence, every value in `[0, 1)`. */
export function seededRng(seed: string | number): () => number {
	let state = (typeof seed === 'number' ? seed : hashString(seed)) >>> 0;

	return function next(): number {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
	};
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
	let hex = '';
	for (let index = 0; index < bytes.length; index += 1) {
		hex += bytes[index].toString(16).padStart(2, '0');
	}
	return hex;
}

function rotl32(value: number, shift: number): number {
	return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

/** Pure TypeScript SHA-1 (FIPS 180-4), returning 20 bytes. */
function sha1(input: Uint8Array): Uint8Array {
	const bitLength = input.length * 8;
	const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
	const buffer = new Uint8Array(paddedLength);
	buffer.set(input);
	buffer[input.length] = 0x80;

	const view = new DataView(buffer.buffer);
	view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
	view.setUint32(paddedLength - 4, bitLength >>> 0);

	let h0 = 0x67452301;
	let h1 = 0xefcdab89;
	let h2 = 0x98badcfe;
	let h3 = 0x10325476;
	let h4 = 0xc3d2e1f0;

	const words = new Uint32Array(80);

	for (let offset = 0; offset < paddedLength; offset += 64) {
		for (let index = 0; index < 16; index += 1) {
			words[index] = view.getUint32(offset + index * 4);
		}
		for (let index = 16; index < 80; index += 1) {
			words[index] = rotl32(
				words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16],
				1
			);
		}

		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;
		let e = h4;

		for (let index = 0; index < 80; index += 1) {
			let f: number;
			let k: number;

			if (index < 20) {
				f = (b & c) | (~b & d);
				k = 0x5a827999;
			} else if (index < 40) {
				f = b ^ c ^ d;
				k = 0x6ed9eba1;
			} else if (index < 60) {
				f = (b & c) | (b & d) | (c & d);
				k = 0x8f1bbcdc;
			} else {
				f = b ^ c ^ d;
				k = 0xca62c1d6;
			}

			const temp = (rotl32(a, 5) + (f >>> 0) + e + k + words[index]) >>> 0;
			e = d;
			d = c;
			c = rotl32(b, 30);
			b = a;
			a = temp;
		}

		h0 = (h0 + a) >>> 0;
		h1 = (h1 + b) >>> 0;
		h2 = (h2 + c) >>> 0;
		h3 = (h3 + d) >>> 0;
		h4 = (h4 + e) >>> 0;
	}

	const digest = new Uint8Array(20);
	const digestView = new DataView(digest.buffer);
	digestView.setUint32(0, h0);
	digestView.setUint32(4, h1);
	digestView.setUint32(8, h2);
	digestView.setUint32(12, h3);
	digestView.setUint32(16, h4);
	return digest;
}

/** RFC-4122 UUID v5 (SHA-1, fixed namespace); stable for a given name. */
export function deterministicUuid(name: string): string {
	const namespace = hexToBytes(DETERMINISTIC_UUID_NAMESPACE.split('-').join(''));
	const nameBytes = new TextEncoder().encode(name);

	const input = new Uint8Array(namespace.length + nameBytes.length);
	input.set(namespace);
	input.set(nameBytes, namespace.length);

	const digest = sha1(input);
	// Version 5 (name-based, SHA-1) and RFC 4122 variant (10xx).
	digest[6] = (digest[6] & 0x0f) | 0x50;
	digest[8] = (digest[8] & 0x3f) | 0x80;

	const hex = bytesToHex(digest.subarray(0, 16));
	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20, 32)
	].join('-');
}
