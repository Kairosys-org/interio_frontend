import { z } from 'zod';
import {
	MEASUREMENT_SOURCES,
	MEASUREMENT_TARGET_TYPES,
	NOTE_CATEGORIES,
	OBSTACLE_TYPES,
	OPENING_TYPES,
	ROOM_TYPES,
	SWING_DIRECTIONS,
	UTILITY_TYPES,
	VERIFICATION_METHODS
} from './types';

/**
 * Survey form schemas (spec Part 9 §4–§11).
 *
 * These are the client-side gate; the mock repository re-validates every
 * payload and also re-checks the cross-record rules (unique wall labels,
 * opening ≤ wall, same-room links) that a single row cannot prove
 * (architecture §4.6, R4).
 *
 * Dimension fields are integer millimetres. An empty form field means "not
 * captured yet" and becomes `null`, never `0` (0 as a length would be a lie).
 */

const CAPTION_MAX = 200;
const TEXT_MAX = 2000;
const NOTE_MAX = 20000;

function blankToNull(value: unknown): unknown {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function optionalText(max: number, message: string) {
	return z.preprocess(blankToNull, z.string().trim().max(max, message).nullable());
}

/** Integer millimetres; accepts the numeric string a form control emits. */
function requiredInt(min: number, max: number, message: string) {
	return z.coerce
		.number({ error: 'Enter a number.' })
		.int('Use whole millimetres.')
		.min(min, message)
		.max(max, message);
}

function optionalInt(min: number, max: number, message: string) {
	return z.preprocess(
		blankToNull,
		z.union([
			z.null(),
			z.coerce.number().int('Use whole millimetres.').min(min, message).max(max, message)
		])
	);
}

const caption = z
	.string()
	.trim()
	.min(1, 'Enter a caption.')
	.max(CAPTION_MAX, `Keep the caption to ${CAPTION_MAX} characters or fewer.`);

/* ------------------------------------------------------------------ */
/* Survey (Part 9 §4)                                                  */
/* ------------------------------------------------------------------ */

export const surveyFormSchema = z.object({
	caption,
	surveyorId: z.string().uuid('Choose a surveyor.'),
	appointmentAt: z
		.string()
		.datetime({ offset: true, error: 'Choose an appointment date and time.' })
});

export const surveyUpdateSchema = surveyFormSchema.partial();

/* ------------------------------------------------------------------ */
/* Room (Part 9 §5)                                                    */
/* ------------------------------------------------------------------ */

export const roomFormSchema = z.object({
	caption,
	roomType: z.enum(ROOM_TYPES, { error: 'Choose a room type.' }),
	sortOrder: z.coerce.number().int().min(0).optional(),
	ceilingHeightMm: optionalInt(500, 10000, 'Ceiling height must be between 500 and 10000 mm.'),
	roomLengthMm: optionalInt(1, 30000, 'Room length must be between 1 and 30000 mm.'),
	roomWidthMm: optionalInt(1, 30000, 'Room width must be between 1 and 30000 mm.'),
	shapeNotes: optionalText(TEXT_MAX, `Keep shape notes to ${TEXT_MAX} characters or fewer.`)
});

export const roomUpdateSchema = roomFormSchema.partial();

/* ------------------------------------------------------------------ */
/* Wall (Part 9 §6)                                                    */
/* ------------------------------------------------------------------ */

export const wallFormSchema = z.object({
	caption,
	lengthMm: requiredInt(1, 30000, 'Wall length must be between 1 and 30000 mm.'),
	heightMm: requiredInt(1, 10000, 'Wall height must be between 1 and 10000 mm.'),
	condition: optionalText(TEXT_MAX, `Keep the condition note to ${TEXT_MAX} characters or fewer.`),
	sortOrder: z.coerce.number().int().min(0).optional()
});

export const wallUpdateSchema = wallFormSchema.partial();

/* ------------------------------------------------------------------ */
/* Opening (Part 9 §7)                                                 */
/* ------------------------------------------------------------------ */

export const openingBaseSchema = z.object({
	openingType: z.enum(OPENING_TYPES, { error: 'Choose an opening type.' }),
	caption: optionalText(CAPTION_MAX, `Keep the caption to ${CAPTION_MAX} characters or fewer.`),
	widthMm: requiredInt(1, 10000, 'Opening width must be between 1 and 10000 mm.'),
	heightMm: requiredInt(1, 10000, 'Opening height must be between 1 and 10000 mm.'),
	sillHeightMm: optionalInt(0, 5000, 'Sill height must be between 0 and 5000 mm.'),
	swingDirection: z.preprocess(
		blankToNull,
		z.enum(SWING_DIRECTIONS, { error: 'Choose the swing direction.' }).nullable()
	),
	revealDepthMm: optionalInt(1, 1000, 'Reveal depth must be between 1 and 1000 mm.'),
	notes: optionalText(TEXT_MAX, `Keep the notes to ${TEXT_MAX} characters or fewer.`),
	surveyWallId: z.preprocess(
		blankToNull,
		z.string().uuid('Choose a wall from this room.').nullable()
	)
});

export const openingFormSchema = openingBaseSchema.superRefine((value, ctx) => {
	if (value.openingType === 'window' && value.sillHeightMm === null) {
		ctx.addIssue({
			code: 'custom',
			path: ['sillHeightMm'],
			message: 'A window needs a sill height.'
		});
	}
	if (value.openingType === 'door' && value.swingDirection === null) {
		ctx.addIssue({
			code: 'custom',
			path: ['swingDirection'],
			message: 'A door needs a swing direction.'
		});
	}
});

export const openingUpdateSchema = openingBaseSchema.partial();

/* ------------------------------------------------------------------ */
/* Utility (Part 9 §8)                                                 */
/* ------------------------------------------------------------------ */

export const utilityFormSchema = z.object({
	utilityType: z.enum(UTILITY_TYPES, { error: 'Choose a utility type.' }),
	locationDesc: z
		.string()
		.trim()
		.min(1, 'Describe where the utility is.')
		.max(CAPTION_MAX, `Keep the location to ${CAPTION_MAX} characters or fewer.`),
	positionOffsetMm: z.preprocess(
		blankToNull,
		z.union([
			z.null(),
			z.coerce.number().int('Use whole millimetres.').min(0, 'Offset cannot be negative.')
		])
	),
	heightFromFloorMm: optionalInt(0, 5000, 'Height must be between 0 and 5000 mm.'),
	notes: optionalText(TEXT_MAX, `Keep the notes to ${TEXT_MAX} characters or fewer.`),
	surveyWallId: z.preprocess(
		blankToNull,
		z.string().uuid('Choose a wall from this room.').nullable()
	)
});

export const utilityUpdateSchema = utilityFormSchema.partial();

/* ------------------------------------------------------------------ */
/* Obstacle (Part 9 §9)                                                */
/* ------------------------------------------------------------------ */

export const obstacleFormSchema = z.object({
	obstacleType: z.enum(OBSTACLE_TYPES, { error: 'Choose an obstacle type.' }),
	description: z
		.string()
		.trim()
		.min(1, 'Describe the obstacle.')
		.max(500, 'Keep the description to 500 characters or fewer.'),
	widthMm: optionalInt(1, 10000, 'Width must be between 1 and 10000 mm.'),
	heightMm: optionalInt(1, 10000, 'Height must be between 1 and 10000 mm.'),
	depthMm: optionalInt(1, 10000, 'Depth must be between 1 and 10000 mm.'),
	blocksPositioning: z.boolean().optional(),
	positionDesc: optionalText(TEXT_MAX, `Keep the position note to ${TEXT_MAX} characters or fewer.`)
});

export const obstacleUpdateSchema = obstacleFormSchema.partial();

/* ------------------------------------------------------------------ */
/* Measurement (Part 9 §10)                                            */
/* ------------------------------------------------------------------ */

export const measurementBaseSchema = z.object({
	surveyRoomId: z.string().uuid('Choose a room.'),
	targetType: z.enum(MEASUREMENT_TARGET_TYPES, { error: 'Choose what was measured.' }),
	targetCaption: optionalText(
		CAPTION_MAX,
		`Keep the caption to ${CAPTION_MAX} characters or fewer.`
	),
	valueMm: requiredInt(1, 30000, 'Measurement must be between 1 and 30000 mm.'),
	source: z.enum(MEASUREMENT_SOURCES, { error: 'Choose where the reading came from.' }),
	deviceInfo: optionalText(
		CAPTION_MAX,
		`Keep the device note to ${CAPTION_MAX} characters or fewer.`
	),
	surveyWallId: z.preprocess(
		blankToNull,
		z.string().uuid('Choose a wall from this room.').nullable()
	),
	surveyOpeningId: z.preprocess(
		blankToNull,
		z.string().uuid('Choose an opening from this room.').nullable()
	),
	capturedAt: z.string().datetime({ offset: true }).optional()
});

export const measurementFormSchema = measurementBaseSchema.superRefine((value, ctx) => {
	if (value.targetType === 'other' && value.targetCaption === null) {
		ctx.addIssue({
			code: 'custom',
			path: ['targetCaption'],
			message: 'Name the custom measurement.'
		});
	}
});

export const measurementUpdateSchema = measurementBaseSchema.partial();

export const verifyMeasurementSchema = z.object({
	method: z.enum(VERIFICATION_METHODS, { error: 'Choose a verification method.' }),
	note: optionalText(TEXT_MAX, `Keep the verification note to ${TEXT_MAX} characters or fewer.`)
});

/* ------------------------------------------------------------------ */
/* Note (Part 9 §11)                                                   */
/* ------------------------------------------------------------------ */

export const noteFormSchema = z.object({
	surveyRoomId: z.preprocess(
		blankToNull,
		z.string().uuid('Choose a room from this survey.').nullable()
	),
	category: z.enum(NOTE_CATEGORIES, { error: 'Choose a note category.' }),
	body: z
		.string()
		.trim()
		.min(1, 'Write the note before saving.')
		.max(NOTE_MAX, `Keep the note to ${NOTE_MAX} characters or fewer.`)
});

export const noteRevisionSchema = z.object({
	body: z
		.string()
		.trim()
		.min(1, 'Write the note before saving.')
		.max(NOTE_MAX, `Keep the note to ${NOTE_MAX} characters or fewer.`)
});

export type SurveyFormValues = z.infer<typeof surveyFormSchema>;
export type RoomFormValues = z.infer<typeof roomFormSchema>;
export type WallFormValues = z.infer<typeof wallFormSchema>;
export type OpeningFormValues = z.infer<typeof openingFormSchema>;
export type UtilityFormValues = z.infer<typeof utilityFormSchema>;
export type ObstacleFormValues = z.infer<typeof obstacleFormSchema>;
export type MeasurementFormValues = z.infer<typeof measurementFormSchema>;
export type NoteFormValues = z.infer<typeof noteFormSchema>;
