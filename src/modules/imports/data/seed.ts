import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import {
	DEMO_CUSTOMER_PLAN,
	DEMO_PROJECT_PLAN,
	DEMO_PROPERTY_PLAN,
	demoCustomerId,
	demoImportBatchId,
	demoImportRowId,
	demoProjectId,
	demoPropertyId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS } from '$shared/data/demo-seed';
import type { ImportBatchRecord, ImportRowRecord } from '$shared/data/records';
import { normaliseEmail, normalisePhone, normalisePostcode } from '$shared/domain/dedup';
import type { ImportKind, ImportStatus } from '$shared/domain/record-states';
import { deterministicUuid } from '$shared/lib/deterministic';
import { parseCsv, rowsToRecords, suggestColumnMap, validateImportRows } from '../domain/csv';
import type { ImportMatchContext } from '../domain/csv';

/**
 * Import seed (phase-1 §5.2): three staged batches (one per kind), one
 * committed batch and one cancelled batch.
 *
 * Rows are literal CSV parsed and validated through the same domain functions
 * the wizard uses, so the seeded preview is indistinguishable from a real
 * upload. The match context is rebuilt from the shared record plan instead of
 * reading the mock DB (seeders must not depend on each other). Ids come from
 * `demoImportBatchId`/`demoImportRowId`, dates from `demoDays`: two resets are
 * byte-identical.
 */

const TENANT_ID = DEMO_TENANTS[0].id;
const CREATED_BY = deterministicUuid('user:opulent:sales');

/** Mirrors the states the records seeders assign; archived/cancelled never match. */
const CONTEXT: ImportMatchContext = {
	customers: DEMO_CUSTOMER_PLAN.filter((plan) => plan.n !== 22).map((plan) => ({
		id: demoCustomerId(plan.n),
		caption: plan.caption,
		email: normaliseEmail(plan.email),
		phone: normalisePhone(plan.phone),
		postcode: normalisePostcode(plan.postcode)
	})),
	properties: DEMO_PROPERTY_PLAN.filter((plan) => plan.n !== 40).map((plan) => ({
		id: demoPropertyId(plan.n),
		addressLine1: plan.addressLine1,
		town: plan.town,
		postcode: plan.postcode
	})),
	projects: DEMO_PROJECT_PLAN.filter((plan) => plan.status !== 'cancelled').map((plan) => ({
		id: demoProjectId(plan.n),
		propertyId: demoPropertyId(plan.propertyN),
		projectType: plan.projectType,
		caption: plan.caption
	}))
};

const CUSTOMER_CSV = [
	'caption,contact_name,email,phone,town,postcode,preferred_channel',
	'The Ellery Family,Sam Ellery,sam.ellery@example.com,020 7946 2001,Richmond,TW9 1AA,email',
	'Marlow Loft Studio,Ada Marlow,ada@marlowloft.example,020 7946 2002,Islington,N1 3CC,phone',
	'Rafael Costa,Rafael Costa,rafael.costa@example.com,020 7946 2003,Hackney,E8 4DD,sms',
	'A. Smith,Alice Smith,alice.smith@example.com,020 7946 0101,Richmond,TW9 1AA,email',
	',No Caption,nocaption@example.com,020 7946 2004,Richmond,TW9 1AA,email',
	'Bad Email,Bea Error,not-an-email,020 7946 2005,Richmond,TW9 1AA,email'
].join('\n');

const PROPERTY_CSV = [
	'customer_email,address_line1,address_line2,town,postcode,access_notes',
	'alice.smith@example.com,14 Willow Lane,,Richmond,TW9 1AA,Key safe beside the side gate.',
	'james.hartley@example.com,22 Birch Way,Flat 2,Wimbledon,SW19 2BB,',
	'nobody@example.com,5 Cedar Avenue,,Islington,N1 3CC,Unknown customer on purpose',
	'nina@brambleco.example,1 Oak Street,,Richmond,TW9 1AA,Matches an existing property'
].join('\n');

const PROJECT_CSV = [
	'customer_email,property_address,caption,project_type',
	'alice.smith@example.com,1 Oak Street,Kitchen renovation,kitchen',
	'isabelle.laurent@example.com,22 Elm Road,Garden studio,other',
	'yusuf.demir@example.com,30 Hawthorn Walk,Bathroom vanity,bathroom',
	'alice.smith@example.com,Nowhere Lane,Ghost project,kitchen'
].join('\n');

const COMMITTED_CSV = [
	'caption,contact_name,email,phone,town,postcode,preferred_channel',
	'A. Smith,Alice Smith,alice.smith@example.com,020 7946 0101,Richmond,TW9 1AA,email',
	'The Hartley Family,James Hartley,james.hartley@example.com,020 7946 0102,Wimbledon,SW19 2BB,phone',
	'Bramble & Co.,Nina Bramble,nina@brambleco.example,020 7946 0103,Islington,N1 3CC,email'
].join('\n');

