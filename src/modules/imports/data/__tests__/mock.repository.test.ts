import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));

// Other records modules own their seeders; importing them here registers the
// shared demo world (customers, properties, projects) this suite reads through.
import '$modules/customers/data/mock';
import '$modules/properties/data/mock';
import '$modules/projects/data/mock';

import { session } from '$shared/application/session';
import { COLLECTIONS } from '$shared/data/collections';
import {
	DEMO_CUSTOMER_PLAN,
	demoCustomerId,
	demoImportBatchId,
	demoImportRowId,
	demoPropertyId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import type {
	AppUserRecord,
	CustomerRecord,
	ImportBatchRecord,
	ImportRowRecord,
	ProjectRecord,
	PropertyRecord
} from '$shared/data/records';
import type { SessionUser, TenantIdentity } from '$shared/domain/user';
import { isUuid } from '$shared/domain/uuid';
import { deterministicUuid } from '$shared/lib/deterministic';
import { ApiError } from '$network/errors';
import { getCollection, resetMockDb, setCollection, updateCollection } from '$network/mock-backend';
import type { CreateImportInput } from '../../domain/types';
import {
	mockCommitImport,
	mockCreateImport,
	mockGetImport,
	mockListImportAudit,
	mockListImportRows,
	mockListImports
} from '../mock';

const OPULENT = DEMO_TENANTS[0];
const HARBOUR = DEMO_TENANTS[1];
const OWNER = 'owner@opulentinteriors.co.uk';
const SALES = 'sales@opulentinteriors.co.uk';
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

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof ApiError) return error;
		throw error;
	}
	throw new Error('Expected the call to reject with an ApiError.');
}

const CUSTOMER_MAP = {
	caption: 'caption',
	contact_name: 'contact_name',
	email: 'email',
	phone: 'phone',
	town: 'town',
	postcode: 'postcode',
	preferred_channel: 'preferred_channel'
};

function customerCsv(rows: readonly string[]): string {
	return ['caption,contact_name,email,phone,town,postcode,preferred_channel', ...rows].join('\n');
}

function createInput(overrides: Partial<CreateImportInput> = {}): CreateImportInput {
	return {
		kind: 'customer',
		fileName: 'customers.csv',
		csvText: customerCsv([
			'The Ellery Family,Sam Ellery,sam.ellery@example.com,020 7946 2001,Richmond,TW9 1AA,email'
		]),
		columnMap: CUSTOMER_MAP,
		...overrides
	};
}

function batchRecord(id: string): ImportBatchRecord | undefined {
	return getCollection<ImportBatchRecord>(COLLECTIONS.importBatches).find((row) => row.id === id);
}

function rowRecords(batchId: string): ImportRowRecord[] {
	return getCollection<ImportRowRecord>(COLLECTIONS.importRows)
		.filter((row) => row.batchId === batchId)
		.sort((first, second) => first.rowNo - second.rowNo);
}

function customerIds(): string[] {
	return getCollection<CustomerRecord>(COLLECTIONS.customers).map((row) => row.id);
}

function manualCustomer(overrides: Partial<CustomerRecord>): CustomerRecord {
	return {
		id: crypto.randomUUID(),
		tenantId: OPULENT.id,
		caption: 'Grace Hopper',
		contactName: 'Grace Hopper',
		email: 'grace@example.com',
		phone: null,
		addressLine1: null,
		addressLine2: null,
		town: null,
		postcode: null,
		preferredChannel: 'email',
		source: 'other',
		leadUuid: null,
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		createdBy: null,
		archivedAt: null,
		...overrides
	};
}

beforeEach(() => {
	(globalThis as { localStorage?: Storage }).localStorage = createMemoryStorage();
	resetMockDb();
	// Auth owns these two collections; the records modules own the rest.
	setCollection(
		COLLECTIONS.tenants,
		DEMO_TENANTS.map((tenant) => ({ ...tenant }))
	);
	setCollection(
		COLLECTIONS.appUsers,
		DEMO_USERS.map((user) => ({ ...user }))
	);
});

