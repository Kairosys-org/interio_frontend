import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import {
	demoCabinetId,
	demoCabinetParameterId,
	demoCabinetRuleId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS } from '$shared/data/demo-seed';
import type {
	CabinetComponentRuleRecord,
	CabinetParameterRecord,
	CabinetRecord
} from '$shared/data/records';
import type {
	CabinetFamily,
	CabinetParameterUnit,
	ConstructionMethod
} from '$shared/domain/record-states';

/**
 * Catalogue seed: 24 cabinets, 18 parameters on the representative cabinet,
 * 12 component rules over `rule_version` 1 and 2.
 *
 * Deterministic by construction: ids from `demoCabinet*` helpers, dates from
 * `demoDays`, no `Math.random()` and no `Date.now()`. Cabinets 21 and 24 are
 * discontinued; cabinet 1 carries every parameter unit (mm, count, enum,
 * bool, text) and one superseded (inactive) rule version.
 */

const TENANT_ID = DEMO_TENANTS[0].id;

interface CabinetPlan {
	n: number;
	caption: string;
	family: CabinetFamily;
	constructionMethod: ConstructionMethod;
	description: string | null;
	active: boolean;
}

const CABINET_PLAN: readonly CabinetPlan[] = [
	{
		n: 1,
		caption: 'Base cabinet 600',
		family: 'base',
		constructionMethod: 'cam_lock',
		description: 'Single-door base unit with one adjustable shelf and a soft-close hinge.',
		active: true
	},
	{
		n: 2,
		caption: 'Base drawer unit 800',
		family: 'base',
		constructionMethod: 'dowel',
		description: 'Three-drawer base unit with a 500 mm drawer box.',
		active: true
	},
	{
		n: 3,
		caption: 'Wall cabinet 600',
		family: 'wall',
		constructionMethod: 'cam_lock',
		description: 'Two-door wall unit for a 600 mm run.',
		active: true
	},
	{
		n: 4,
		caption: 'Wall cabinet 900',
		family: 'wall',
		constructionMethod: 'confirmat',
		description: 'Wide wall unit with a fixed middle shelf.',
		active: true
	},
	{
		n: 5,
		caption: 'Tall larder 600',
		family: 'tall',
		constructionMethod: 'cam_lock',
		description: 'Full-height larder with five shelves.',
		active: true
	},
	{
		n: 6,
		caption: 'Tall wardrobe 900',
		family: 'tall',
		constructionMethod: 'dowel',
		description: 'Two-door wardrobe with a full-length hanging rail.',
		active: true
	},
	{
		n: 7,
		caption: 'Drawer bank 600',
		family: 'drawer',
		constructionMethod: 'confirmat',
		description: 'Four-drawer bank for a base run.',
		active: true
	},
	{
		n: 8,
		caption: 'Drawer bank 800',
		family: 'drawer',
		constructionMethod: 'cam_lock',
		description: 'Wide drawer bank with internal dividers.',
		active: true
	},
	{
		n: 9,
		caption: 'Wardrobe 1200',
		family: 'wardrobe',
		constructionMethod: 'dowel',
		description: 'Three-door wardrobe with one internal drawer.',
		active: true
	},
	{
		n: 10,
		caption: 'Wardrobe 1500',
		family: 'wardrobe',
		constructionMethod: 'confirmat',
		description: 'Four-door wardrobe with a central divider.',
		active: true
	},
	{
		n: 11,
		caption: 'Corner base 900',
		family: 'corner',
		constructionMethod: 'cam_lock',
		description: 'L-shaped corner base with a blanking panel.',
		active: true
	},
	{
		n: 12,
		caption: 'Corner wall 600',
		family: 'corner',
		constructionMethod: 'dowel',
		description: 'Corner wall unit with a single adjustable shelf.',
		active: true
	},
	{
		n: 13,
		caption: 'Base cabinet 500',
		family: 'base',
		constructionMethod: 'custom',
		description: 'Narrow base unit for a bespoke run.',
		active: true
	},
	{
		n: 14,
		caption: 'Wall cabinet 400',
		family: 'wall',
		constructionMethod: 'cam_lock',
		description: null,
		active: true
	},
	{
		n: 15,
		caption: 'Tall oven housing',
		family: 'tall',
		constructionMethod: 'confirmat',
		description: 'Double oven housing with a fixed shelf above the appliance.',
		active: true
	},
	{
		n: 16,
		caption: 'Drawer bank 450',
		family: 'drawer',
		constructionMethod: 'dowel',
		description: 'Three-drawer bank for a compact run.',
		active: true
	},
	{
		n: 17,
		caption: 'Wardrobe 1800',
		family: 'wardrobe',
		constructionMethod: 'cam_lock',
		description: 'Five-door wardrobe with two hanging bays.',
		active: true
	},
	{
		n: 18,
		caption: 'Corner carousel 800',
		family: 'corner',
		constructionMethod: 'confirmat',
		description: 'Corner base with a rotating carousel tray.',
		active: true
	},
	{
		n: 19,
		caption: 'Base sink unit 800',
		family: 'base',
		constructionMethod: 'cam_lock',
		description: 'Sink base with a removable back panel.',
		active: true
	},
	{
		n: 20,
		caption: 'Wall cabinet 1000',
		family: 'wall',
		constructionMethod: 'dowel',
		description: 'Wide wall unit with three doors.',
		active: true
	},
	{
		n: 21,
		caption: 'Tall pantry 450',
		family: 'tall',
		constructionMethod: 'cam_lock',
		description: 'Discontinued narrow pantry with pull-out trays.',
		active: false
	},
	{
		n: 22,
		caption: 'Drawer chest 500',
		family: 'drawer',
		constructionMethod: 'confirmat',
		description: 'Five-drawer chest with a solid top.',
		active: true
	},
	{
		n: 23,
		caption: 'Wardrobe 2100',
		family: 'wardrobe',
		constructionMethod: 'dowel',
		description: 'Six-door wardrobe for a whole-wall run.',
		active: true
	},
	{
		n: 24,
		caption: 'Corner angled 1000',
		family: 'corner',
		constructionMethod: 'custom',
		description: 'Discontinued angled corner unit.',
		active: false
	}
];

