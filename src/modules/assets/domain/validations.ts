import { z } from 'zod';
import {
	ASSET_KINDS,
	ASSET_MIME_TYPES,
	ASSET_OWNER_TYPES,
	MAX_ASSET_SIZE_BYTES,
	SHA256_PATTERN
} from './types';

/**
 * Asset form schemas (spec Part 9 §12, Part 4 §12).
 *
 * The client uses these before starting an upload; the mock repository
 * re-validates every payload because it behaves like the server (R4,
 * architecture §4.6). A file is only accepted when its MIME type belongs to
 * the declared kind — a PDF labelled `photo` would break the media grid.
 */

const CAPTION_MAX = 200;
const FILE_NAME_MAX = 255;
const DEVICE_MAX = 120;
const ORIENTATION_MAX = 40;

function blankToNull(value: unknown): unknown {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function optionalText(max: number, message: string) {
	return z.preprocess(blankToNull, z.string().trim().max(max, message).nullable());
}

function requiredInt(min: number, max: number, message: string) {
	return z.coerce
		.number({ error: 'Enter a file size.' })
		.int('Use whole bytes.')
		.min(min, message)
		.max(max, message);
}

const sha256 = z
	.string()
	.trim()
	.toLowerCase()
	.regex(SHA256_PATTERN, 'A SHA-256 checksum is 64 hexadecimal characters.');

export const assetBaseSchema = z.object({
	ownerType: z.enum(ASSET_OWNER_TYPES, { error: 'Choose what the file belongs to.' }),
	ownerId: z.string().uuid('Choose the record this file belongs to.'),
	assetKind: z.enum(ASSET_KINDS, { error: 'Choose the kind of file.' }),
	fileName: z
		.string()
		.trim()
		.min(1, 'Enter the file name.')
		.max(FILE_NAME_MAX, `Keep the file name to ${FILE_NAME_MAX} characters or fewer.`),
	mimeType: z.string().trim().min(1, 'Choose a file type.'),
	sizeBytes: requiredInt(
		1,
		MAX_ASSET_SIZE_BYTES,
		`Files must be ${MAX_ASSET_SIZE_BYTES / (1024 * 1024)} MB or smaller.`
	),
	sha256,
	caption: optionalText(CAPTION_MAX, `Keep the caption to ${CAPTION_MAX} characters or fewer.`),
	capturedAt: z.preprocess(
		blankToNull,
		z.string().datetime({ offset: true, error: 'Choose when the file was captured.' }).nullable()
	),
	deviceModel: optionalText(DEVICE_MAX, `Keep the device to ${DEVICE_MAX} characters or fewer.`),
	orientation: optionalText(
		ORIENTATION_MAX,
		`Keep the orientation to ${ORIENTATION_MAX} characters or fewer.`
	)
});

export const assetFormSchema = assetBaseSchema.superRefine((value, ctx) => {
	const allowed = ASSET_MIME_TYPES[value.assetKind];
	if (!allowed.includes(value.mimeType)) {
		ctx.addIssue({
			code: 'custom',
			path: ['mimeType'],
			message: `${value.mimeType} is not a supported ${value.assetKind} file type.`
		});
	}
});

/** Completion re-sends the checksum so the server can prove integrity (S7). */
export const completeAssetSchema = z.object({
	sha256
});

export const assetStateSchema = z.object({
	uploadState: z.enum(['pending', 'uploading', 'failed'], {
		error: 'Choose a resumable upload state.'
	})
});

export type AssetFormValues = z.infer<typeof assetFormSchema>;