afterEach(() => {
	session.clearSession();
	delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('imports seed', () => {
	it('seeds three staged batches, one committed and one cancelled', () => {
		const batches = getCollection<ImportBatchRecord>(COLLECTIONS.importBatches);
		expect(batches.map((batch) => batch.id)).toEqual([
			demoImportBatchId('customer'),
			demoImportBatchId('property'),
			demoImportBatchId('project'),
			demoImportBatchId('committed'),
			demoImportBatchId('cancelled')
		]);

		const counts = Object.fromEntries(batches.map((batch) => [batch.id, batch])) as Record<
			string,
			ImportBatchRecord
		>;

		expect(counts[demoImportBatchId('customer')]).toMatchObject({
			kind: 'customer',
			status: 'staged',
			totalRows: 6,
			readyRows: 3,
			reviewRows: 1,
			rejectedRows: 2,
			importedRows: 0,
			committedAt: null
		});
		expect(counts[demoImportBatchId('property')]).toMatchObject({
			kind: 'property',
			status: 'staged',
			totalRows: 4,
			readyRows: 2,
			reviewRows: 1,
			rejectedRows: 1
		});
		expect(counts[demoImportBatchId('project')]).toMatchObject({
			kind: 'project',
			status: 'staged',
			totalRows: 4,
			readyRows: 2,
			reviewRows: 1,
			rejectedRows: 1
		});
		expect(counts[demoImportBatchId('committed')]).toMatchObject({
			status: 'committed',
			totalRows: 3,
			importedRows: 3,
			readyRows: 0,
			reviewRows: 0,
			rejectedRows: 0
		});
		expect(counts[demoImportBatchId('cancelled')]).toMatchObject({
			status: 'cancelled',
			totalRows: 2,
			importedRows: 0,
			rejectedRows: 2,
			committedAt: null
		});
	});

	it('links the committed rows to existing seeded customers without adding any', () => {
		const rows = rowRecords(demoImportBatchId('committed'));
		expect(rows.map((row) => row.outcome)).toEqual(['imported', 'imported', 'imported']);
		expect(rows.map((row) => row.entityId)).toEqual([
			demoCustomerId(1),
			demoCustomerId(2),
			demoCustomerId(3)
		]);
		expect(getCollection<CustomerRecord>(COLLECTIONS.customers)).toHaveLength(
			DEMO_CUSTOMER_PLAN.length
		);
	});

	it('uses plan ids for batches and rows', () => {
		const rows = rowRecords(demoImportBatchId('customer'));
		expect(rows.map((row) => row.id)).toEqual(
			[1, 2, 3, 4, 5, 6].map((n) => demoImportRowId('customer', n))
		);
		for (const row of rows) expect(isUuid(row.id)).toBe(true);
	});

	it('produces byte-identical import data on two consecutive resets', () => {
		const snapshot = () =>
			JSON.stringify({
				batches: getCollection<ImportBatchRecord>(COLLECTIONS.importBatches),
				rows: getCollection<ImportRowRecord>(COLLECTIONS.importRows)
			});

		const first = snapshot();
		resetMockDb();
		expect(snapshot()).toBe(first);
	});
});

describe('mockListImports', () => {
	beforeEach(() => {
		signIn(OWNER);
	});

	it('lists newest first with counts', async () => {
		const page = await mockListImports({});

		expect(page.total).toBe(5);
		expect(page.items.map((batch) => batch.id)).toEqual([
			demoImportBatchId('customer'),
			demoImportBatchId('property'),
			demoImportBatchId('project'),
			demoImportBatchId('committed'),
			demoImportBatchId('cancelled')
		]);
		expect(page.items[0]).toMatchObject({ totalRows: 6, readyRows: 3, rejectedRows: 2 });
	});

	it('filters by kind and status', async () => {
		expect((await mockListImports({ kind: 'customer' })).total).toBe(3);
		expect((await mockListImports({ kind: 'property' })).items.map((row) => row.kind)).toEqual([
			'property'
		]);
		expect((await mockListImports({ status: 'staged' })).total).toBe(3);
		expect((await mockListImports({ status: 'committed' })).items[0]?.id).toBe(
			demoImportBatchId('committed')
		);
		expect((await mockListImports({ kind: 'customer', status: 'cancelled' })).total).toBe(1);
	});

	it('paginates like a server', async () => {
		const first = await mockListImports({ page: 1, pageSize: 2 });
		const last = await mockListImports({ page: 3, pageSize: 2 });

		expect(first.items).toHaveLength(2);
		expect(first.totalPages).toBe(3);
		expect(first.hasMore).toBe(true);
		expect(last.items).toHaveLength(1);
		expect(last.hasMore).toBe(false);
	});

	it('returns 404 for another tenant’s batch', async () => {
		expect((await mockGetImport(demoImportBatchId('customer'))).id).toBe(
			demoImportBatchId('customer')
		);

		signIn(HARBOUR_OWNER);
		const missing = await captureError(mockGetImport(demoImportBatchId('customer')));
		expect(missing).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('mockListImportRows', () => {
	beforeEach(() => {
		signIn(OWNER);
	});

	it('shows staged rows ordered by row number', async () => {
		const page = await mockListImportRows(demoImportBatchId('customer'), {});
		expect(page.total).toBe(6);
		expect(page.items.map((row) => row.rowNo)).toEqual([1, 2, 3, 4, 5, 6]);
		expect(page.items.every((row) => row.outcome === null)).toBe(true);
	});

	it('filters preview rows by validation while staged', async () => {
		const rejected = await mockListImportRows(demoImportBatchId('customer'), {
			result: 'rejected'
		});
		expect(rejected.total).toBe(2);
		expect(rejected.items.map((row) => row.validation)).toEqual(['rejected', 'rejected']);

		const review = await mockListImportRows(demoImportBatchId('customer'), {
			result: 'needs_review'
		});
		expect(review.items[0]).toMatchObject({
			validation: 'needs_review',
			error: null,
			payload: { caption: 'A. Smith' }
		});

		expect(
			(await mockListImportRows(demoImportBatchId('customer'), { result: 'ready' })).total
		).toBe(3);
		expect(
			(await mockListImportRows(demoImportBatchId('customer'), { result: 'imported' })).total
		).toBe(0);
	});

	it('filters committed rows by outcome', async () => {
		const imported = await mockListImportRows(demoImportBatchId('committed'), {
			result: 'imported'
		});
		expect(imported.total).toBe(3);
		expect(imported.items.map((row) => row.entityId)).toEqual([
			demoCustomerId(1),
			demoCustomerId(2),
			demoCustomerId(3)
		]);

		const cancelled = await mockListImportRows(demoImportBatchId('cancelled'), {
			result: 'rejected'
		});
		expect(cancelled.total).toBe(2);
	});

	it('returns 404 for another tenant’s rows', async () => {
		signIn(HARBOUR_OWNER);
		const error = await captureError(mockListImportRows(demoImportBatchId('customer')));
		expect(error).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('mockCreateImport', () => {
	beforeEach(() => {
		signIn(OWNER);
	});

	it('stages rows with validation, counts and an audit event', async () => {
		const csvText = customerCsv([
			'The Ellery Family,Sam Ellery,sam.ellery@example.com,020 7946 2001,Richmond,TW9 1AA,email',
			',No Caption,nocaption@example.com,020 7946 2002,Richmond,TW9 1AA,email',
			'A. Smith,Alice Smith,alice.smith@example.com,020 7946 0101,Richmond,TW9 1AA,email'
		]);
		const batch = await mockCreateImport(createInput({ csvText }));

		expect(batch).toMatchObject({
			kind: 'customer',
			status: 'staged',
			totalRows: 3,
			readyRows: 1,
			reviewRows: 1,
			rejectedRows: 1,
			importedRows: 0,
			committedAt: null
		});
		expect(isUuid(batch.id)).toBe(true);

		const rows = rowRecords(batch.id);
		expect(rows.map((row) => row.validation)).toEqual(['ready', 'rejected', 'needs_review']);
		expect(rows.map((row) => row.outcome)).toEqual([null, null, null]);
		expect(rows[1]?.error).toBe('Caption is required.');

		const audit = await mockListImportAudit(batch.id);
		expect(audit.map((row) => row.action)).toEqual(['create']);
		expect(audit[0]?.payload).toEqual({ kind: 'customer', totalRows: 3 });
	});

	it('persists the column map and keeps the parsed payload verbatim', async () => {
		const batch = await mockCreateImport(
			createInput({
				csvText: customerCsv([
					'  The Ellery Family ,Sam Ellery,sam.ellery@example.com,,Richmond,TW9 1AA,email'
				])
			})
		);
		const row = rowRecords(batch.id)[0];

		expect(batch.columnMap).toEqual(CUSTOMER_MAP);
		expect(row?.payload).toEqual({
			caption: '  The Ellery Family ',
			contact_name: 'Sam Ellery',
			email: 'sam.ellery@example.com',
			phone: '',
			town: 'Richmond',
			postcode: 'TW9 1AA',
			preferred_channel: 'email'
		});
	});

	it('allows the same file name more than once', async () => {
		const first = await mockCreateImport(createInput());
		const second = await mockCreateImport(createInput());

		expect(second.id).not.toBe(first.id);
		expect((await mockListImports({ kind: 'customer' })).total).toBe(5);
	});

	it('rejects a malformed CSV with 400 and creates nothing', async () => {
		const before = getCollection<ImportBatchRecord>(COLLECTIONS.importBatches).length;
		const error = await captureError(
			mockCreateImport(createInput({ csvText: 'caption\n"never closed' }))
		);

		expect(error).toMatchObject({ code: 'validation', status: 400 });
		expect(error.message).toMatch(/unclosed quoted value/i);
		expect(getCollection<ImportBatchRecord>(COLLECTIONS.importBatches)).toHaveLength(before);
	});

	it('rejects a missing required mapping with the field label', async () => {
		const error = await captureError(
			mockCreateImport(createInput({ columnMap: { email: 'email' } }))
		);

		expect(error).toMatchObject({ code: 'validation', status: 400 });
		expect(error.message).toBe('Map the required columns: Caption.');
	});

	it('rejects an unknown mapped field', async () => {
		const error = await captureError(
			mockCreateImport(createInput({ columnMap: { ...CUSTOMER_MAP, caption: 'nickname' } }))
		);
		expect(error).toMatchObject({ code: 'validation', status: 400 });
		expect(error.message).toContain('nickname');
	});

	it('requires import.create', async () => {
		signIn(SALES);
		const error = await captureError(mockCreateImport(createInput()));
		expect(error).toMatchObject({ code: 'forbidden', status: 403 });
	});
});

describe('mockCommitImport', () => {
	beforeEach(() => {
		signIn(OWNER);
	});

	it('commits the seeded customer batch: imports ready rows and holds the clash', async () => {
		const batchId = demoImportBatchId('customer');
		const before = customerIds();

		const result = await mockCommitImport(batchId);

		expect(result).toMatchObject({ created: 3, held: 1, rejected: 2 });
		expect(result.batch).toMatchObject({
			status: 'committed',
			importedRows: 3,
			readyRows: 0,
			reviewRows: 1,
			rejectedRows: 2
		});
		expect(result.batch.committedAt).not.toBeNull();
		expect(result.batch.updatedAt).toBe(result.batch.committedAt);

		const after = getCollection<CustomerRecord>(COLLECTIONS.customers);
		const created = after.filter((row) => !before.includes(row.id));
		expect(created).toHaveLength(4);

		const active = created.filter((row) => row.state === 'active');
		expect(active.map((row) => row.caption).sort()).toEqual([
			'Marlow Loft Studio',
			'Rafael Costa',
			'The Ellery Family'
		]);
		expect(active.every((row) => row.tenantId === OPULENT.id)).toBe(true);

		const held = created.filter((row) => row.state === 'pending_review');
		expect(held).toHaveLength(1);
		expect(held[0]).toMatchObject({
			caption: 'A. Smith',
			dedupOfId: demoCustomerId(1),
			email: 'alice.smith@example.com'
		});

		const rows = rowRecords(batchId);
		expect(rows.map((row) => row.outcome)).toEqual([
			'imported',
			'imported',
			'imported',
			'needs_review',
			'rejected',
			'rejected'
		]);
		expect(rows[3]?.entityType).toBe('customer');
		expect(rows[3]?.entityId).toBe(held[0]?.id);
		expect(rows[4]?.error).toBe('Caption is required.');
		expect(rows[5]?.error).toBe('Enter a valid email address.');
	});

	it('audits the commit with imported, held and rejected counts', async () => {
		await mockCommitImport(demoImportBatchId('customer'));
		const audit = await mockListImportAudit(demoImportBatchId('customer'));
		const commit = audit.find((row) => row.action === 'import_commit');

		expect(commit?.subjectType).toBe('import_batch');
		expect(commit?.payload).toEqual({ imported: 3, held: 1, rejected: 2 });
	});

	it('commits the property batch and links rows to their customer', async () => {
		const beforeIds = getCollection<PropertyRecord>(COLLECTIONS.properties).map((row) => row.id);
		const result = await mockCommitImport(demoImportBatchId('property'));

		expect(result).toMatchObject({ created: 2, held: 1, rejected: 1 });

		const created = getCollection<PropertyRecord>(COLLECTIONS.properties).filter(
			(row) => !beforeIds.includes(row.id)
		);
		expect(created).toHaveLength(3);
		expect(created.filter((row) => row.state === 'active')).toHaveLength(2);
		expect(created.find((row) => row.state === 'pending_review')).toMatchObject({
			addressLine1: '1 Oak Street',
			customerId: demoCustomerId(3),
			dedupOfId: demoPropertyId(1)
		});

		const rows = rowRecords(demoImportBatchId('property'));
		expect(rows.map((row) => row.outcome)).toEqual([
			'imported',
			'imported',
			'rejected',
			'needs_review'
		]);
	});

	it('commits the project batch, generating references and holding the clash', async () => {
		const beforeIds = getCollection<ProjectRecord>(COLLECTIONS.projects).map((row) => row.id);
		const result = await mockCommitImport(demoImportBatchId('project'));

		expect(result).toMatchObject({ created: 2, held: 1, rejected: 1 });

		const created = getCollection<ProjectRecord>(COLLECTIONS.projects).filter(
			(row) => !beforeIds.includes(row.id)
		);
		expect(created).toHaveLength(3);

		const active = created.filter((row) => row.state === 'active');
		expect(active).toHaveLength(2);
		for (const project of active) {
			expect(project.reference).toMatch(/^OPULENT-\d{4}-\d{4}$/);
			expect(isUuid(project.id)).toBe(true);
		}
		expect(new Set(active.map((row) => row.reference)).size).toBe(2);

		const held = created.find((row) => row.state === 'pending_review');
		expect(held).toMatchObject({
			caption: 'Kitchen renovation',
			projectType: 'kitchen',
			propertyId: demoPropertyId(1),
			dedupOfId: null
		});

		const rows = rowRecords(demoImportBatchId('project'));
		expect(rows.map((row) => row.outcome)).toEqual([
			'needs_review',
			'imported',
			'imported',
			'rejected'
		]);
		expect(rows[3]?.error).toBe('No property matches that address.');
	});

	it('holds a row that only clashes at commit time', async () => {
		const batch = await mockCreateImport(
			createInput({
				csvText: customerCsv([
					'Grace Hopper,Grace Hopper,grace@example.com,,Richmond,TW9 1AA,email'
				])
			})
		);

		const concurrent = manualCustomer({});
		updateCollection<CustomerRecord>(COLLECTIONS.customers, (rows) => [...rows, concurrent]);

		const result = await mockCommitImport(batch.id);

		expect(result).toMatchObject({ created: 0, held: 1, rejected: 0 });
		const heldRow = rowRecords(batch.id)[0];
		expect(heldRow?.outcome).toBe('needs_review');
		expect(heldRow?.entityId).not.toBeNull();

		const held = getCollection<CustomerRecord>(COLLECTIONS.customers).find(
			(row) => row.id === heldRow?.entityId
		);
		expect(held).toMatchObject({
			state: 'pending_review',
			dedupOfId: concurrent.id,
			caption: 'Grace Hopper'
		});
	});

	it('refuses a second commit, a committed batch and a cancelled batch with 409', async () => {
		await mockCommitImport(demoImportBatchId('customer'));

		const again = await captureError(mockCommitImport(demoImportBatchId('customer')));
		expect(again).toMatchObject({ code: 'conflict', status: 409 });
		expect(again.message).toContain('Only staged batches can be committed');

		const committed = await captureError(mockCommitImport(demoImportBatchId('committed')));
		expect(committed).toMatchObject({ code: 'conflict', status: 409 });

		const cancelled = await captureError(mockCommitImport(demoImportBatchId('cancelled')));
		expect(cancelled).toMatchObject({ code: 'conflict', status: 409 });
	});

	it('keeps committed and cancelled batches read-only', async () => {
		const committed = await mockGetImport(demoImportBatchId('committed'));
		const cancelled = await mockGetImport(demoImportBatchId('cancelled'));

		expect(committed.status).toBe('committed');
		expect(cancelled.status).toBe('cancelled');
		expect((await mockListImportRows(demoImportBatchId('committed'))).total).toBe(3);
		expect((await mockListImportRows(demoImportBatchId('cancelled'))).total).toBe(2);
	});

	it('commits atomically: a rejected row creates no record', async () => {
		const batch = await mockCreateImport(
			createInput({
				csvText: customerCsv([
					'Grace Hopper,Grace Hopper,grace@example.com,,Richmond,TW9 1AA,email',
					',Broken Row,broken@example.com,,Richmond,TW9 1AA,email'
				])
			})
		);
		const before = customerIds().length;

		const result = await mockCommitImport(batch.id);

		expect(result).toMatchObject({ created: 1, held: 0, rejected: 1 });
		const customers = getCollection<CustomerRecord>(COLLECTIONS.customers);
		expect(customers).toHaveLength(before + 1);
		expect(customers.some((row) => row.email === 'broken@example.com')).toBe(false);

		const rows = rowRecords(batch.id);
		expect(rows.map((row) => row.outcome)).toEqual(['imported', 'rejected']);
		expect(rows[1]?.entityId).toBeNull();
	});

	it('requires import.create to commit', async () => {
		signIn(SALES);
		const error = await captureError(mockCommitImport(demoImportBatchId('customer')));
		expect(error).toMatchObject({ code: 'forbidden', status: 403 });
	});
});

describe('tenant isolation and permissions', () => {
	it('refuses an anonymous caller', async () => {
		const error = await captureError(mockListImports({}));
		expect(error).toMatchObject({ code: 'unauthorized', status: 401 });
	});

	it('refuses a platform user', async () => {
		signIn('platform@interio.app');
		const error = await captureError(mockListImports({}));
		expect(error).toMatchObject({ code: 'forbidden', status: 403 });
	});

	it('denies Sales, who holds no import permission in the spec matrix', async () => {
		signIn(SALES);
		expect(await captureError(mockListImports({}))).toMatchObject({
			code: 'forbidden',
			status: 403
		});
		expect(await captureError(mockGetImport(demoImportBatchId('customer')))).toMatchObject({
			code: 'forbidden',
			status: 403
		});
	});

	it('keeps another tenant’s batches out of the list and the audit', async () => {
		signIn(HARBOUR_OWNER);
		expect((await mockListImports({})).total).toBe(0);

		const opulentBatch = await captureError(mockGetImport(demoImportBatchId('customer')));
		expect(opulentBatch).toMatchObject({ code: 'not_found', status: 404 });

		const commit = await captureError(mockCommitImport(demoImportBatchId('customer')));
		expect(commit).toMatchObject({ code: 'not_found', status: 404 });

		const audit = await captureError(mockListImportAudit(demoImportBatchId('customer')));
		expect(audit).toMatchObject({ code: 'not_found', status: 404 });
	});

	it('takes the tenant from the session when staging', async () => {
		signIn(OWNER);
		const batch = await mockCreateImport(createInput());
		expect(batchRecord(batch.id)?.tenantId).toBe(OPULENT.id);
		expect(batchRecord(batch.id)?.tenantId).not.toBe(HARBOUR.id);
	});
});

describe('supplier and decor imports', () => {
	const MANUFACTURER_ID = deterministicUuid('imports-test:manufacturer');
	const COLLECTION_ID = deterministicUuid('imports-test:collection');
	const EXISTING_DECOR_ID = deterministicUuid('imports-test:decor');

	function installMaterials(): void {
		setCollection(COLLECTIONS.manufacturers, [
			{
				id: MANUFACTURER_ID,
				tenantId: OPULENT.id,
				caption: 'Egger',
				country: 'Austria',
				website: null,
				active: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}
		]);
		setCollection(COLLECTIONS.materialCollections, [
			{
				id: COLLECTION_ID,
				tenantId: OPULENT.id,
				manufacturerId: MANUFACTURER_ID,
				caption: 'Classic',
				active: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}
		]);
		setCollection(COLLECTIONS.decors, [
			{
				id: EXISTING_DECOR_ID,
				tenantId: OPULENT.id,
				collectionId: COLLECTION_ID,
				caption: 'Existing oak',
				decorCode: 'ABC-1',
				textureSurface: null,
				colourFamily: 'brown',
				materialType: 'melamine_board',
				core: 'chipboard',
				defaultThicknessMm: 18,
				sheetSizeMm: { length: 2800, width: 2070 },
				grainDirection: null,
				premiumTier: 'standard',
				status: 'active',
				customerVisible: true,
				sampleAssetId: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}
		]);
	}

	it('creates suppliers and flags a name clash without merging', async () => {
		signIn(OWNER);
		setCollection(COLLECTIONS.suppliers, [
			{
				id: deterministicUuid('imports-test:supplier'),
				tenantId: OPULENT.id,
				caption: 'Hafele UK',
				contact: 'orders@hafele.example',
				leadTimeDays: 10,
				active: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}
		]);

		const batch = await mockCreateImport({
			kind: 'supplier',
			fileName: 'suppliers.csv',
			csvText: [
				'caption,contact,lead_time_days',
				'Blum UK,orders@blum.example,7',
				'Hafele UK,orders@hafele.example,10'
			].join('\n'),
			columnMap: { caption: 'caption', contact: 'contact', lead_time_days: 'lead_time_days' }
		});
		expect(batch).toMatchObject({ readyRows: 1, reviewRows: 1, rejectedRows: 0 });

		const result = await mockCommitImport(batch.id);
		expect(result).toMatchObject({ created: 1, held: 1, rejected: 0 });

		const suppliers = getCollection<{ caption: string; tenantId: string }>(
			COLLECTIONS.suppliers
		).filter((row) => row.tenantId === OPULENT.id);
		expect(suppliers.map((row) => row.caption)).toEqual(['Hafele UK', 'Blum UK', 'Hafele UK']);

		const audit = await mockListImportAudit(batch.id);
		expect(audit.some((row) => row.action === 'create')).toBe(true);
	});

	it('creates decors inside an existing collection and rejects bad codes', async () => {
		signIn(OWNER);
		installMaterials();

		const batch = await mockCreateImport({
			kind: 'decor',
			fileName: 'decors.csv',
			csvText: [
				'manufacturer,collection,caption,decor_code,material_type,customer_visible',
				'Egger,Classic,Smoked oak,OAK-1,veneer,yes',
				'Egger,Classic,Copy of existing,ABC-1,melamine_board,no',
				'Unknown,Classic,Orphan,ORP-1,melamine_board,yes'
			].join('\n'),
			columnMap: {
				manufacturer: 'manufacturer',
				collection: 'collection',
				caption: 'caption',
				decor_code: 'decor_code',
				material_type: 'material_type',
				customer_visible: 'customer_visible'
			}
		});
		expect(batch).toMatchObject({ readyRows: 1, reviewRows: 0, rejectedRows: 2 });

		const result = await mockCommitImport(batch.id);
		expect(result).toMatchObject({ created: 1, held: 0, rejected: 2 });

		const decors = getCollection<{
			id: string;
			collectionId: string;
			decorCode: string;
			materialType: string;
			customerVisible: boolean;
		}>(COLLECTIONS.decors).filter((row) => row.id !== EXISTING_DECOR_ID);
		expect(decors).toHaveLength(1);
		expect(decors[0]).toMatchObject({
			collectionId: COLLECTION_ID,
			decorCode: 'OAK-1',
			materialType: 'veneer',
			customerVisible: true
		});
	});
});