function createdDaysFor(n: number): number {
	return 300 - (n - 1) * 8;
}

function updatedDaysFor(n: number): number {
	return Math.max(1, createdDaysFor(n) - 3);
}

function seedCabinet(plan: CabinetPlan): CabinetRecord {
	const createdAt = demoDays(createdDaysFor(plan.n));
	return {
		id: demoCabinetId(plan.n),
		tenantId: TENANT_ID,
		caption: plan.caption,
		family: plan.family,
		description: plan.description,
		constructionMethod: plan.constructionMethod,
		// Filled after the parameter rows are built.
		defaultConfig: {},
		active: plan.active,
		createdAt,
		updatedAt: demoDays(updatedDaysFor(plan.n))
	};
}

interface ParameterPlan {
	paramName: string;
	unit: CabinetParameterUnit;
	minValue: number | null;
	maxValue: number | null;
	defaultValue: string | number | boolean | null;
	allowedValues: string[] | null;
	required: boolean;
}

const CABINET_ONE_PARAMETERS: readonly ParameterPlan[] = [
	{
		paramName: 'width',
		unit: 'mm',
		minValue: 300,
		maxValue: 1200,
		defaultValue: 600,
		allowedValues: null,
		required: true
	},
	{
		paramName: 'height',
		unit: 'mm',
		minValue: 400,
		maxValue: 1200,
		defaultValue: 720,
		allowedValues: null,
		required: true
	},
	{
		paramName: 'depth',
		unit: 'mm',
		minValue: 300,
		maxValue: 700,
		defaultValue: 560,
		allowedValues: null,
		required: true
	},
	{
		paramName: 'thickness',
		unit: 'mm',
		minValue: 16,
		maxValue: 25,
		defaultValue: 18,
		allowedValues: null,
		required: true
	},
	{
		paramName: 'leg_height',
		unit: 'mm',
		minValue: 0,
		maxValue: 200,
		defaultValue: 100,
		allowedValues: null,
		required: false
	},
	{
		paramName: 'drawer_height',
		unit: 'mm',
		minValue: 100,
		maxValue: 400,
		defaultValue: 180,
		allowedValues: null,
		required: false
	},
	{
		paramName: 'shelves',
		unit: 'count',
		minValue: 0,
		maxValue: 6,
		defaultValue: 2,
		allowedValues: null,
		required: false
	},
	{
		paramName: 'drawers',
		unit: 'count',
		minValue: 0,
		maxValue: 4,
		defaultValue: 1,
		allowedValues: null,
		required: false
	},
	{
		paramName: 'doors',
		unit: 'count',
		minValue: 1,
		maxValue: 4,
		defaultValue: 2,
		allowedValues: null,
		required: true
	},
	{
		paramName: 'internal_drawers',
		unit: 'count',
		minValue: 0,
		maxValue: 3,
		defaultValue: 0,
		allowedValues: null,
		required: false
	},
	{
		paramName: 'door_style',
		unit: 'enum',
		minValue: null,
		maxValue: null,
		defaultValue: 'flat',
		allowedValues: ['flat', 'shaker', 'beaded'],
		required: true
	},
	{
		paramName: 'hinge_side',
		unit: 'enum',
		minValue: null,
		maxValue: null,
		defaultValue: 'pair',
		allowedValues: ['left', 'right', 'pair'],
		required: true
	},
	{
		paramName: 'plinth_type',
		unit: 'enum',
		minValue: null,
		maxValue: null,
		defaultValue: 'recessed',
		allowedValues: ['none', 'recessed', 'flush'],
		required: false
	},
	{
		paramName: 'soft_close',
		unit: 'bool',
		minValue: null,
		maxValue: null,
		defaultValue: true,
		allowedValues: null,
		required: false
	},
	{
		paramName: 'handle_included',
		unit: 'bool',
		minValue: null,
		maxValue: null,
		defaultValue: false,
		allowedValues: null,
		required: false
	},
	{
		paramName: 'cable_outlet',
		unit: 'bool',
		minValue: null,
		maxValue: null,
		defaultValue: false,
		allowedValues: null,
		required: false
	},
	{
		paramName: 'finish_note',
		unit: 'text',
		minValue: null,
		maxValue: null,
		defaultValue: 'Sprayed satin',
		allowedValues: null,
		required: false
	},
	{
		paramName: 'carcass_note',
		unit: 'text',
		minValue: null,
		maxValue: null,
		defaultValue: null,
		allowedValues: null,
		required: false
	}
];

