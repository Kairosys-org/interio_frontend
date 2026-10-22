import { describe, expect, it } from 'vitest';
import { demoCustomerId, demoProjectId, demoPropertyId } from '$shared/data/demo-record-plan';
import {
	CsvParseError,
	IMPORT_FIELDS,
	parseCsv,
	rowsToRecords,
	suggestColumnMap,
	validateImportRows,
	type ImportMatchContext
} from './csv';

const CONTEXT: ImportMatchContext = {
	customers: [
		{
			id: demoCustomerId(1),
			caption: 'A. Smith',
			email: 'alice.smith@example.com',
			phone: '02079460101',
			postcode: 'TW9 1AA'
		},
		{
			id: demoCustomerId(2),
			caption: 'The Hartley Family',
			email: 'james.hartley@example.com',
			phone: null,
			postcode: 'SW19 2BB'
		}
	],
	properties: [
		{
			id: demoPropertyId(1),
			addressLine1: '1 Oak Street',
			town: 'Richmond',
			postcode: 'TW9 1AA'
		}
	],
	projects: [
		{
			id: demoProjectId(1),
			propertyId: demoPropertyId(1),
			projectType: 'kitchen',
			caption: 'Kitchen renovation'
		}
	]
};

const CUSTOMER_MAP = {
	caption: 'caption',
	contact_name: 'contact_name',
	email: 'email',
	phone: 'phone',
	town: 'town',
	postcode: 'postcode',
	preferred_channel: 'preferred_channel'
};

describe('parseCsv', () => {
	it('parses headers, CRLF line endings and quoted values with commas', () => {
		const parsed = parseCsv(
			'caption,email\r\n"Smith, Alice",alice@example.com\r\nBob,bob@example.com'
		);

		expect(parsed.headers).toEqual(['caption', 'email']);
		expect(parsed.rows).toEqual([
			['Smith, Alice', 'alice@example.com'],
			['Bob', 'bob@example.com']
		]);
	});

	it('unescapes double quotes and keeps newlines inside quotes', () => {
		const parsed = parseCsv('caption,notes\n"Smith ""A""","Line one\nLine two"');

		expect(parsed.rows).toEqual([['Smith "A"', 'Line one\nLine two']]);
	});

	it('strips a UTF-8 BOM', () => {
		const parsed = parseCsv('\uFEFFcaption,email\nSmith,smith@example.com');
		expect(parsed.headers).toEqual(['caption', 'email']);
	});

	it('throws a readable error for an unclosed quote', () => {
		expect(() => parseCsv('caption\n"Never closed')).toThrow(CsvParseError);
		expect(() => parseCsv('caption\n"Never closed')).toThrow(/unclosed quoted value/i);
	});

	it('throws a readable error when a header is empty', () => {
		expect(() => parseCsv('caption,\nSmith,x')).toThrow(/Every column needs a heading/);
	});

	it('throws when the file has no data rows', () => {
		expect(() => parseCsv('caption,email')).toThrow(/no data rows/i);
	});

	it('converts positional rows into header-keyed records', () => {
		const parsed = parseCsv('caption,email\nSmith,smith@example.com');
		expect(rowsToRecords(parsed.headers, parsed.rows)).toEqual([
			{ caption: 'Smith', email: 'smith@example.com' }
		]);
	});
});

describe('IMPORT_FIELDS', () => {
	it('marks the required fields for every kind', () => {
		const required = (kind: keyof typeof IMPORT_FIELDS) =>
			IMPORT_FIELDS[kind].filter((field) => field.required).map((field) => field.key);

		expect(required('customer')).toEqual(['caption']);
		expect(required('property')).toEqual(['customer_email', 'address_line1']);
		expect(required('project')).toEqual([
			'customer_email',
			'property_address',
			'caption',
			'project_type'
		]);
	});
});

describe('suggestColumnMap', () => {
	it('maps canonical headers and common aliases', () => {
		expect(
			suggestColumnMap('customer', ['Name', 'Email address', 'Address', 'Preferred contact'])
		).toEqual({
			Name: 'caption',
			'Email address': 'email',
			Address: 'address_line1',
			'Preferred contact': 'preferred_channel'
		});

		expect(suggestColumnMap('property', ['Customer e-mail', 'Address', 'Post code'])).toEqual({
			'Customer e-mail': 'customer_email',
			Address: 'address_line1',
			'Post code': 'postcode'
		});

		expect(
			suggestColumnMap('project', ['Customer email', 'Site address', 'Job type', 'Name'])
		).toEqual({
			'Customer email': 'customer_email',
			'Site address': 'property_address',
			'Job type': 'project_type',
			Name: 'caption'
		});
	});

	it('leaves unknown headers out of the map', () => {
		expect(suggestColumnMap('customer', ['Caption', 'Favourite colour'])).toEqual({
			Caption: 'caption'
		});
	});
});

