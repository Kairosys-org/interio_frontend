import type { OpeningType } from './types';

/**
 * Survey prerequisite rules (spec Part 9 §5–§11, Part 4 §2).
 *
 * Pure predicates shared by the form schemas, the mock server and the UI
 * warnings, so the same rule cannot drift between client and server
 * (architecture §4.6). No I/O, no session, no storage.
 */

/** Every window records a sill height (Part 9 §7). */
export function requiresSill(openingType: OpeningType | string): boolean {
	return openingType === 'window';
}

/** Every door records its swing direction (Part 9 §7). */
export function requiresSwing(openingType: OpeningType | string): boolean {
	return openingType === 'door';
}

export interface OpeningSize {
	widthMm: number;
	heightMm: number;
}

export interface WallSize {
	lengthMm: number;
	heightMm: number;
}

/** An opening can never be larger than the wall it is cut into (S4). */
export function openingFitsWall(opening: OpeningSize, wall: WallSize): boolean {
	return opening.widthMm <= wall.lengthMm && opening.heightMm <= wall.heightMm;
}

export function openingFitsWallReason(opening: OpeningSize, wall: WallSize): string | null {
	if (opening.widthMm > wall.lengthMm) {
		return `The opening is ${opening.widthMm} mm wide but the wall is only ${wall.lengthMm} mm long.`;
	}
	if (opening.heightMm > wall.heightMm) {
		return `The opening is ${opening.heightMm} mm high but the wall is only ${wall.heightMm} mm high.`;
	}
	return null;
}

/** Wall labels are unique within a room (Part 9 §6), case-insensitive. */
export function uniqueWallCaption(
	walls: ReadonlyArray<{ id: string; caption: string }>,
	caption: string,
	excludeId?: string | null
): boolean {
	const normalised = caption.trim().toLowerCase();
	return !walls.some(
		(wall) => wall.id !== excludeId && wall.caption.trim().toLowerCase() === normalised
	);
}

/** A custom measurement must be named (Part 9 §10). */
export function measurementRequiresCaption(targetType: string): boolean {
	return targetType === 'other';
}

/**
 * LiDAR captures and imports must record their source, so the reading stays
 * explainable later (S8, R7). A laser reading may be auto-filled when the
 * device reports it.
 */
export function requiresDeviceInfo(source: string): boolean {
	return source === 'lidar' || source === 'imported_file';
}
