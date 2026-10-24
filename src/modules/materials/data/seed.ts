import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import {
	demoAssetId,
	demoDecorAttributeId,
	demoDecorEdgingId,
	demoDecorId,
	demoDecorSupplierId,
	demoEdgingId,
	demoManufacturerId,
	demoMaterialCollectionId,
	demoSupplierId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS } from '$shared/data/demo-seed';
import type {
	DecorAttributeRecord,
	DecorEdgingRecord,
	DecorRecord,
	DecorSupplierRecord,
	EdgingRecord,
	ManufacturerRecord,
	MaterialCollectionRecord,
	SupplierRecord
} from '$shared/data/records';
import {
	DECOR_COLOUR_FAMILIES,
	DECOR_CORES,
	DECOR_MATERIAL_TYPES,
	EDGING_MATCH_TYPES,
	GRAIN_DIRECTIONS,
	PREMIUM_TIERS
} from '$shared/domain/record-states';

/**
 * Materials seed: 4 manufacturers, 12 collections, 40 decors, 8 edgings,
 * 60 decor-edging links, 6 suppliers, 30 decor-supplier links and 25
 * attributes (phase-3 §5.2).
 *
 * Deterministic by construction: ids come from the shared Phase 3 helpers,
 * dates from `demoDays`, no `Math.random()`, no `Date.now()` and no
 * `crypto.randomUUID()`. Decor 1 owns the sample asset; decor 2 shows the
 * empty state.
 */

const TENANT_ID = DEMO_TENANTS[0].id;

const MANUFACTURER_SEED = [
	{
		caption: 'Kairos Laminates',
		country: 'Germany',
		website: 'kairos-laminates.example'
	},
	{
		caption: 'Northwood Veneers',
		country: 'United Kingdom',
		website: 'northwoodveneers.example'
	},
	{
		caption: 'Ligna Surfaces',
		country: 'Italy',
		website: 'lignasurfaces.example'
	},
	{
		caption: 'Stone & Haze',
		country: 'Spain',
		website: 'stoneandhaze.example'
	}
] as const;

const COLLECTION_SEED = [
	{ manufacturerN: 1, collectionN: 1, caption: 'Core Matt' },
	{ manufacturerN: 1, collectionN: 2, caption: 'Wood Grain' },
	{ manufacturerN: 1, collectionN: 3, caption: 'Designer Lacquer' },
	{ manufacturerN: 2, collectionN: 1, caption: 'Natural Veneer' },
	{ manufacturerN: 2, collectionN: 2, caption: 'Heritage Oak' },
	{ manufacturerN: 2, collectionN: 3, caption: 'Smoked Timber' },
	{ manufacturerN: 3, collectionN: 1, caption: 'Urban Studio' },
	{ manufacturerN: 3, collectionN: 2, caption: 'Soft Touch' },
	{ manufacturerN: 3, collectionN: 3, caption: 'Metallic Line' },
	{ manufacturerN: 4, collectionN: 1, caption: 'Mineral Stone' },
	{ manufacturerN: 4, collectionN: 2, caption: 'Glass Works' },
	{ manufacturerN: 4, collectionN: 3, caption: 'Statement Acrylic' }
] as const;

const DECOR_CAPTIONS = [
	'Arctic White',
	'Storm Grey',
	'Ink Black',
	'Sand Beige',
	'Walnut Brown',
	'Smoked Oak',
	'Ocean Blue',
	'Forest Green',
	'Terracotta Red',
	'Slate Other',
	'Pearl White',
	'Graphite Grey',
	'Charcoal Black',
	'Oat Beige',
	'Chestnut Brown',
	'Natural Oak',
	'Indigo Blue',
	'Moss Green',
	'Brick Red',
	'Concrete Grey',
	'Alabaster White',
	'Ash Grey',
	'Onyx Black',
	'Cashmere Beige',
	'Teak Brown',
	'Driftwood',
	'Cobalt Blue',
	'Sage Green',
	'Rust Red',
	'Limewash',
	'Chalk White',
	'Pebble Grey',
	'Basalt Black',
	'Linen Beige',
	'Espresso Brown',
	'Ebony Oak',
	'Denim Blue',
	'Olive Green',
	'Claret Red',
	'Onyx Grain'
] as const;

