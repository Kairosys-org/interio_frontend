import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));

import { session } from '$shared/application/session';
import { listTenantAudit } from '$shared/data/audit';
import { COLLECTIONS } from '$shared/data/collections';
import {
	demoAssetId,
	demoDecorAttributeId,
	demoDecorId,
	demoEdgingId,
	demoManufacturerId,
	demoMaterialCollectionId,
	demoSupplierId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import type {
	AppUserRecord,
	DecorAttributeRecord,
	DecorEdgingRecord,
	DecorRecord,
	DecorSupplierRecord,
	EdgingRecord,
	ManufacturerRecord,
	MaterialCollectionRecord,
	SupplierRecord
} from '$shared/data/records';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { isUuid } from '$shared/domain/uuid';
import { ApiError } from '$network/errors';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import type { CreateDecorInput } from '../../domain/types';
import {
	mockCreateCollection,
	mockCreateDecor,
	mockCreateEdging,
	mockCreateManufacturer,
	mockCreateSupplier,
	mockGetDecor,
	mockGetSupplier,
	mockLinkEdging,
	mockLinkSupplier,
	mockListDecors,
	mockListEdgings,
	mockListManufacturers,
	mockListSuppliers,
	mockRemoveAttribute,
	mockUnlinkEdging,
	mockUnlinkSupplier,
	mockUpdateCollection,
	mockUpdateDecor,
	mockUpdateEdging,
	mockUpdateManufacturer,
	mockUpdateSupplier,
	mockUpsertAttribute
} from '../mock';

const OPULENT = DEMO_TENANTS[0];
const HARBOUR = DEMO_TENANTS[1];
const OWNER = 'owner@opulentinteriors.co.uk';
const PURCHASING = 'purchasing@opulentinteriors.co.uk';
const WORKSHOP = 'workshop@opulentinteriors.co.uk';
const HARBOUR_OWNER = 'owner@harbourfinch.co.uk';

const COLLECTION_1 = demoMaterialCollectionId(1, 1);

function createMemoryStorage(): Storage {
	const values = new Map<string, string>();
	return {
		get length() {
			return values.size;
		},
		clear() {
			values.clear();
		},
		getItem(key: string) {
			return values.has(key) ? (values.get(key) ?? null) : null;
		},
		key(index: number) {
			return Array.from(values.keys())[index] ?? null;
		},
		removeItem(key: string) {
			values.delete(key);
		},
		setItem(key: string, value: string) {
			values.set(key, String(value));
		}
	};
}

function sessionUserFrom(record: AppUserRecord): SessionUser {
	const tenantRecord = record.tenantId
		? (DEMO_TENANTS.find((candidate) => candidate.id === record.tenantId) ?? null)
		: null;
	const tenant: TenantIdentity | null = tenantRecord
		? {
				id: tenantRecord.id,
				slug: tenantRecord.slug,
				legalName: tenantRecord.legalName,
				status: tenantRecord.status,
				branding: tenantRecord.branding
			}
		: null;

	return {
		id: record.id,
		email: record.email,
		displayName: record.displayName,
		roles: record.roles,
		permissions: record.permissions,
		tenant,
		platform: record.platform,
		mfaEnrolled: record.mfaEnrolled
	};
}

function signIn(email: string): SessionUser {
	const record = DEMO_USERS.find((candidate) => candidate.email === email);
	if (!record) throw new Error(`Demo user ${email} is missing from the seed.`);
	const user = sessionUserFrom(record);
	session.setUser(user);
	return user;
}

function createDecorInput(overrides: Partial<CreateDecorInput> = {}): CreateDecorInput {
	return {
		collectionId: COLLECTION_1,
		caption: 'Test Decor',
		decorCode: 'TEST-0001',
		colourFamily: 'white',
		materialType: 'melamine_board',
		core: 'chipboard',
		defaultThicknessMm: 18,
		sheetSizeMm: { length: 2800, width: 2070 },
		grainDirection: 'along_length',
		premiumTier: 'standard',
		status: 'active',
		customerVisible: true,
		...overrides
	};
}

async function captureError(operation: Promise<unknown>): Promise<ApiError> {
	const error = await operation.catch((cause: unknown) => cause);
	expect(error).toBeInstanceOf(ApiError);
	return error as ApiError;
}

beforeEach(() => {
	(globalThis as { localStorage?: Storage }).localStorage = createMemoryStorage();
	resetMockDb();
	// Tenants and users belong to the auth seed; this suite installs the demo
	// world explicitly. The materials seeder is registered by `../mock`.
	setCollection(
		COLLECTIONS.tenants,
		DEMO_TENANTS.map((tenant) => ({ ...tenant }))
	);
	setCollection(
		COLLECTIONS.appUsers,
		DEMO_USERS.map((user) => ({ ...user }))
	);
	signIn(OWNER);
});

afterEach(() => {
	session.clearSession();
	delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('materials seed', () => {
	it('seeds the phase-3 catalogue counts', async () => {
		const page = await mockListDecors({ pageSize: 100 });
		const decors = getCollection<DecorRecord>(COLLECTIONS.decors);
		const decorSuppliers = getCollection<DecorSupplierRecord>(COLLECTIONS.decorSuppliers);

		expect(page.total).toBe(40);
		expect(page.items.every((row) => isUuid(row.id))).toBe(true);
		expect(getCollection<ManufacturerRecord>(COLLECTIONS.manufacturers)).toHaveLength(4);
		expect(getCollection<MaterialCollectionRecord>(COLLECTIONS.materialCollections)).toHaveLength(
			12
		);
		expect(decors).toHaveLength(40);
		expect(getCollection<EdgingRecord>(COLLECTIONS.edgings)).toHaveLength(8);
		expect(getCollection<DecorEdgingRecord>(COLLECTIONS.decorEdgings)).toHaveLength(60);
		expect(getCollection<SupplierRecord>(COLLECTIONS.suppliers)).toHaveLength(6);
		expect(decorSuppliers).toHaveLength(30);
		expect(getCollection<DecorAttributeRecord>(COLLECTIONS.decorAttributes)).toHaveLength(25);

		expect(decors.filter((row) => row.customerVisible === false)).toHaveLength(6);
		expect(decors.filter((row) => row.status === 'discontinued')).toHaveLength(3);
		expect(new Set(decors.map((row) => row.colourFamily).filter(Boolean)).size).toBe(10);
		expect(new Set(decors.map((row) => row.materialType)).size).toBe(10);
		expect(new Set(decors.map((row) => row.premiumTier)).size).toBe(3);

		const collections = getCollection<MaterialCollectionRecord>(COLLECTIONS.materialCollections);
		const captionsByManufacturer = new Map<string, Set<string>>();
		for (const collection of collections) {
			const captions = captionsByManufacturer.get(collection.manufacturerId) ?? new Set<string>();
			captions.add(collection.caption.toLowerCase());
			captionsByManufacturer.set(collection.manufacturerId, captions);
		}
		expect(collections).toHaveLength(12);
		expect([...captionsByManufacturer.values()].every((captions) => captions.size === 3)).toBe(
			true
		);

		const primaries = new Map<string, number>();
		for (const link of decorSuppliers) {
			primaries.set(link.decorId, (primaries.get(link.decorId) ?? 0) + (link.isPrimary ? 1 : 0));
		}
		expect(primaries.size).toBe(15);
		expect([...primaries.values()].every((count) => count === 1)).toBe(true);
	});

	it('assigns the sample asset to decor 1 only', async () => {
		const first = await mockGetDecor(demoDecorId(1));
		const second = await mockGetDecor(demoDecorId(2));

		expect(first.decor.sampleAssetId).toBe(demoAssetId('decor-sample:1'));
		expect(second.decor.sampleAssetId).toBeNull();
	});

	it('produces byte-identical materials after reset and reseed', () => {
		const collections = [
			COLLECTIONS.manufacturers,
			COLLECTIONS.materialCollections,
			COLLECTIONS.decors,
			COLLECTIONS.edgings,
			COLLECTIONS.decorEdgings,
			COLLECTIONS.suppliers,
			COLLECTIONS.decorSuppliers,
			COLLECTIONS.decorAttributes
		];
		const snapshot = () => JSON.stringify(collections.map((name) => getCollection(name)));
		const first = snapshot();

		resetMockDb();
		expect(snapshot()).toBe(first);
	});
});

describe('mockListDecors', () => {
	it('applies all six filters', async () => {
		const byManufacturer = await mockListDecors({
			manufacturerId: demoManufacturerId(1),
			pageSize: 100
		});
		expect(byManufacturer.total).toBe(12);
		expect(byManufacturer.items.every((row) => row.manufacturerId === demoManufacturerId(1))).toBe(
			true
		);

		const byColour = await mockListDecors({ colourFamily: 'wood_tone', pageSize: 100 });
		expect(byColour.total).toBe(4);
		expect(byColour.items.every((row) => row.colourFamily === 'wood_tone')).toBe(true);

		const byMaterial = await mockListDecors({ materialType: 'mdf', pageSize: 100 });
		expect(byMaterial.total).toBe(4);
		expect(byMaterial.items.every((row) => row.materialType === 'mdf')).toBe(true);

		const byTier = await mockListDecors({ premiumTier: 'premium', pageSize: 100 });
		expect(byTier.total).toBe(13);

		const byStatus = await mockListDecors({ status: 'discontinued', pageSize: 100 });
		expect(byStatus.total).toBe(3);
		expect(byStatus.items.every((row) => row.status === 'discontinued')).toBe(true);

		const hidden = await mockListDecors({ customerVisible: 'hidden', pageSize: 100 });
		const visible = await mockListDecors({ customerVisible: 'visible', pageSize: 100 });
		expect(hidden.total).toBe(6);
		expect(visible.total).toBe(34);
		expect(hidden.items.every((row) => row.customerVisible === false)).toBe(true);
	});

	it('combines filters and searches captions, codes and joined names', async () => {
		const combined = await mockListDecors({
			manufacturerId: demoManufacturerId(1),
			materialType: 'mdf',
			pageSize: 100
		});
		expect(combined.total).toBe(1);

		expect((await mockListDecors({ search: 'arctic' })).items.map((row) => row.caption)).toEqual([
			'Arctic White'
		]);
		expect((await mockListDecors({ search: 'kl-1001' })).total).toBe(1);
		expect((await mockListDecors({ search: 'Heritage Oak' })).total).toBe(3);
		expect((await mockListDecors({ search: 'no-such-decor' })).total).toBe(0);
	});

	it('sorts and paginates with the shared page shape', async () => {
		const byCode = await mockListDecors({ sort: 'decorCode', sortDir: 'asc', pageSize: 100 });
		const codes = byCode.items.map((row) => row.decorCode);
		expect(codes).toEqual([...codes].sort((first, second) => first.localeCompare(second, 'en-GB')));

		const second = await mockListDecors({ page: 2, pageSize: 10 });
		expect(second.items).toHaveLength(10);
		expect(second.total).toBe(40);
		expect(second.page).toBe(2);
		expect(second.pageSize).toBe(10);
		expect(second.totalPages).toBe(4);
		expect(second.hasMore).toBe(true);

		const last = await mockListDecors({ page: 4, pageSize: 10 });
		expect(last.items).toHaveLength(10);
		expect(last.hasMore).toBe(false);
	});
});

describe('mockGetDecor', () => {
	it('joins manufacturer, collection, edgings, suppliers and sorted attributes', async () => {
		const detail = await mockGetDecor(demoDecorId(1));

		expect(detail.manufacturer.caption).toBe('Kairos Laminates');
		expect(detail.collection.caption).toBe('Core Matt');
		expect(detail.edgings.map((link) => link.edging.caption)).toEqual([
			'Alpine White 22 mm',
			'Natural Oak 23 mm'
		]);
		expect(detail.edgings.map((link) => link.matchType)).toEqual(['exact', 'complementary']);
		expect(detail.suppliers).toHaveLength(2);
		expect(detail.suppliers.filter((link) => link.isPrimary)).toHaveLength(1);
		expect(detail.suppliers[0]?.supplier.caption).toBe('Nordic Board Supply');
		expect(detail.attributes.map((attribute) => attribute.attrName)).toEqual([
			'Edge profile',
			'Finish'
		]);
	});

	it('returns 404 for an unknown decor', async () => {
		await expect(mockGetDecor('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});
	});
});

describe('mockCreateDecor', () => {
	it('normalises, persists and audits a new decor', async () => {
		const result = await mockCreateDecor(
			createDecorInput({
				caption: '  Test   Decor ',
				decorCode: ' TEST-0001 ',
				premiumTier: undefined,
				customerVisible: undefined
			})
		);

		expect(result.decor).toMatchObject({
			caption: 'Test Decor',
			decorCode: 'TEST-0001',
			premiumTier: 'standard',
			status: 'active',
			customerVisible: true,
			tenantId: OPULENT.id,
			sampleAssetId: null
		});
		expect(isUuid(result.decor.id)).toBe(true);
		expect(result.candidates).toEqual([]);

		const audit = listTenantAudit(OPULENT.id, 'decor', result.decor.id);
		expect(audit.find((row) => row.action === 'create')).toBeDefined();
	});

	it('rejects a duplicate decor code in the same collection and names the owner', async () => {
		const error = await captureError(
			mockCreateDecor(
				createDecorInput({
					caption: 'Copy Cat',
					decorCode: ' kl-1001 '
				})
			)
		);

		expect(error).toMatchObject({ code: 'conflict', status: 409 });
		expect(error.message).toContain('Arctic White');
		expect(error.message).toContain('KL-1001');
	});

	it('reports name and code candidates without blocking or merging', async () => {
		const byName = await mockCreateDecor(
			createDecorInput({
				caption: '  arctic   white ',
				decorCode: 'KL-9001'
			})
		);

		expect(byName.candidates).toHaveLength(1);
		expect(byName.candidates[0]).toMatchObject({
			id: demoDecorId(1),
			caption: 'Arctic White',
			collectionCaption: 'Core Matt'
		});
		expect(byName.candidates[0]?.matchReasons).toContain('Name matches');
		expect((await mockListDecors({ pageSize: 100 })).total).toBe(41);

		const byCode = await mockCreateDecor(
			createDecorInput({
				caption: 'Totally Distinct Finish',
				decorCode: 'KL-1002'
			})
		);
		expect(byCode.candidates).toHaveLength(1);
		expect(byCode.candidates[0]?.id).toBe(demoDecorId(2));
		expect(byCode.candidates[0]?.matchReasons).toContain('Code matches');
		expect((await mockListDecors({ pageSize: 100 })).total).toBe(42);

		// Candidate reporting never touched the existing rows.
		expect((await mockGetDecor(demoDecorId(1))).decor.caption).toBe('Arctic White');
	});

	it('validates required fields', async () => {
		const error = await captureError(
			mockCreateDecor(createDecorInput({ caption: '   ', defaultThicknessMm: 0 }))
		);

		expect(error).toMatchObject({
			code: 'validation',
			status: 400,
			fieldErrors: { caption: 'Enter a decor caption.' }
		});
	});
});

describe('mockUpdateDecor', () => {
	it('audits updates and treats discontinued as the archive transition', async () => {
		const discontinued = await mockUpdateDecor(demoDecorId(1), { status: 'discontinued' });
		expect(discontinued.status).toBe('discontinued');

		let audit = listTenantAudit(OPULENT.id, 'decor', demoDecorId(1));
		expect(audit.some((row) => row.action === 'update')).toBe(true);
		expect(audit.find((row) => row.action === 'deactivate')?.payload).toMatchObject({
			previousStatus: 'active',
			newStatus: 'discontinued'
		});

		const restored = await mockUpdateDecor(demoDecorId(1), { status: 'active' });
		expect(restored.status).toBe('active');
		audit = listTenantAudit(OPULENT.id, 'decor', demoDecorId(1));
		expect(audit.find((row) => row.action === 'activate')?.payload).toMatchObject({
			previousStatus: 'discontinued',
			newStatus: 'active'
		});
	});

	it('rejects a code that already exists in the target collection', async () => {
		const error = await captureError(mockUpdateDecor(demoDecorId(1), { decorCode: 'kl-1013' }));

		expect(error).toMatchObject({ code: 'conflict', status: 409 });
		expect(error.message).toContain('Charcoal Black');
	});

	it('accepts a sample asset id and rejects a malformed one', async () => {
		const assetId = demoAssetId('decor-sample:2');
		const updated = await mockUpdateDecor(demoDecorId(2), { sampleAssetId: assetId });
		expect(updated.sampleAssetId).toBe(assetId);

		const error = await captureError(
			mockUpdateDecor(demoDecorId(2), { sampleAssetId: 'not-a-uuid' })
		);
		expect(error).toMatchObject({
			code: 'validation',
			fieldErrors: { sampleAssetId: 'Choose a valid sample asset.' }
		});
	});
});

describe('edgings', () => {
	it('lists, searches, filters by active and paginates', async () => {
		expect((await mockListEdgings({ pageSize: 100 })).total).toBe(8);
		expect((await mockListEdgings({ active: 'active', pageSize: 100 })).total).toBe(7);
		expect((await mockListEdgings({ active: 'inactive', pageSize: 100 })).total).toBe(1);
		expect((await mockListEdgings({ search: 'oak' })).total).toBe(1);
		expect((await mockListEdgings({ search: 'veneer' })).total).toBe(2);

		const page = await mockListEdgings({ page: 2, pageSize: 3 });
		expect(page.items).toHaveLength(3);
		expect(page.total).toBe(8);
		expect(page.totalPages).toBe(3);
		expect(page.hasMore).toBe(true);
	});

	it('creates and updates an edging with audit', async () => {
		const created = await mockCreateEdging({
			caption: '  Pearl   White 22 mm ',
			edgingCode: 'EDG-9001',
			materialType: 'ABS',
			thicknessMm: 22,
			colourFamily: 'white'
		});

		expect(created.caption).toBe('Pearl White 22 mm');
		expect(created.active).toBe(true);
		expect(
			listTenantAudit(OPULENT.id, 'edging', created.id).some((row) => row.action === 'create')
		).toBe(true);

		const deactivated = await mockUpdateEdging(created.id, { active: false });
		expect(deactivated.active).toBe(false);
		const audit = listTenantAudit(OPULENT.id, 'edging', created.id);
		expect(audit.some((row) => row.action === 'update')).toBe(true);
		expect(audit.some((row) => row.action === 'deactivate')).toBe(true);
	});

	it('upserts one link per decor and edging', async () => {
		const before = (await mockGetDecor(demoDecorId(2))).edgings;

		await mockLinkEdging(demoDecorId(2), {
			edgingId: demoEdgingId(1),
			matchType: 'exact'
		});
		const afterFirst = (await mockGetDecor(demoDecorId(2))).edgings;
		expect(afterFirst).toHaveLength(before.length + 1);

		await mockLinkEdging(demoDecorId(2), {
			edgingId: demoEdgingId(1),
			matchType: 'complementary'
		});
		const afterSecond = (await mockGetDecor(demoDecorId(2))).edgings;
		expect(afterSecond).toHaveLength(afterFirst.length);
		expect(afterSecond.find((link) => link.edgingId === demoEdgingId(1))?.matchType).toBe(
			'complementary'
		);

		const audit = listTenantAudit(OPULENT.id, 'decor', demoDecorId(2));
		expect(audit.filter((row) => row.action === 'link')).toHaveLength(2);
	});

	it('removes a link as a join-row write and audits it', async () => {
		const before = (await mockGetDecor(demoDecorId(2))).edgings;
		await mockUnlinkEdging(demoDecorId(2), demoEdgingId(2));

		const after = (await mockGetDecor(demoDecorId(2))).edgings;
		expect(after).toHaveLength(before.length - 1);
		expect(after.some((link) => link.edgingId === demoEdgingId(2))).toBe(false);
		expect(
			listTenantAudit(OPULENT.id, 'decor', demoDecorId(2)).some((row) => row.action === 'unlink')
		).toBe(true);
	});
});

describe('suppliers', () => {
	it('lists, searches, filters by active and paginates', async () => {
		expect((await mockListSuppliers({ pageSize: 100 })).total).toBe(6);
		expect((await mockListSuppliers({ active: 'active', pageSize: 100 })).total).toBe(5);
		expect((await mockListSuppliers({ active: 'inactive', pageSize: 100 })).total).toBe(1);
		expect((await mockListSuppliers({ search: 'timber' })).total).toBe(1);

		const page = await mockListSuppliers({ page: 2, pageSize: 2 });
		expect(page.items).toHaveLength(2);
		expect(page.total).toBe(6);
		expect(page.totalPages).toBe(3);
		expect(page.hasMore).toBe(true);
	});

	it('creates a supplier with name and contact candidates but never blocks', async () => {
		const byName = await mockCreateSupplier({
			caption: '  nordic   board supply '
		});
		expect(byName.supplier.caption).toBe('nordic board supply');
		expect(byName.candidates).toHaveLength(1);
		expect(byName.candidates[0]).toMatchObject({ id: demoSupplierId(1) });
		expect(byName.candidates[0]?.matchReasons).toContain('Name matches');

		const byContact = await mockCreateSupplier({
			caption: 'Fresh Contact Supplier',
			contact: ' ORDERS@nordicboard.example '
		});
		expect(byContact.candidates[0]?.matchReasons).toContain('Contact matches');
		expect((await mockListSuppliers({ pageSize: 100 })).total).toBe(8);
	});

	it('returns linked decors with manufacturer and collection captions', async () => {
		const detail = await mockGetSupplier(demoSupplierId(1));

		expect(detail.supplier.caption).toBe('Nordic Board Supply');
		expect(detail.decors.map((row) => row.decorId).sort()).toEqual(
			[demoDecorId(1), demoDecorId(6), demoDecorId(7), demoDecorId(12), demoDecorId(13)].sort()
		);
		expect(detail.decors.every((row) => row.supplierCode.startsWith('SUP-'))).toBe(true);
		expect(detail.decors.every((row) => row.manufacturerCaption.length > 0)).toBe(true);
		expect(detail.decors.every((row) => row.collectionCaption.length > 0)).toBe(true);
	});

	it('updates a supplier and audits activate/deactivate', async () => {
		const updated = await mockUpdateSupplier(demoSupplierId(1), { active: false });
		expect(updated.active).toBe(false);

		const audit = listTenantAudit(OPULENT.id, 'supplier', demoSupplierId(1));
		expect(audit.some((row) => row.action === 'update')).toBe(true);
		expect(audit.some((row) => row.action === 'deactivate')).toBe(true);
	});

	it('rejects a second primary supplier and names the existing primary', async () => {
		const error = await captureError(
			mockLinkSupplier(demoDecorId(1), {
				supplierId: demoSupplierId(3),
				supplierCode: 'SUP-01-3',
				isPrimary: true
			})
		);

		expect(error).toMatchObject({ code: 'conflict', status: 409 });
		expect(error.message).toContain('Nordic Board Supply');

		const detail = await mockGetDecor(demoDecorId(1));
		expect(detail.suppliers).toHaveLength(2);
		expect(detail.suppliers.filter((link) => link.isPrimary)).toHaveLength(1);
	});

	it('allows a non-primary link, upserts it and lets the primary be removed', async () => {
		await mockLinkSupplier(demoDecorId(1), {
			supplierId: demoSupplierId(3),
			supplierCode: 'SUP-01-3',
			isPrimary: false
		});

		let detail = await mockGetDecor(demoDecorId(1));
		expect(detail.suppliers).toHaveLength(3);
		expect(detail.suppliers.filter((link) => link.isPrimary)).toHaveLength(1);

		await mockLinkSupplier(demoDecorId(1), {
			supplierId: demoSupplierId(3),
			supplierCode: 'SUP-01-3B',
			isPrimary: false,
			altSupplierCode: 'ALT-01-3'
		});
		detail = await mockGetDecor(demoDecorId(1));
		expect(detail.suppliers).toHaveLength(3);
		expect(
			detail.suppliers.find((link) => link.supplierId === demoSupplierId(3))?.supplierCode
		).toBe('SUP-01-3B');

		await mockUnlinkSupplier(demoDecorId(1), demoSupplierId(1));
		detail = await mockGetDecor(demoDecorId(1));
		expect(detail.suppliers).toHaveLength(2);
		expect(detail.suppliers.some((link) => link.isPrimary)).toBe(false);

		const actions = listTenantAudit(OPULENT.id, 'decor', demoDecorId(1)).map((row) => row.action);
		expect(actions).toContain('link');
		expect(actions).toContain('update');
		expect(actions).toContain('unlink');
	});
});

describe('decor attributes', () => {
	it('upserts case-insensitively and audits create/update', async () => {
		const before = (await mockGetDecor(demoDecorId(1))).attributes;

		const updated = await mockUpsertAttribute(demoDecorId(1), {
			attrName: '  finish ',
			attrValue: '  Lacquered '
		});
		expect(updated.id).toBe(demoDecorAttributeId(1, 'Finish'));
		expect(updated.attrName).toBe('finish');
		expect(updated.attrValue).toBe('Lacquered');

		const afterUpdate = (await mockGetDecor(demoDecorId(1))).attributes;
		expect(afterUpdate).toHaveLength(before.length);
		expect(afterUpdate.find((row) => row.id === updated.id)?.attrValue).toBe('Lacquered');

		const created = await mockUpsertAttribute(demoDecorId(1), {
			attrName: 'Care instructions',
			attrValue: 'Wipe with a damp cloth'
		});
		const afterCreate = (await mockGetDecor(demoDecorId(1))).attributes;
		expect(afterCreate).toHaveLength(before.length + 1);
		expect(afterCreate.find((row) => row.id === created.id)?.attrName).toBe('Care instructions');

		const actions = listTenantAudit(OPULENT.id, 'decor', demoDecorId(1)).map((row) => row.action);
		expect(actions).toContain('update');
		expect(actions).toContain('create');
	});

	it('rejects an empty key or value', async () => {
		const emptyName = await captureError(
			mockUpsertAttribute(demoDecorId(1), { attrName: '   ', attrValue: 'Value' })
		);
		expect(emptyName).toMatchObject({
			code: 'validation',
			fieldErrors: { attrName: 'Enter an attribute name.' }
		});

		const emptyValue = await captureError(
			mockUpsertAttribute(demoDecorId(1), { attrName: 'Finish', attrValue: '   ' })
		);
		expect(emptyValue).toMatchObject({
			code: 'validation',
			fieldErrors: { attrValue: 'Enter an attribute value.' }
		});
	});

	it('removes an attribute as a join-row write and audits it', async () => {
		const before = (await mockGetDecor(demoDecorId(1))).attributes;
		await mockRemoveAttribute(demoDecorId(1), ' finish ');

		const after = (await mockGetDecor(demoDecorId(1))).attributes;
		expect(after).toHaveLength(before.length - 1);
		expect(after.some((row) => row.attrName === 'Finish')).toBe(false);
		expect(
			listTenantAudit(OPULENT.id, 'decor', demoDecorId(1)).some((row) => row.action === 'remove')
		).toBe(true);
	});
});

describe('manufacturers and collections', () => {
	it('returns the manufacturer tree with collections and decor counts', async () => {
		const tree = await mockListManufacturers();

		expect(tree).toHaveLength(4);
		expect(tree.every((node) => node.collections.length === 3)).toBe(true);
		const perManufacturer = tree.map((node) =>
			node.collections.reduce((sum, row) => sum + row.decorCount, 0)
		);
		expect([...perManufacturer].sort((first, second) => first - second)).toEqual([9, 9, 10, 12]);
		expect(
			tree.reduce(
				(sum, node) => sum + node.collections.reduce((inner, row) => inner + row.decorCount, 0),
				0
			)
		).toBe(40);
	});

	it('creates a manufacturer and collection, and rejects a duplicate collection caption', async () => {
		const manufacturer = await mockCreateManufacturer({
			caption: '  Harbour   Timbers ',
			country: 'United Kingdom',
			website: 'harbourtimbers.example'
		});
		expect(manufacturer.caption).toBe('Harbour Timbers');
		expect(manufacturer.active).toBe(true);

		const collection = await mockCreateCollection({
			manufacturerId: manufacturer.id,
			caption: '  Coastal   Range '
		});
		expect(collection.caption).toBe('Coastal Range');

		const duplicate = await captureError(
			mockCreateCollection({
				manufacturerId: demoManufacturerId(1),
				caption: '  core   matt '
			})
		);
		expect(duplicate).toMatchObject({ code: 'conflict', status: 409 });
		expect(duplicate.message).toContain('Core Matt');

		expect(
			listTenantAudit(OPULENT.id, 'manufacturer', manufacturer.id).some(
				(row) => row.action === 'create'
			)
		).toBe(true);
		expect(
			listTenantAudit(OPULENT.id, 'material_collection', collection.id).some(
				(row) => row.action === 'create'
			)
		).toBe(true);
	});

	it('updates both levels and audits deactivation', async () => {
		const manufacturer = await mockUpdateManufacturer(demoManufacturerId(1), { active: false });
		expect(manufacturer.active).toBe(false);
		expect(
			listTenantAudit(OPULENT.id, 'manufacturer', demoManufacturerId(1)).some(
				(row) => row.action === 'deactivate'
			)
		).toBe(true);

		const collection = await mockUpdateCollection(demoMaterialCollectionId(1, 1), {
			caption: 'Core Matt Plus',
			active: false
		});
		expect(collection.caption).toBe('Core Matt Plus');
		expect(collection.active).toBe(false);
		const audit = listTenantAudit(
			OPULENT.id,
			'material_collection',
			demoMaterialCollectionId(1, 1)
		);
		expect(audit.some((row) => row.action === 'update')).toBe(true);
		expect(audit.some((row) => row.action === 'deactivate')).toBe(true);
	});
});

describe('tenant isolation and permissions', () => {
	it('shows no Opulent materials to Harbour and hides other tenants with 404', async () => {
		signIn(HARBOUR_OWNER);

		expect((await mockListDecors({})).total).toBe(0);
		expect((await mockListEdgings({})).total).toBe(0);
		expect((await mockListSuppliers({})).total).toBe(0);
		expect(await mockListManufacturers()).toEqual([]);

		await expect(mockGetDecor(demoDecorId(1))).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});
		await expect(mockGetSupplier(demoSupplierId(1))).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});
		await expect(mockUpdateDecor(demoDecorId(1), { caption: 'Hijacked' })).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});
		await expect(
			mockLinkSupplier(demoDecorId(1), {
				supplierId: demoSupplierId(1),
				supplierCode: 'X',
				isPrimary: false
			})
		).rejects.toMatchObject({ code: 'not_found', status: 404 });

		const created = await mockCreateManufacturer({ caption: 'Harbour Only' });
		expect(created.tenantId).toBe(HARBOUR.id);
		expect(await mockListManufacturers()).toHaveLength(1);
	});

	it('rejects creating a decor in another tenant collection', async () => {
		signIn(HARBOUR_OWNER);
		const error = await captureError(
			mockCreateDecor(createDecorInput({ collectionId: COLLECTION_1 }))
		);

		expect(error).toMatchObject({
			code: 'validation',
			status: 400,
			fieldErrors: { collectionId: 'Choose an existing collection.' }
		});
	});

	it('requires materials.update for writes and allows materials.create when granted', async () => {
		signIn(WORKSHOP);
		expect((await mockListDecors({})).total).toBe(40);
		await expect(mockCreateDecor(createDecorInput())).rejects.toMatchObject({
			code: 'forbidden',
			status: 403
		});
		await expect(
			mockUpsertAttribute(demoDecorId(1), { attrName: 'X', attrValue: 'Y' })
		).rejects.toMatchObject({ code: 'forbidden', status: 403 });

		signIn(PURCHASING);
		const created = await mockCreateDecor(createDecorInput({ decorCode: 'PUR-0001' }));
		expect(created.decor.tenantId).toBe(OPULENT.id);
	});
});