/** Every other cabinet gets width, height and one facet per list row. */
function secondaryParameterPlans(n: number): ParameterPlan[] {
	const plans: ParameterPlan[] = [
		{
			paramName: 'width',
			unit: 'mm',
			minValue: 300,
			maxValue: 1200,
			defaultValue: 600,
			allowedValues: null,
			required: true
		},
		{
			paramName: 'height',
			unit: 'mm',
			minValue: 400,
			maxValue: 1200,
			defaultValue: 720,
			allowedValues: null,
			required: true
		}
	];

	if (n % 2 === 0) {
		plans.push({
			paramName: 'depth',
			unit: 'mm',
			minValue: 300,
			maxValue: 700,
			defaultValue: 560,
			allowedValues: null,
			required: true
		});
	}

	if (n % 3 === 0) {
		plans.push({
			paramName: 'doors',
			unit: 'count',
			minValue: 1,
			maxValue: 4,
			defaultValue: 2,
			allowedValues: null,
			required: true
		});
	}

	if (n % 4 === 0) {
		plans.push({
			paramName: 'soft_close',
			unit: 'bool',
			minValue: null,
			maxValue: null,
			defaultValue: true,
			allowedValues: null,
			required: false
		});
	}

	if (n % 5 === 0) {
		plans.push({
			paramName: 'finish_note',
			unit: 'text',
			minValue: null,
			maxValue: null,
			defaultValue: 'Sprayed satin',
			allowedValues: null,
			required: false
		});
	}

	if (n % 7 === 0) {
		plans.push({
			paramName: 'door_style',
			unit: 'enum',
			minValue: null,
			maxValue: null,
			defaultValue: 'flat',
			allowedValues: ['flat', 'shaker', 'beaded'],
			required: true
		});
	}

	return plans;
}

function seedParameter(
	cabinetN: number,
	plan: ParameterPlan,
	sortOrder: number
): CabinetParameterRecord {
	const createdAt = demoDays(createdDaysFor(cabinetN));
	return {
		id: demoCabinetParameterId(cabinetN, plan.paramName),
		tenantId: TENANT_ID,
		cabinetId: demoCabinetId(cabinetN),
		paramName: plan.paramName,
		unit: plan.unit,
		minValue: plan.minValue,
		maxValue: plan.maxValue,
		defaultValue: plan.defaultValue,
		allowedValues: plan.allowedValues ? [...plan.allowedValues] : null,
		required: plan.required,
		sortOrder,
		createdAt,
		updatedAt: demoDays(updatedDaysFor(cabinetN))
	};
}

interface RulePlan {
	cabinetN: number;
	partType: string;
	ruleVersion: string;
	expr: Record<string, unknown>;
	condition: Record<string, unknown> | null;
	active: boolean;
	createdDays: number;
}