const DECOR_CODE_PREFIXES = ['KL', 'NV', 'LS', 'SH'] as const;

/** Deliberate status and visibility spread for the list filters. */
const DISCONTINUED_DECORS = new Set([13, 27, 38]);
const HIDDEN_DECORS = new Set([5, 11, 19, 26, 33, 39]);

const EDGING_SEED = [
	{
		caption: 'Alpine White 22 mm',
		edgingCode: 'EDG-2201',
		materialType: 'ABS',
		thicknessMm: 22,
		colourFamily: 'white'
	},
	{
		caption: 'Storm Grey 22 mm',
		edgingCode: 'EDG-2202',
		materialType: 'ABS',
		thicknessMm: 22,
		colourFamily: 'grey'
	},
	{
		caption: 'Onyx 22 mm',
		edgingCode: 'EDG-2203',
		materialType: 'PVC',
		thicknessMm: 22,
		colourFamily: 'black'
	},
	{
		caption: 'Natural Oak 23 mm',
		edgingCode: 'EDG-2304',
		materialType: 'Veneer',
		thicknessMm: 23,
		colourFamily: 'wood_tone'
	},
	{
		caption: 'Walnut 23 mm',
		edgingCode: 'EDG-2305',
		materialType: 'Veneer',
		thicknessMm: 23,
		colourFamily: 'brown'
	},
	{
		caption: 'Brushed Aluminium 22 mm',
		edgingCode: 'EDG-2206',
		materialType: 'Aluminium',
		thicknessMm: 22,
		colourFamily: 'other'
	},
	{
		caption: 'Cobalt 22 mm',
		edgingCode: 'EDG-2207',
		materialType: 'PVC',
		thicknessMm: 22,
		colourFamily: 'blue'
	},
	{
		caption: 'Sage 22 mm',
		edgingCode: 'EDG-2208',
		materialType: 'ABS',
		thicknessMm: 22,
		colourFamily: 'green'
	}
] as const;

const SUPPLIER_SEED = [
	{
		caption: 'Nordic Board Supply',
		contact: 'orders@nordicboard.example',
		leadTimeDays: 14
	},
	{
		caption: 'Continental Panels',
		contact: 'sales@continentalpanels.example',
		leadTimeDays: 21
	},
	{
		caption: 'Thames Timber',
		contact: null,
		leadTimeDays: 7
	},
	{
		caption: 'Verona Surfaces',
		contact: 'hello@veronasurfaces.example',
		leadTimeDays: 28
	},
	{
		caption: 'Cork & Co.',
		contact: 'team@corkandco.example',
		leadTimeDays: 10
	},
	{
		caption: 'Atlas Materials',
		contact: 'desk@atlasmaterials.example',
		leadTimeDays: 45
	}
] as const;

function createdDaysFor(n: number): number {
	return 400 - n * 8;
}

function updatedDaysFor(n: number): number {
	return Math.max(1, createdDaysFor(n) - (n % 9));
}

const seededManufacturers: readonly ManufacturerRecord[] = MANUFACTURER_SEED.map((plan, index) => ({
	id: demoManufacturerId(index + 1),
	tenantId: TENANT_ID,
	caption: plan.caption,
	country: plan.country,
	website: plan.website,
	active: true,
	createdAt: demoDays(400 - index * 4),
	updatedAt: demoDays(300 - index * 3)
}));

const seededCollections: readonly MaterialCollectionRecord[] = COLLECTION_SEED.map((plan) => ({
	id: demoMaterialCollectionId(plan.manufacturerN, plan.collectionN),
	tenantId: TENANT_ID,
	manufacturerId: demoManufacturerId(plan.manufacturerN),
	caption: plan.caption,
	active: true,
	createdAt: demoDays(360 - plan.manufacturerN * 5),
	updatedAt: demoDays(250 - plan.collectionN * 4)
}));

