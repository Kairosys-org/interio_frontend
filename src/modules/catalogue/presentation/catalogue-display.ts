import type {
	CabinetFamily,
	CabinetParameter,
	CabinetParameterUnit,
	ConstructionMethod
} from '../domain/types';

/**
 * Display-only mappings for the catalogue (DESIGN §13.2 terminology).
 *
 * Nothing here validates or decides: it turns domain enums into the words the
 * list, detail and rule pages show. Stored values never pass through a label.
 */

export const CABINET_FAMILY_LABELS: Readonly<Record<CabinetFamily, string>> = Object.freeze({
	base: 'Base units',
	wall: 'Wall units',
	tall: 'Tall units',
	sink: 'Sink units',
	drawer: 'Drawer units',
	corner: 'Corner units',
	appliance: 'Appliance housings',
	wardrobe: 'Wardrobes',
	drawer_chest: 'Drawer chests',
	shelving: 'Shelving',
	custom: 'Custom'
});

export const CONSTRUCTION_METHOD_LABELS: Readonly<Record<ConstructionMethod, string>> =
	Object.freeze({
		cam_lock: 'Cam lock',
		dowel: 'Dowel',
		confirmat: 'Confirmat',
		custom: 'Custom'
	});

export const PARAMETER_UNIT_LABELS: Readonly<Record<CabinetParameterUnit, string>> = Object.freeze({
	mm: 'Millimetres',
	count: 'Count',
	enum: 'Choice',
	bool: 'Yes / no',
	text: 'Text'
});

export function cabinetFamilyLabel(family: CabinetFamily): string {
	return CABINET_FAMILY_LABELS[family] ?? family;
}

export function constructionMethodLabel(method: ConstructionMethod): string {
	return CONSTRUCTION_METHOD_LABELS[method] ?? method;
}

export function cabinetStatusLabel(active: boolean): string {
	return active ? 'Active' : 'Discontinued';
}

/** `mm` and `count` carry bounds; `enum`, `bool` and `text` do not. */
export function parameterHasBounds(unit: CabinetParameterUnit): boolean {
	return unit === 'mm' || unit === 'count';
}

export function parameterUnitSuffix(unit: CabinetParameterUnit): string {
	if (unit === 'mm') return 'mm';
	if (unit === 'count') return 'off';
	return '';
}

/** One readable value for the table; the editor shows the raw input. */
export function formatParameterValue(parameter: CabinetParameter): string {
	const value = parameter.defaultValue;
	if (value === null || value === '') return 'No default';
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	if (typeof value === 'number') return `${value} ${parameterUnitSuffix(parameter.unit)}`.trim();
	return String(value);
}

export function formatParameterBounds(parameter: CabinetParameter): string {
	if (!parameterHasBounds(parameter.unit)) return '\u2014';
	const suffix = parameterUnitSuffix(parameter.unit);
	const min = parameter.minValue === null ? 'No minimum' : `${parameter.minValue} ${suffix}`.trim();
	const max = parameter.maxValue === null ? 'No maximum' : `${parameter.maxValue} ${suffix}`.trim();
	return `${min} \u2013 ${max}`;
}
