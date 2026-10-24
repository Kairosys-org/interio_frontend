import type {
	DecorColourFamily,
	DecorCore,
	DecorMaterialType,
	EdgingMatchType,
	GrainDirection,
	MaterialStatus,
	PremiumTier
} from '../domain/types';

/**
 * Display-only mappings for materials (DESIGN §13.2 terminology). No prices
 * exist in this phase, so no money formatter lives here.
 */

export const COLOUR_FAMILY_LABELS: Readonly<Record<DecorColourFamily, string>> = Object.freeze({
	white: 'White',
	grey: 'Grey',
	black: 'Black',
	beige: 'Beige',
	brown: 'Brown',
	wood_tone: 'Wood tone',
	blue: 'Blue',
	green: 'Green',
	red: 'Red',
	other: 'Other'
});

export const MATERIAL_TYPE_LABELS: Readonly<Record<DecorMaterialType, string>> = Object.freeze({
	melamine_board: 'Melamine board',
	mdf: 'MDF',
	plywood: 'Plywood',
	veneer: 'Veneer',
	lacquer: 'Lacquer',
	acrylic: 'Acrylic',
	glass: 'Glass',
	metal: 'Metal',
	stone: 'Stone',
	other: 'Other'
});

export const DECOR_CORE_LABELS: Readonly<Record<DecorCore, string>> = Object.freeze({
	chipboard: 'Chipboard',
	mdf: 'MDF',
	plywood: 'Plywood',
	other: 'Other'
});

export const GRAIN_DIRECTION_LABELS: Readonly<Record<GrainDirection, string>> = Object.freeze({
	along_length: 'Along length',
	along_width: 'Along width',
	none: 'No grain'
});

export const PREMIUM_TIER_LABELS: Readonly<Record<PremiumTier, string>> = Object.freeze({
	standard: 'Standard',
	premium: 'Premium',
	luxury: 'Luxury'
});

export const MATERIAL_STATUS_LABELS: Readonly<Record<MaterialStatus, string>> = Object.freeze({
	active: 'Active',
	discontinued: 'Discontinued'
});

export const EDGING_MATCH_LABELS: Readonly<Record<EdgingMatchType, string>> = Object.freeze({
	exact: 'Exact match',
	complementary: 'Complementary',
	alt: 'Alternative'
});

export function colourFamilyLabel(value: DecorColourFamily | null): string {
	return value === null ? '\u2014' : (COLOUR_FAMILY_LABELS[value] ?? value);
}

export function materialTypeLabel(value: DecorMaterialType): string {
	return MATERIAL_TYPE_LABELS[value] ?? value;
}

export function decorCoreLabel(value: DecorCore): string {
	return DECOR_CORE_LABELS[value] ?? value;
}

export function grainDirectionLabel(value: GrainDirection | null): string {
	return value === null ? '\u2014' : (GRAIN_DIRECTION_LABELS[value] ?? value);
}

export function premiumTierLabel(value: PremiumTier): string {
	return PREMIUM_TIER_LABELS[value] ?? value;
}

export function materialStatusLabel(value: MaterialStatus): string {
	return MATERIAL_STATUS_LABELS[value] ?? value;
}

export function edgingMatchLabel(value: EdgingMatchType): string {
	return EDGING_MATCH_LABELS[value] ?? value;
}

/** `2800 × 2070 mm`; sheet sizes are integer millimetres. */
export function formatSheetSize(size: { length: number; width: number }): string {
	return `${size.length} \u00d7 ${size.width} mm`;
}