const RULE_PLAN: readonly RulePlan[] = [
	{
		cabinetN: 1,
		partType: 'carcass',
		ruleVersion: '1',
		expr: { length: 'width - 2 * thickness', height: 'height - 40', qty: 1 },
		condition: { minWidth: 300 },
		active: false,
		createdDays: 120
	},
	{
		cabinetN: 1,
		partType: 'carcass',
		ruleVersion: '2',
		expr: { length: 'width - 2 * thickness', height: 'height - 20', qty: 1 },
		condition: { minWidth: 300 },
		active: true,
		createdDays: 90
	},
	{
		cabinetN: 1,
		partType: 'shelf',
		ruleVersion: '1',
		expr: { length: 'width - 2 * thickness', qty: 'shelves' },
		condition: { minShelves: 1 },
		active: true,
		createdDays: 88
	},
	{
		cabinetN: 2,
		partType: 'door',
		ruleVersion: '1',
		expr: { width: 'width / 2', height: 'height - 40', qty: 2 },
		condition: null,
		active: true,
		createdDays: 84
	},
	{
		cabinetN: 2,
		partType: 'drawer_box',
		ruleVersion: '1',
		expr: { length: 'width - 36', depth: 500, qty: 3 },
		condition: { minWidth: 600 },
		active: true,
		createdDays: 82
	},
	{
		cabinetN: 3,
		partType: 'back_panel',
		ruleVersion: '1',
		expr: { width: 'width - 30', height: 'height - 60' },
		condition: null,
		active: true,
		createdDays: 78
	},
	{
		cabinetN: 4,
		partType: 'plinth',
		ruleVersion: '1',
		expr: { length: 'width', qty: 1 },
		condition: null,
		active: true,
		createdDays: 74
	},
	{
		cabinetN: 5,
		partType: 'carcass',
		ruleVersion: '1',
		expr: { length: 'width - 24', height: 'height - 40', qty: 1 },
		condition: null,
		active: true,
		createdDays: 70
	},
	{
		cabinetN: 6,
		partType: 'door',
		ruleVersion: '1',
		expr: { width: 'width / 2', height: 'height - 40', qty: 2 },
		condition: null,
		active: true,
		createdDays: 66
	},
	{
		cabinetN: 7,
		partType: 'shelf',
		ruleVersion: '1',
		expr: { length: 'width - 18', qty: 2 },
		condition: null,
		active: true,
		createdDays: 62
	},
	{
		cabinetN: 8,
		partType: 'rail',
		ruleVersion: '1',
		expr: { length: 'width - 60', qty: 2 },
		condition: null,
		active: true,
		createdDays: 58
	},
	{
		cabinetN: 9,
		partType: 'back_panel',
		ruleVersion: '1',
		expr: { width: 'width - 30', height: 'height - 60' },
		condition: null,
		active: true,
		createdDays: 54
	}
];

function seedRule(plan: RulePlan): CabinetComponentRuleRecord {
	return {
		id: demoCabinetRuleId(plan.cabinetN, plan.ruleVersion, plan.partType),
		tenantId: TENANT_ID,
		cabinetId: demoCabinetId(plan.cabinetN),
		ruleVersion: plan.ruleVersion,
		partType: plan.partType,
		expr: { ...plan.expr },
		condition: plan.condition ? { ...plan.condition } : null,
		active: plan.active,
		createdAt: demoDays(plan.createdDays),
		updatedAt: demoDays(Math.max(1, plan.createdDays - 10))
	};
}

function defaultsFor(parameters: readonly CabinetParameterRecord[]): Record<string, unknown> {
	const defaults: Record<string, unknown> = {};
	for (const parameter of parameters) defaults[parameter.paramName] = parameter.defaultValue;
	return defaults;
}

export const seededCabinets: readonly CabinetRecord[] = CABINET_PLAN.map(seedCabinet);

export const seededCabinetParameters: readonly CabinetParameterRecord[] = CABINET_PLAN.flatMap(
	(plan) => {
		const parameterPlans = plan.n === 1 ? CABINET_ONE_PARAMETERS : secondaryParameterPlans(plan.n);
		return parameterPlans.map((parameterPlan, index) =>
			seedParameter(plan.n, parameterPlan, index)
		);
	}
);

/** Cabinet `defaultConfig` mirrors the parameter defaults. */
for (const cabinet of seededCabinets) {
	const parameters = seededCabinetParameters.filter(
		(parameter) => parameter.cabinetId === cabinet.id
	);
	cabinet.defaultConfig = defaultsFor(parameters);
}

export const seededCabinetRules: readonly CabinetComponentRuleRecord[] = RULE_PLAN.map(seedRule);

/** Registered by `data/mock.ts` through `registerSeeder`. */
export function seedCatalogue(): Record<string, unknown[]> {
	return {
		[COLLECTIONS.cabinetCatalog]: seededCabinets.map((cabinet) => ({
			...cabinet,
			defaultConfig: { ...cabinet.defaultConfig }
		})),
		[COLLECTIONS.cabinetParameters]: seededCabinetParameters.map((parameter) => ({
			...parameter,
			allowedValues: parameter.allowedValues ? [...parameter.allowedValues] : null
		})),
		[COLLECTIONS.cabinetComponentRules]: seededCabinetRules.map((rule) => ({
			...rule,
			expr: { ...rule.expr },
			condition: rule.condition ? { ...rule.condition } : null
		}))
	};
}