describe('validateImportRows', () => {
	it('marks unique rows ready and keeps the payload verbatim', () => {
		const rows = validateImportRows(
			'customer',
			[
				{
					caption: '  The Ellery Family ',
					email: 'sam.ellery@example.com',
					preferred_channel: 'email'
				}
			],
			CUSTOMER_MAP,
			CONTEXT
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toEqual({
			rowNo: 1,
			payload: {
				caption: '  The Ellery Family ',
				contact_name: '',
				email: 'sam.ellery@example.com',
				phone: '',
				town: '',
				postcode: '',
				preferred_channel: 'email'
			},
			validation: 'ready',
			error: null,
			matchId: null
		});
	});

	it('marks a normalised customer match needs_review with the match id', () => {
		const rows = validateImportRows(
			'customer',
			[
				{
					caption: ' a. smith ',
					email: 'ALICE.SMITH@example.com',
					phone: '020-7946-0101',
					postcode: 'tw91aa'
				}
			],
			CUSTOMER_MAP,
			CONTEXT
		);

		expect(rows[0]).toMatchObject({
			validation: 'needs_review',
			matchId: demoCustomerId(1),
			error: null
		});
	});

	it('rejects an unmapped or blank required field', () => {
		const unmapped = validateImportRows(
			'customer',
			[{ caption: 'Someone' }],
			{ email: 'email' },
			CONTEXT
		);
		expect(unmapped[0]).toMatchObject({
			validation: 'rejected',
			error: 'Caption is required.'
		});

		const blank = validateImportRows(
			'customer',
			[{ caption: '   ', email: 'someone@example.com' }],
			CUSTOMER_MAP,
			CONTEXT
		);
		expect(blank[0]).toMatchObject({ validation: 'rejected', error: 'Caption is required.' });
	});

	it('rejects an invalid email and an unknown preferred channel', () => {
		const badEmail = validateImportRows(
			'customer',
			[{ caption: 'New Person', email: 'not-an-email' }],
			CUSTOMER_MAP,
			CONTEXT
		);
		expect(badEmail[0]).toMatchObject({
			validation: 'rejected',
			error: 'Enter a valid email address.'
		});

		const badChannel = validateImportRows(
			'customer',
			[{ caption: 'New Person', email: 'new@example.com', preferred_channel: 'carrier pigeon' }],
			CUSTOMER_MAP,
			CONTEXT
		);
		expect(badChannel[0]).toMatchObject({
			validation: 'rejected',
			error: /Choose a preferred channel/
		});
	});

	it('rejects a property row whose customer email is unknown', () => {
		const rows = validateImportRows(
			'property',
			[{ customer_email: 'nobody@example.com', address_line1: '5 Cedar Avenue' }],
			{ customer_email: 'customer_email', address_line1: 'address_line1' },
			CONTEXT
		);
		expect(rows[0]).toMatchObject({
			validation: 'rejected',
			error: 'No customer matches that email address.'
		});
	});

	it('marks a normalised property match needs_review', () => {
		const rows = validateImportRows(
			'property',
			[
				{
					customer_email: 'alice.smith@example.com',
					address_line1: '1 oak street',
					postcode: 'tw9 1aa'
				}
			],
			{ customer_email: 'customer_email', address_line1: 'address_line1', postcode: 'postcode' },
			CONTEXT
		);
		expect(rows[0]).toMatchObject({
			validation: 'needs_review',
			matchId: demoPropertyId(1)
		});
	});

	it('rejects a project with an unknown property address or project type', () => {
		const unknownAddress = validateImportRows(
			'project',
			[
				{
					customer_email: 'alice.smith@example.com',
					property_address: 'Nowhere Lane',
					caption: 'Ghost project',
					project_type: 'kitchen'
				}
			],
			{
				customer_email: 'customer_email',
				property_address: 'property_address',
				caption: 'caption',
				project_type: 'project_type'
			},
			CONTEXT
		);
		expect(unknownAddress[0]).toMatchObject({
			validation: 'rejected',
			error: 'No property matches that address.'
		});

		const badType = validateImportRows(
			'project',
			[
				{
					customer_email: 'alice.smith@example.com',
					property_address: '1 Oak Street',
					caption: 'New project',
					project_type: 'spaceship'
				}
			],
			{
				customer_email: 'customer_email',
				property_address: 'property_address',
				caption: 'caption',
				project_type: 'project_type'
			},
			CONTEXT
		);
		expect(badType[0]).toMatchObject({
			validation: 'rejected',
			error: /Choose a project type/
		});
	});

	it('marks a project clash needs_review and a new project ready', () => {
		const columnMap = {
			customer_email: 'customer_email',
			property_address: 'property_address',
			caption: 'caption',
			project_type: 'project_type'
		};
		const clash = validateImportRows(
			'project',
			[
				{
					customer_email: 'alice.smith@example.com',
					property_address: '1 Oak Street',
					caption: 'Kitchen renovation',
					project_type: 'kitchen'
				}
			],
			columnMap,
			CONTEXT
		);
		expect(clash[0]).toMatchObject({ validation: 'needs_review', matchId: demoProjectId(1) });

		const fresh = validateImportRows(
			'project',
			[
				{
					customer_email: 'james.hartley@example.com',
					property_address: '1 Oak Street',
					caption: 'Garden studio',
					project_type: 'other'
				}
			],
			columnMap,
			CONTEXT
		);
		expect(fresh[0]).toMatchObject({ validation: 'ready', matchId: null });
	});
});
