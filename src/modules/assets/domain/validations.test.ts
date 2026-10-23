import { describe, expect, it } from 'vitest';
import { assetFormSchema, assetStateSchema, completeAssetSchema } from './validations';
import { MAX_ASSET_SIZE_BYTES } from './types';

/**
 * Asset form rules (phase-2 §5.4). The repository re-validates the same input;
 * these tests prove the message the user sees before an upload starts.
 */

const VALID = {
	ownerType: 'room' as const,
	ownerId: '5f0c1a3e-7b2d-5e4a-8c9d-1a2b3c4d5e6f',
	assetKind: 'photo' as const,
	fileName: 'kitchen.jpg',
	mimeType: 'image/jpeg',
	sizeBytes: 1_048_576,
	sha256: 'a'.repeat(64),
	caption: null,
	capturedAt: null,
	deviceModel: null,
	orientation: null
};

describe('assetFormSchema', () => {
	it('accepts a well-formed photo', () => {
		expect(assetFormSchema.safeParse(VALID).success).toBe(true);
	});

	it('accepts the numeric string a form control emits for size', () => {
		const result = assetFormSchema.safeParse({ ...VALID, sizeBytes: '2048' });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.sizeBytes).toBe(2048);
	});

	it('rejects a MIME type outside the declared kind', () => {
		const result = assetFormSchema.safeParse({ ...VALID, mimeType: 'application/pdf' });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.path.join('.') === 'mimeType')).toBe(true);
		}
	});

	it('allows a PDF as a plan', () => {
		const result = assetFormSchema.safeParse({
			...VALID,
			assetKind: 'plan',
			mimeType: 'application/pdf'
		});
		expect(result.success).toBe(true);
	});

	it('rejects an empty file, a size above the cap and a malformed checksum', () => {
		expect(assetFormSchema.safeParse({ ...VALID, fileName: '  ' }).success).toBe(false);
		expect(
			assetFormSchema.safeParse({ ...VALID, sizeBytes: MAX_ASSET_SIZE_BYTES + 1 }).success
		).toBe(false);
		expect(assetFormSchema.safeParse({ ...VALID, sha256: 'abc' }).success).toBe(false);
	});

	it('turns blank optional text into null, never an empty string', () => {
		const result = assetFormSchema.safeParse({
			...VALID,
			caption: '   ',
			deviceModel: '',
			orientation: '   '
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.caption).toBeNull();
			expect(result.data.deviceModel).toBeNull();
			expect(result.data.orientation).toBeNull();
		}
	});

	it('normalises an upper-case checksum to lower case', () => {
		const result = assetFormSchema.safeParse({ ...VALID, sha256: 'A'.repeat(64) });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.sha256).toBe('a'.repeat(64));
	});
});

describe('complete and state schemas', () => {
	it('requires a checksum on completion', () => {
		expect(completeAssetSchema.safeParse({ sha256: 'a'.repeat(64) }).success).toBe(true);
		expect(completeAssetSchema.safeParse({}).success).toBe(false);
	});

	it('only accepts the resumable upload states', () => {
		expect(assetStateSchema.safeParse({ uploadState: 'uploading' }).success).toBe(true);
		expect(assetStateSchema.safeParse({ uploadState: 'failed' }).success).toBe(true);
		expect(assetStateSchema.safeParse({ uploadState: 'complete' }).success).toBe(false);
	});
});
