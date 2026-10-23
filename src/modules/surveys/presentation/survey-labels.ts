import type {
	MeasurementSource,
	MeasurementTargetType,
	NoteCategory,
	ObstacleType,
	OpeningType,
	RoomType,
	SurveyMeasurement,
	UtilityType,
	VerificationMethod
} from '../domain/types';

/**
 * Presentation labels for the survey vocabulary (Part 9 §5–§11).
 *
 * The domain stores wire values; only this file turns them into words. Every
 * label is capitalised for display and never used for matching.
 */

export const ROOM_TYPE_LABELS: Readonly<Record<RoomType, string>> = Object.freeze({
	kitchen: 'Kitchen',
	bedroom: 'Bedroom',
	bathroom: 'Bathroom',
	en_suite: 'En-suite',
	utility: 'Utility',
	dining: 'Dining',
	living: 'Living',
	hall: 'Hall',
	other: 'Other'
});

export const OPENING_TYPE_LABELS: Readonly<Record<OpeningType, string>> = Object.freeze({
	door: 'Door',
	window: 'Window',
	skylight: 'Skylight',
	opening: 'Opening',
	hatch: 'Hatch',
	other: 'Other'
});

export const UTILITY_TYPE_LABELS: Readonly<Record<UtilityType, string>> = Object.freeze({
	water: 'Water',
	drain: 'Drain',
	gas: 'Gas',
	electric: 'Electric',
	data: 'Data',
	vent: 'Ventilation',
	heating: 'Heating',
	other: 'Other'
});

export const OBSTACLE_TYPE_LABELS: Readonly<Record<ObstacleType, string>> = Object.freeze({
	pipe: 'Pipe',
	radiator: 'Radiator',
	column: 'Column',
	beam: 'Beam',
	chimney: 'Chimney',
	stair: 'Stair',
	fixed_furniture: 'Fixed furniture',
	other: 'Other'
});

export const MEASUREMENT_TARGET_LABELS: Readonly<Record<MeasurementTargetType, string>> =
	Object.freeze({
		ceiling_height: 'Ceiling height',
		room_length: 'Room length',
		room_width: 'Room width',
		wall_length: 'Wall length',
		wall_height: 'Wall height',
		door_width: 'Door width',
		door_height: 'Door height',
		window_width: 'Window width',
		window_height: 'Window height',
		sill_height: 'Sill height',
		opening_width: 'Opening width',
		opening_height: 'Opening height',
		other: 'Custom measurement'
	});

export const MEASUREMENT_SOURCE_LABELS: Readonly<Record<MeasurementSource, string>> = Object.freeze(
	{
		laser: 'Laser',
		lidar: 'LiDAR',
		plan: 'Plan',
		manual: 'Manual',
		photo: 'Photo',
		imported_file: 'Imported file'
	}
);

export const VERIFICATION_METHOD_LABELS: Readonly<Record<VerificationMethod, string>> =
	Object.freeze({
		re_measure: 'Re-measured on site',
		cross_check_plan: 'Cross-checked against the plan',
		photo_check: 'Checked against a photo',
		second_surveyor: 'Checked by a second surveyor'
	});

export const NOTE_CATEGORY_LABELS: Readonly<Record<NoteCategory, string>> = Object.freeze({
	general: 'General',
	observation: 'Observation',
	issue: 'Issue',
	customer_request: 'Customer request',
	access: 'Access',
	other: 'Other'
});

/** `other` measurements carry their own caption; never show a bare "Other". */
export function measurementTargetLabel(
	measurement: Pick<SurveyMeasurement, 'targetType' | 'targetCaption'>
): string {
	if (measurement.targetType === 'other') {
		return measurement.targetCaption?.trim() || 'Custom measurement';
	}
	return MEASUREMENT_TARGET_LABELS[measurement.targetType];
}

export function sourceLabel(source: string): string {
	return MEASUREMENT_SOURCE_LABELS[source as MeasurementSource] ?? source;
}

export function verificationMethodLabel(method: string | null | undefined): string {
	if (!method) return '';
	return VERIFICATION_METHOD_LABELS[method as VerificationMethod] ?? method;
}