const seededDecors: readonly DecorRecord[] = DECOR_CAPTIONS.map((caption, index) => {
	const n = index + 1;
	const collectionIndex = (n - 1) % COLLECTION_SEED.length;
	const collectionPlan = COLLECTION_SEED[collectionIndex];
	const colourFamily = n % 11 === 0 ? null : DECOR_COLOUR_FAMILIES[(n - 1) % 10];

	return {
		id: demoDecorId(n),
		tenantId: TENANT_ID,
		collectionId: demoMaterialCollectionId(
			collectionPlan.manufacturerN,
			collectionPlan.collectionN
		),
		caption,
		decorCode: `${DECOR_CODE_PREFIXES[collectionPlan.manufacturerN - 1]}-${1000 + n}`,
		textureSurface: n % 4 === 0 ? 'Textured' : n % 4 === 1 ? 'Smooth' : null,
		colourFamily,
		materialType: DECOR_MATERIAL_TYPES[(n - 1) % DECOR_MATERIAL_TYPES.length],
		core: DECOR_CORES[(n - 1) % DECOR_CORES.length],
		defaultThicknessMm: [18, 19, 22, 25][(n - 1) % 4],
		sheetSizeMm: n % 2 === 0 ? { length: 3050, width: 1220 } : { length: 2800, width: 2070 },
		grainDirection: n % 5 === 0 ? null : GRAIN_DIRECTIONS[(n - 1) % GRAIN_DIRECTIONS.length],
		premiumTier: PREMIUM_TIERS[(n - 1) % PREMIUM_TIERS.length],
		status: DISCONTINUED_DECORS.has(n) ? 'discontinued' : 'active',
		customerVisible: !HIDDEN_DECORS.has(n),
		sampleAssetId: n === 1 ? demoAssetId('decor-sample:1') : null,
		createdAt: demoDays(createdDaysFor(n)),
		updatedAt: demoDays(updatedDaysFor(n))
	};
});

const seededEdgings: readonly EdgingRecord[] = EDGING_SEED.map((plan, index) => {
	const n = index + 1;
	return {
		id: demoEdgingId(n),
		tenantId: TENANT_ID,
		caption: plan.caption,
		edgingCode: plan.edgingCode,
		materialType: plan.materialType,
		thicknessMm: plan.thicknessMm,
		colourFamily: plan.colourFamily,
		active: n !== EDGING_SEED.length,
		createdAt: demoDays(320 - n * 6),
		updatedAt: demoDays(180 - n * 4)
	};
});

const seededSuppliers: readonly SupplierRecord[] = SUPPLIER_SEED.map((plan, index) => {
	const n = index + 1;
	return {
		id: demoSupplierId(n),
		tenantId: TENANT_ID,
		caption: plan.caption,
		contact: plan.contact,
		leadTimeDays: plan.leadTimeDays,
		active: n !== SUPPLIER_SEED.length,
		createdAt: demoDays(300 - n * 5),
		updatedAt: demoDays(160 - n * 3)
	};
});

/**
 * 60 decor-edging links: every decor gets one link, and the first 20 decors
 * get a second, complementary edging. Match types rotate across the three
 * canonical values.
 */
const seededDecorEdgings: readonly DecorEdgingRecord[] = (() => {
	const links: DecorEdgingRecord[] = [];
	for (let n = 1; n <= 40; n += 1) {
		const first = ((n - 1) % EDGING_SEED.length) + 1;
		links.push({
			id: demoDecorEdgingId(n, first),
			tenantId: TENANT_ID,
			decorId: demoDecorId(n),
			edgingId: demoEdgingId(first),
			matchType: EDGING_MATCH_TYPES[(n - 1) % EDGING_MATCH_TYPES.length],
			createdAt: demoDays(createdDaysFor(n))
		});

		if (n <= 20) {
			const second = ((n + 2) % EDGING_SEED.length) + 1;
			links.push({
				id: demoDecorEdgingId(n, second),
				tenantId: TENANT_ID,
				decorId: demoDecorId(n),
				edgingId: demoEdgingId(second),
				matchType: EDGING_MATCH_TYPES[n % EDGING_MATCH_TYPES.length],
				createdAt: demoDays(createdDaysFor(n))
			});
		}
	}
	return links;
})();

