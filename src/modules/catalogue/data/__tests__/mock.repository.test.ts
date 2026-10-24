import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));

import { session } from '$shared/application/session';
import { listTenantAudit } from '$shared/data/audit';
import { COLLECTIONS } from '$shared/data/collections';
import {
	demoCabinetId,
	demoCabinetParameterId,
	demoCabinetRuleId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import type {
	AppUserRecord,
	CabinetComponentRuleRecord,
	CabinetParameterRecord,
	CabinetRecord
} from '$shared/data/records';
import { isUuid } from '$shared/domain/uuid';
import { CABINET_FAMILIES } from '$shared/domain/record-states';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { ApiError } from '$network/errors';
import { getCollection, resetMockDb, setCollection } from '$network/mock-backend';
import type { CreateCabinetInput } from '../../domain/types';
import {
	mockCreateCabinet,
	mockGetCabinet,
	mockListCabinets,
	mockListRules,
	mockListRuleVersions,
	mockSaveParameter,
	mockSaveRule,
	mockSetRuleActive,
	mockUpdateCabinet
} from '../mock';

const OPULENT = DEMO_TENANTS[0];
const HARBOUR = DEMO_TENANTS[1];
const OWNER = 'owner@opulentinteriors.co.uk';
const SALES = 'sales@opulentinteriors.co.uk';
const SURVEYOR = 'surveyor@opulentinteriors.co.uk';
const HARBOUR_OWNER = 'owner@harbourfinch.co.uk';

type StorageLike = Storage;

function createMemoryStorage(): StorageLike {
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

function cabinetRecords(): CabinetRecord[] {
	return getCollection<CabinetRecord>(COLLECTIONS.cabinetCatalog);
}

function parameterRecords(): CabinetParameterRecord[] {
	return getCollection<CabinetParameterRecord>(COLLECTIONS.cabinetParameters);
}

function ruleRecords(): CabinetComponentRuleRecord[] {
	return getCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules);
}

function createInput(overrides: Partial<CreateCabinetInput> = {}): CreateCabinetInput {
	return {
		caption: 'Test wall cabinet',
		family: 'wall',
		description: null,
		constructionMethod: 'dowel',
		parameters: [
			{ paramName: 'width', unit: 'mm', minValue: 300, maxValue: 1200, defaultValue: 600 },
			{
				paramName: 'door_style',
				unit: 'enum',
				defaultValue: 'flat',
				allowedValues: ['flat', 'shaker']
			},
			{ paramName: 'carcass_note', unit: 'text', defaultValue: null }
		],
		rules: [
			{
				partType: 'carcass',
				expr: { length: 'width - 18', qty: 1 },
				condition: { minWidth: 300 }
			}
		],
		...overrides
	};
}

beforeEach(() => {
	(globalThis as { localStorage?: Storage }).localStorage = createMemoryStorage();
	resetMockDb();
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

describe('catalogue seed', () => {
	it('seeds 24 cabinets, 22 active, every family and mixed construction', async () => {
		const page = await mockListCabinets({ pageSize: 100 });

		expect(page.total).toBe(24);
		expect(page.items.every((row) => isUuid(row.id))).toBe(true);

		const records = cabinetRecords();
		expect(records).toHaveLength(24);
		expect(records.filter((row) => row.active)).toHaveLength(22);
		expect(
			records
				.filter((row) => !row.active)
				.map((row) => row.id)
				.sort()
		).toEqual([demoCabinetId(21), demoCabinetId(24)].sort());

		for (const family of ['base', 'wall', 'tall', 'drawer', 'wardrobe', 'corner']) {
			expect(records.filter((row) => row.family === family)).toHaveLength(4);
		}
		expect(new Set(records.map((row) => row.constructionMethod)).size).toBe(4);
	});

	it('gives cabinet 1 eighteen parameters covering every unit and gives the rest two or more', () => {
		const parameters = parameterRecords();
		const cabinetOne = parameters.filter((row) => row.cabinetId === demoCabinetId(1));

		expect(cabinetOne).toHaveLength(18);
		expect(new Set(cabinetOne.map((row) => row.unit))).toEqual(
			new Set(['mm', 'count', 'enum', 'bool', 'text'])
		);

		for (let n = 2; n <= 24; n += 1) {
			const rows = parameters.filter((row) => row.cabinetId === demoCabinetId(n));
			expect(rows.length).toBeGreaterThanOrEqual(2);
		}

		const cabinet = cabinetRecords().find((row) => row.id === demoCabinetId(1));
		expect(Object.keys(cabinet?.defaultConfig ?? {})).toHaveLength(18);
		expect(cabinet?.defaultConfig.width).toBe(600);
	});

	it('seeds 12 rules across versions 1 and 2 with exactly one inactive row', () => {
		const rules = ruleRecords();

		expect(rules).toHaveLength(12);
		expect(new Set(rules.map((row) => row.ruleVersion))).toEqual(new Set(['1', '2']));
		expect(rules.filter((row) => !row.active)).toHaveLength(1);

		const superseded = rules.find((row) => !row.active);
		expect(superseded).toMatchObject({
			id: demoCabinetRuleId(1, '1', 'carcass'),
			ruleVersion: '1',
			partType: 'carcass'
		});

		expect(rules.every((row) => isUuid(row.id))).toBe(true);
		expect(rules.every((row) => !Number.isNaN(Date.parse(row.createdAt)))).toBe(true);
	});

	it('produces byte-identical catalogue data after reset and reseed', () => {
		const first = JSON.stringify({
			cabinets: cabinetRecords(),
			parameters: parameterRecords(),
			rules: ruleRecords()
		});

		resetMockDb();

		const second = JSON.stringify({
			cabinets: cabinetRecords(),
			parameters: parameterRecords(),
			rules: ruleRecords()
		});

		expect(second).toBe(first);
	});
});

describe('mockListCabinets', () => {
	it('searches caption and description case-insensitively', async () => {
		expect((await mockListCabinets({ search: 'CORNER' })).total).toBe(4);
		expect((await mockListCabinets({ search: 'soft-close' })).items.map((row) => row.id)).toEqual([
			demoCabinetId(1)
		]);
		expect((await mockListCabinets({ search: 'no-such-cabinet' })).total).toBe(0);
	});

	it('filters by family, status and construction method', async () => {
		expect((await mockListCabinets({ family: 'base' })).total).toBe(4);
		expect((await mockListCabinets({ status: 'discontinued' })).total).toBe(2);
		expect((await mockListCabinets({ status: 'active' })).total).toBe(22);
		expect((await mockListCabinets({ constructionMethod: 'cam_lock' })).total).toBe(9);
		expect(
			(await mockListCabinets({ family: 'base', status: 'active', search: 'sink' })).total
		).toBe(1);
	});

	it('sorts by caption, family and updatedAt with an id tie-break', async () => {
		const byCaption = await mockListCabinets({ sort: 'caption', sortDir: 'asc', pageSize: 100 });
		const captions = byCaption.items.map((row) => row.caption);
		expect(captions).toEqual(
			[...captions].sort((first, second) => first.localeCompare(second, 'en-GB'))
		);

		const byFamily = await mockListCabinets({ sort: 'family', sortDir: 'asc', pageSize: 100 });
		const familyRanks = byFamily.items.map((row) => CABINET_FAMILIES.indexOf(row.family));
		expect(familyRanks).toEqual([...familyRanks].sort((first, second) => first - second));

		const newestFirst = await mockListCabinets({
			sort: 'updatedAt',
			sortDir: 'desc',
			pageSize: 100
		});
		expect(newestFirst.items[0]?.id).toBe(demoCabinetId(24));
		expect(newestFirst.items.at(-1)?.id).toBe(demoCabinetId(1));
	});

	it('paginates with the shared page shape', async () => {
		const second = await mockListCabinets({ page: 2, pageSize: 5 });

		expect(second.items).toHaveLength(5);
		expect(second.total).toBe(24);
		expect(second.page).toBe(2);
		expect(second.pageSize).toBe(5);
		expect(second.totalPages).toBe(5);
		expect(second.hasMore).toBe(true);

		const last = await mockListCabinets({ page: 5, pageSize: 5 });
		expect(last.items).toHaveLength(4);
		expect(last.hasMore).toBe(false);
	});

	it('counts parameters and rules per cabinet', async () => {
		const page = await mockListCabinets({ pageSize: 100 });
		const cabinetOne = page.items.find((row) => row.id === demoCabinetId(1));

		expect(cabinetOne).toMatchObject({
			caption: 'Base cabinet 600',
			family: 'base',
			constructionMethod: 'cam_lock',
			parameterCount: 18,
			ruleCount: 3,
			active: true
		});
	});
});

describe('mockGetCabinet', () => {
	it('returns parameters in sort order and rules newest version first', async () => {
		const detail = await mockGetCabinet(demoCabinetId(1));

		expect(detail.cabinet.caption).toBe('Base cabinet 600');
		expect(detail.parameters).toHaveLength(18);
		expect(detail.parameters.map((row) => row.paramName).slice(0, 3)).toEqual([
			'width',
			'height',
			'depth'
		]);
		expect(detail.parameters.every((row) => row.sortOrder >= 0)).toBe(true);
		expect(detail.parameters[0]).not.toHaveProperty('tenantId');

		expect(detail.rules.map((row) => row.ruleVersion)).toEqual(['2', '1', '1']);
		expect(detail.rules.map((row) => row.partType)).toEqual(['carcass', 'carcass', 'shelf']);
		expect(detail.rules[1]?.active).toBe(false);
		expect(detail.rules[0]?.id).toBe(demoCabinetRuleId(1, '2', 'carcass'));
	});

	it('returns 404 for an unknown id', async () => {
		await expect(mockGetCabinet('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});
	});
});

describe('mockCreateCabinet', () => {
	it('stores cabinet, parameters and rules with a resolved defaultConfig and an audit row', async () => {
		const created = await mockCreateCabinet(
			createInput({ caption: '  Guest   wall cabinet ', description: '  ' })
		);

		expect(isUuid(created.id)).toBe(true);
		expect(created).toMatchObject({
			caption: 'Guest wall cabinet',
			description: null,
			family: 'wall',
			constructionMethod: 'dowel',
			active: true,
			tenantId: OPULENT.id,
			defaultConfig: { width: 600, door_style: 'flat', carcass_note: null }
		});

		const detail = await mockGetCabinet(created.id);
		expect(detail.parameters).toHaveLength(3);
		expect(detail.rules).toHaveLength(1);
		expect(detail.rules[0]).toMatchObject({
			ruleVersion: '1',
			partType: 'carcass',
			active: true,
			condition: { minWidth: 300 }
		});

		const audit = listTenantAudit(OPULENT.id, 'cabinet', created.id);
		expect(audit.find((row) => row.action === 'create')?.payload).toMatchObject({
			caption: 'Guest wall cabinet',
			parameterCount: 3,
			ruleCount: 1
		});

		expect((await mockListCabinets({ pageSize: 100 })).total).toBe(25);
	});

	it('rejects an out-of-bounds parameter before inserting anything', async () => {
		const before = parameterRecords().length;
		const error = await mockCreateCabinet(
			createInput({
				parameters: [
					{ paramName: 'width', unit: 'mm', minValue: 300, maxValue: 600, defaultValue: 900 }
				]
			})
		).catch((cause: unknown) => cause);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({
			code: 'validation',
			status: 400
		});
		expect((error as ApiError).message).toContain('Parameter "width"');
		expect((error as ApiError).fieldErrors).toMatchObject({
			'parameters.0.defaultValue': 'Enter a default no higher than the maximum.'
		});

		expect((await mockListCabinets({ pageSize: 100 })).total).toBe(24);
		expect(cabinetRecords()).toHaveLength(24);
		expect(parameterRecords()).toHaveLength(before);
	});

	it('rejects a rule that references an unknown parameter', async () => {
		const error = await mockCreateCabinet(
			createInput({
				rules: [{ partType: 'shelf', expr: { length: 'width - plinth_height' } }]
			})
		).catch((cause: unknown) => cause);

		expect(error).toMatchObject({ code: 'validation', status: 400 });
		expect((error as ApiError).message).toContain('Unknown parameter "plinth_height"');
		expect((error as ApiError).fieldErrors).toMatchObject({
			'rules.0.expr': 'Unknown parameter "plinth_height".'
		});
		expect(cabinetRecords()).toHaveLength(24);
	});

	it('rejects duplicate parameter names and duplicate part types', async () => {
		await expect(
			mockCreateCabinet(
				createInput({
					parameters: [
						{ paramName: 'width', unit: 'mm', minValue: 1, maxValue: 10, defaultValue: 5 },
						{ paramName: 'width', unit: 'mm', minValue: 1, maxValue: 10, defaultValue: 5 }
					]
				})
			)
		).rejects.toMatchObject({ code: 'conflict', status: 409 });

		await expect(
			mockCreateCabinet(
				createInput({
					rules: [
						{ partType: 'carcass', expr: { length: 'width' } },
						{ partType: 'carcass', expr: { height: 'width' } }
					]
				})
			)
		).rejects.toMatchObject({ code: 'conflict', status: 409 });
	});
});

describe('mockUpdateCabinet', () => {
	it('updates fields and audits the changed field names', async () => {
		const updated = await mockUpdateCabinet(demoCabinetId(2), {
			caption: '  Renamed   drawer unit ',
			description: 'Updated drawer unit.'
		});

		expect(updated.caption).toBe('Renamed drawer unit');
		expect(updated.description).toBe('Updated drawer unit.');

		const audit = listTenantAudit(OPULENT.id, 'cabinet', demoCabinetId(2));
		expect(audit.find((row) => row.action === 'update')?.payload).toEqual({
			changedFields: ['caption', 'description']
		});
	});

	it('audits activate and deactivate when the active flag flips', async () => {
		const deactivated = await mockUpdateCabinet(demoCabinetId(3), { active: false });
		expect(deactivated.active).toBe(false);

		const deactivateAudit = listTenantAudit(OPULENT.id, 'cabinet', demoCabinetId(3));
		expect(deactivateAudit.find((row) => row.action === 'deactivate')?.payload).toEqual({
			changedFields: ['active']
		});

		const activated = await mockUpdateCabinet(demoCabinetId(3), { active: true });
		expect(activated.active).toBe(true);

		const activateAudit = listTenantAudit(OPULENT.id, 'cabinet', demoCabinetId(3));
		expect(activateAudit.some((row) => row.action === 'activate')).toBe(true);
	});

	it('rejects an empty caption', async () => {
		await expect(mockUpdateCabinet(demoCabinetId(1), { caption: '   ' })).rejects.toMatchObject({
			code: 'validation',
			status: 400,
			fieldErrors: { caption: 'Enter a cabinet caption.' }
		});
	});
});

describe('mockSaveParameter', () => {
	it('rejects an out-of-bounds edit and names the parameter', async () => {
		const error = await mockSaveParameter(demoCabinetId(1), {
			id: demoCabinetParameterId(1, 'width'),
			paramName: 'width',
			unit: 'mm',
			minValue: 300,
			maxValue: 1200,
			defaultValue: 1500
		}).catch((cause: unknown) => cause);

		expect(error).toMatchObject({ code: 'validation', status: 400 });
		expect((error as ApiError).message).toContain('Parameter "width"');
		expect((error as ApiError).fieldErrors).toMatchObject({
			defaultValue: 'Enter a default no higher than the maximum.'
		});

		const stored = parameterRecords().find((row) => row.id === demoCabinetParameterId(1, 'width'));
		expect(stored?.defaultValue).toBe(600);
	});

	it('conflicts when a new parameter name already exists on the cabinet', async () => {
		await expect(
			mockSaveParameter(demoCabinetId(1), {
				paramName: 'height',
				unit: 'mm',
				minValue: 400,
				maxValue: 1200,
				defaultValue: 720
			})
		).rejects.toMatchObject({
			code: 'conflict',
			status: 409,
			message: 'The parameter "height" already exists on this cabinet.'
		});
	});

	it('refuses an edit whose id belongs to another cabinet', async () => {
		await expect(
			mockSaveParameter(demoCabinetId(1), {
				id: demoCabinetParameterId(2, 'width'),
				paramName: 'width',
				unit: 'mm',
				minValue: 300,
				maxValue: 1200,
				defaultValue: 600
			})
		).rejects.toMatchObject({ code: 'not_found', status: 404 });
	});

	it('adds a parameter, recomputes defaultConfig and audits the cabinet_parameter', async () => {
		const saved = await mockSaveParameter(demoCabinetId(1), {
			paramName: 'cable_run',
			unit: 'count',
			minValue: 0,
			maxValue: 2,
			defaultValue: 1,
			sortOrder: 19
		});

		expect(isUuid(saved.id)).toBe(true);
		expect(saved).toMatchObject({ cabinetId: demoCabinetId(1), paramName: 'cable_run' });

		const cabinet = cabinetRecords().find((row) => row.id === demoCabinetId(1));
		expect(cabinet?.defaultConfig.cable_run).toBe(1);

		const audit = listTenantAudit(OPULENT.id, 'cabinet_parameter', saved.id);
		expect(audit.find((row) => row.action === 'update')?.payload).toMatchObject({
			cabinetId: demoCabinetId(1),
			paramName: 'cable_run',
			created: true
		});
	});

	it('edits an existing parameter in place and refreshes the cabinet defaults', async () => {
		const saved = await mockSaveParameter(demoCabinetId(1), {
			id: demoCabinetParameterId(1, 'width'),
			paramName: 'width',
			unit: 'mm',
			minValue: 300,
			maxValue: 1200,
			defaultValue: 800
		});

		expect(saved.id).toBe(demoCabinetParameterId(1, 'width'));
		expect(saved.defaultValue).toBe(800);
		expect(
			parameterRecords().filter(
				(row) => row.paramName === 'width' && row.cabinetId === demoCabinetId(1)
			)
		).toHaveLength(1);

		const cabinet = cabinetRecords().find((row) => row.id === demoCabinetId(1));
		expect(cabinet?.defaultConfig.width).toBe(800);
	});
});

describe('mockSaveRule', () => {
	it('saves the first version as "1" and audits it', async () => {
		const rule = await mockSaveRule(demoCabinetId(10), {
			partType: 'drawer_front',
			expr: { length: 'width - 20', qty: 1 }
		});

		expect(rule).toMatchObject({
			cabinetId: demoCabinetId(10),
			ruleVersion: '1',
			partType: 'drawer_front',
			active: true,
			condition: null
		});

		const audit = listTenantAudit(OPULENT.id, 'cabinet_rule', rule.id);
		expect(audit.find((row) => row.action === 'rule_version')?.payload).toMatchObject({
			cabinetId: demoCabinetId(10),
			partType: 'drawer_front',
			from: null,
			to: '1'
		});
	});

	it('updates in place when nothing functional changed', async () => {
		const first = await mockSaveRule(demoCabinetId(10), {
			partType: 'drawer_front',
			expr: { length: 'width - 20', qty: 1 }
		});
		const second = await mockSaveRule(demoCabinetId(10), {
			partType: 'drawer_front',
			expr: { qty: 1, length: 'width - 20' }
		});

		expect(second.id).toBe(first.id);
		expect(second.ruleVersion).toBe('1');
		expect(ruleRecords().filter((row) => row.partType === 'drawer_front')).toHaveLength(1);

		const audit = listTenantAudit(OPULENT.id, 'cabinet_rule', first.id);
		expect(audit.some((row) => row.action === 'update')).toBe(true);
	});

	it('creates a new version and deactivates the previous rows on a functional change', async () => {
		const first = await mockSaveRule(demoCabinetId(10), {
			partType: 'drawer_front',
			expr: { length: 'width - 20' }
		});
		const second = await mockSaveRule(demoCabinetId(10), {
			partType: 'drawer_front',
			expr: { length: 'width - 30' }
		});

		expect(second.id).not.toBe(first.id);
		expect(second.ruleVersion).toBe('2');
		expect(second.active).toBe(true);

		const rows = ruleRecords().filter((row) => row.partType === 'drawer_front');
		expect(rows).toHaveLength(2);
		expect(rows.find((row) => row.id === first.id)?.active).toBe(false);
		expect(rows.find((row) => row.id === second.id)?.active).toBe(true);

		const audit = listTenantAudit(OPULENT.id, 'cabinet_rule', second.id);
		expect(audit.find((row) => row.action === 'rule_version')?.payload).toMatchObject({
			from: '1',
			to: '2'
		});
	});

	it('bumps from the highest version number, not the row count', async () => {
		const first = await mockSaveRule(demoCabinetId(1), {
			partType: 'carcass',
			expr: { length: 'width - thickness' }
		});

		expect(first.ruleVersion).toBe('3');
	});

	it('rejects an invalid expression without writing a row', async () => {
		const before = ruleRecords().length;

		await expect(
			mockSaveRule(demoCabinetId(10), {
				partType: 'drawer_front',
				expr: { length: 'width - door_gap' }
			})
		).rejects.toMatchObject({
			code: 'validation',
			status: 400,
			fieldErrors: { expr: 'Unknown parameter "door_gap".' }
		});

		expect(ruleRecords()).toHaveLength(before);
	});
});

describe('mockSetRuleActive', () => {
	it('toggles active without deleting and audits both actions', async () => {
		const ruleId = demoCabinetRuleId(1, '2', 'carcass');
		const before = ruleRecords().length;

		const deactivated = await mockSetRuleActive(ruleId, false);
		expect(deactivated.active).toBe(false);
		expect(ruleRecords()).toHaveLength(before);

		const deactivateAudit = listTenantAudit(OPULENT.id, 'cabinet_rule', ruleId);
		expect(deactivateAudit.find((row) => row.action === 'deactivate')?.payload).toMatchObject({
			partType: 'carcass',
			ruleVersion: '2'
		});

		const activated = await mockSetRuleActive(ruleId, true);
		expect(activated.active).toBe(true);

		const activateAudit = listTenantAudit(OPULENT.id, 'cabinet_rule', ruleId);
		expect(activateAudit.some((row) => row.action === 'activate')).toBe(true);
		expect(ruleRecords()).toHaveLength(before);
	});
});

describe('rules list', () => {
	it('aggregates rules with the cabinet caption and filters version, active and search', async () => {
		const all = await mockListRules({ pageSize: 100 });
		expect(all.total).toBe(12);
		expect(all.items.find((row) => row.cabinetId === demoCabinetId(1))?.cabinetCaption).toBe(
			'Base cabinet 600'
		);

		expect((await mockListRules({ ruleVersion: '2' })).total).toBe(1);
		expect((await mockListRules({ ruleVersion: '1' })).total).toBe(11);
		expect((await mockListRules({ active: 'inactive' })).items.map((row) => row.id)).toEqual([
			demoCabinetRuleId(1, '1', 'carcass')
		]);
		expect((await mockListRules({ search: 'carcass' })).total).toBe(3);
		expect((await mockListRules({ search: 'base cabinet 600' })).total).toBe(3);
	});

	it('sorts and paginates', async () => {
		const byVersion = await mockListRules({
			sort: 'ruleVersion',
			sortDir: 'desc',
			pageSize: 100
		});
		expect(byVersion.items[0]?.ruleVersion).toBe('2');

		const second = await mockListRules({ page: 2, pageSize: 5 });
		expect(second.items).toHaveLength(5);
		expect(second.total).toBe(12);
		expect(second.totalPages).toBe(3);
		expect(second.hasMore).toBe(true);
	});

	it('lists distinct versions newest first', async () => {
		await expect(mockListRuleVersions()).resolves.toEqual(['2', '1']);
	});
});

describe('tenant isolation', () => {
	it('shows no Opulent catalogue to Harbour and hides other tenants with 404', async () => {
		signIn(HARBOUR_OWNER);

		expect((await mockListCabinets({})).total).toBe(0);
		expect((await mockListRules({})).total).toBe(0);
		await expect(mockListRuleVersions()).resolves.toEqual([]);

		await expect(mockGetCabinet(demoCabinetId(1))).rejects.toMatchObject({
			code: 'not_found',
			status: 404
		});
		await expect(
			mockUpdateCabinet(demoCabinetId(1), { caption: 'Hijacked' })
		).rejects.toMatchObject({ code: 'not_found', status: 404 });
		await expect(
			mockSaveParameter(demoCabinetId(1), {
				paramName: 'width',
				unit: 'mm',
				minValue: 1,
				maxValue: 10,
				defaultValue: 5
			})
		).rejects.toMatchObject({ code: 'not_found', status: 404 });
		await expect(
			mockSaveRule(demoCabinetId(1), { partType: 'carcass', expr: { length: 'width' } })
		).rejects.toMatchObject({ code: 'not_found', status: 404 });
		await expect(
			mockSetRuleActive(demoCabinetRuleId(1, '2', 'carcass'), false)
		).rejects.toMatchObject({ code: 'not_found', status: 404 });
	});

	it('creates Harbour cabinets inside Harbour only', async () => {
		signIn(HARBOUR_OWNER);
		const created = await mockCreateCabinet(createInput({ caption: 'Harbour only cabinet' }));
		expect(created.tenantId).toBe(HARBOUR.id);

		const harbourPage = await mockListCabinets({});
		expect(harbourPage.total).toBe(1);
		expect(harbourPage.items[0]?.id).toBe(created.id);

		signIn(OWNER);
		expect((await mockListCabinets({})).total).toBe(24);
	});
});

describe('permissions', () => {
	it('denies create and update to a view-only role', async () => {
		signIn(SALES);

		await expect(mockCreateCabinet(createInput())).rejects.toMatchObject({
			code: 'forbidden',
			status: 403
		});
		await expect(
			mockSaveParameter(demoCabinetId(1), {
				paramName: 'width',
				unit: 'mm',
				minValue: 1,
				maxValue: 10,
				defaultValue: 5
			})
		).rejects.toMatchObject({ code: 'forbidden', status: 403 });
	});

	it('denies listing to a role without cabinet.view', async () => {
		signIn(SURVEYOR);
		await expect(mockListCabinets({})).rejects.toMatchObject({
			code: 'forbidden',
			status: 403
		});
	});
});