const CANCELLED_CSV = [
	'caption,contact_name,email,phone,town,postcode,preferred_channel',
	',Legacy Row,legacy@example.com,020 7946 3001,Richmond,TW9 1AA,email',
	'Old Row,Old Contact,broken-email,020 7946 3002,Richmond,TW9 1AA,email'
].join('\n');

interface BatchSpec {
	key: string;
	kind: ImportKind;
	status: ImportStatus;
	fileName: string;
	csv: string;
	createdDays: number;
	committedDays: number | null;
	/** Committed customer batch: link row n to the existing customer id. */
	importedCustomerNs?: readonly number[];
}

const BATCHES: readonly BatchSpec[] = [
	{
		key: 'customer',
		kind: 'customer',
		status: 'staged',
		fileName: 'customer-enquiries.csv',
		csv: CUSTOMER_CSV,
		createdDays: 2,
		committedDays: null
	},
	{
		key: 'property',
		kind: 'property',
		status: 'staged',
		fileName: 'property-list.csv',
		csv: PROPERTY_CSV,
		createdDays: 4,
		committedDays: null
	},
	{
		key: 'project',
		kind: 'project',
		status: 'staged',
		fileName: 'project-handover.csv',
		csv: PROJECT_CSV,
		createdDays: 6,
		committedDays: null
	},
	{
		key: 'committed',
		kind: 'customer',
		status: 'committed',
		fileName: 'opening-customers.csv',
		csv: COMMITTED_CSV,
		createdDays: 20,
		committedDays: 19,
		importedCustomerNs: [1, 2, 3]
	},
	{
		key: 'cancelled',
		kind: 'customer',
		status: 'cancelled',
		fileName: 'legacy-customers.csv',
		csv: CANCELLED_CSV,
		createdDays: 35,
		committedDays: null
	}
];

interface SeededBatch {
	batch: ImportBatchRecord;
	rows: ImportRowRecord[];
}

function countBy(rows: readonly ImportRowRecord[], value: ImportRowRecord['validation']): number {
	return rows.filter((row) => row.validation === value).length;
}

function buildBatch(spec: BatchSpec): SeededBatch {
	const parsed = parseCsv(spec.csv);
	const columnMap = suggestColumnMap(spec.kind, parsed.headers);
	const validated = validateImportRows(
		spec.kind,
		rowsToRecords(parsed.headers, parsed.rows),
		columnMap,
		CONTEXT
	);

	const createdAt = demoDays(spec.createdDays);
	const committedAt = spec.committedDays === null ? null : demoDays(spec.committedDays);
	const batchId = demoImportBatchId(spec.key);

	const rows: ImportRowRecord[] = validated.map((row, index) => {
		const customerN = spec.importedCustomerNs?.[index];
		const imported = spec.status === 'committed';
		const cancelled = spec.status === 'cancelled';

		return {
			id: demoImportRowId(spec.key, row.rowNo),
			tenantId: TENANT_ID,
			batchId,
			rowNo: row.rowNo,
			payload: { ...row.payload },
			validation: row.validation,
			outcome: imported ? 'imported' : cancelled ? 'rejected' : null,
			error: row.error,
			entityType: imported ? 'customer' : null,
			entityId: customerN === undefined ? null : demoCustomerId(customerN),
			createdAt
		};
	});

	const importedRows = rows.filter((row) => row.outcome === 'imported').length;

	const batch: ImportBatchRecord = {
		id: batchId,
		tenantId: TENANT_ID,
		kind: spec.kind,
		status: spec.status,
		fileName: spec.fileName,
		columnMap,
		totalRows: rows.length,
		importedRows,
		readyRows: spec.status === 'staged' ? countBy(rows, 'ready') : 0,
		reviewRows: spec.status === 'staged' ? countBy(rows, 'needs_review') : 0,
		rejectedRows:
			spec.status === 'staged'
				? countBy(rows, 'rejected')
				: rows.filter((row) => row.outcome === 'rejected').length,
		createdAt,
		updatedAt: committedAt ?? createdAt,
		createdBy: CREATED_BY,
		committedAt
	};

	return { batch, rows };
}

export function seedImports(): Record<string, unknown[]> {
	const batches: ImportBatchRecord[] = [];
	const rows: ImportRowRecord[] = [];

	for (const spec of BATCHES) {
		const seeded = buildBatch(spec);
		batches.push(seeded.batch);
		rows.push(...seeded.rows);
	}

	return {
		[COLLECTIONS.importBatches]: batches,
		[COLLECTIONS.importRows]: rows
	};
}