/**
 * 30 decor-supplier links across 15 decors, two suppliers each, with exactly
 * one primary per linked decor. The second primary rejection fixture is a
 * test-only input, never persisted (phase-3 §5.2).
 */
const seededDecorSuppliers: readonly DecorSupplierRecord[] = (() => {
	const links: DecorSupplierRecord[] = [];
	for (let n = 1; n <= 15; n += 1) {
		const firstSupplier = ((n - 1) % SUPPLIER_SEED.length) + 1;
		const secondSupplier = (firstSupplier % SUPPLIER_SEED.length) + 1;
		const primarySupplier = n % 2 === 1 ? firstSupplier : secondSupplier;

		for (const supplierN of [firstSupplier, secondSupplier]) {
			links.push({
				id: demoDecorSupplierId(n, supplierN),
				tenantId: TENANT_ID,
				decorId: demoDecorId(n),
				supplierId: demoSupplierId(supplierN),
				supplierCode: `SUP-${String(n).padStart(2, '0')}-${supplierN}`,
				isPrimary: supplierN === primarySupplier,
				altSupplierCode: supplierN === primarySupplier ? `ALT-${String(n).padStart(2, '0')}` : null,
				createdAt: demoDays(createdDaysFor(n)),
				updatedAt: demoDays(updatedDaysFor(n))
			});
		}
	}
	return links;
})();

/** 25 attributes: two on decors 1–10 and one on decors 11–15. */
const seededDecorAttributes: readonly DecorAttributeRecord[] = (() => {
	const rows: DecorAttributeRecord[] = [];
	for (let n = 1; n <= 15; n += 1) {
		const definitions =
			n <= 10
				? [
						{
							attrName: 'Finish',
							attrValue: ['Matt', 'Satin', 'Textured'][(n - 1) % 3]
						},
						{
							attrName: 'Edge profile',
							attrValue: n % 2 === 0 ? 'Square' : 'Rounded'
						}
					]
				: [{ attrName: 'Fire rating', attrValue: 'Class D-s2,d0' }];

		for (const definition of definitions) {
			rows.push({
				id: demoDecorAttributeId(n, definition.attrName),
				tenantId: TENANT_ID,
				decorId: demoDecorId(n),
				attrName: definition.attrName,
				attrValue: definition.attrValue,
				createdAt: demoDays(createdDaysFor(n)),
				updatedAt: demoDays(updatedDaysFor(n))
			});
		}
	}
	return rows;
})();

/** Registered by `data/mock.ts` through `registerSeeder`. */
export function seedMaterials(): Record<string, unknown[]> {
	return {
		[COLLECTIONS.manufacturers]: seededManufacturers.map((row) => ({ ...row })),
		[COLLECTIONS.materialCollections]: seededCollections.map((row) => ({ ...row })),
		[COLLECTIONS.decors]: seededDecors.map((row) => ({
			...row,
			sheetSizeMm: { ...row.sheetSizeMm }
		})),
		[COLLECTIONS.edgings]: seededEdgings.map((row) => ({ ...row })),
		[COLLECTIONS.decorEdgings]: seededDecorEdgings.map((row) => ({ ...row })),
		[COLLECTIONS.suppliers]: seededSuppliers.map((row) => ({ ...row })),
		[COLLECTIONS.decorSuppliers]: seededDecorSuppliers.map((row) => ({ ...row })),
		[COLLECTIONS.decorAttributes]: seededDecorAttributes.map((row) => ({ ...row }))
	};
}
