import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import AssignmentPanel from './AssignmentPanel.svelte';
import AuditTrailTab from './AuditTrailTab.svelte';
import ConfirmDialog from './ConfirmDialog.svelte';
import DataTable from './DataTable.svelte';
import DedupReviewModal from './DedupReviewModal.svelte';
import DetailSection from './DetailSection.svelte';
import EntityLink from './EntityLink.svelte';
import FormField from './FormField.svelte';
import GateBanner from './GateBanner.svelte';
import KeyValueGrid from './KeyValueGrid.svelte';
import PageHeader from './PageHeader.svelte';
import SearchInput from './SearchInput.svelte';
import StageIndicator from './StageIndicator.svelte';
import Stepper from './Stepper.svelte';

const text = (value: string) => createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));

const noop = () => {};

describe('records primitives render', () => {
	it('renders a page header', () => {
		const { body } = render(PageHeader, {
			props: {
				title: 'Customers',
				description: 'Everyone we build for.',
				eyebrow: 'Sales',
				actions: text('New customer')
			}
		});
		expect(body).toContain('<h1');
		expect(body).toContain('Customers');
		expect(body).toContain('New customer');
	});

	it('renders a form field with hint and error wiring', () => {
		const { body } = render(FormField, {
			props: {
				label: 'Width',
				forId: 'width',
				hint: 'In millimetres',
				error: 'Enter a width',
				required: true,
				children: text('control')
			}
		});
		expect(body).toContain('for="width"');
		expect(body).toContain('(required)');
		expect(body).toContain('id="width-error"');
		expect(body).toContain('role="alert"');
	});

	it('renders search input with an accessible name', () => {
		const { body } = render(SearchInput, {
			props: { label: 'Search customers', value: 'acme' }
		});
		expect(body).toContain('type="search"');
		expect(body).toContain('aria-label="Search customers"');
		expect(body).toContain('Clear search');
	});

	it('renders a data table with caption and sort state', () => {
		const { body } = render(DataTable, {
			props: {
				caption: 'Customers',
				columns: [
					{ key: 'name', label: 'Name', sortable: true },
					{ key: 'state', label: 'State' }
				],
				rows: [{ id: '1', name: 'Acme' }],
				rowKey: (row) => (row as { id: string }).id,
				cell: text('cell'),
				sort: { key: 'name', dir: 'asc' as const },
				onSort: noop,
				density: 'compact' as const
			}
		});
		expect(body).toContain('<table');
		expect(body).toContain('<caption');
		expect(body).toContain('aria-sort="ascending"');
	});

	it('renders a detail section, key-value grid and entity link', () => {
		const section = render(DetailSection, {
			props: { title: 'Address', children: text('12 Mill Lane') }
		});
		expect(section.body).toContain('<h2');
		expect(section.body).toContain('Address');

		const grid = render(KeyValueGrid, {
			props: {
				items: [
					{ label: 'Email', value: 'jane@example.com' },
					{ label: 'Phone', value: null }
				],
				columns: 2
			}
		});
		expect(grid.body).toContain('<dl');
		expect(grid.body).toContain('—');

		const link = render(EntityLink, {
			props: { href: '/customers/1', children: text('Acme') }
		});
		expect(link.body).toContain('href="/customers/1"');
	});

	it('renders the audit timeline with filter, time and details', () => {
		const { body } = render(AuditTrailTab, {
			props: {
				rows: [
					{
						id: '1',
						action: 'customer.updated',
						actorEmail: 'jane@example.com',
						occurredAt: '2026-10-22T13:05:00.000Z',
						payload: { to: 'archived' }
					}
				]
			}
		});
		expect(body).toContain('Customer updated');
		expect(body).toContain('By jane@example.com');
		expect(body).toContain('<time');
		expect(body).toContain('Details');
		expect(body).toContain('Filter by action');
	});

	it('renders stage, gate and stepper state in text', () => {
		const stages = [
			{ id: 's1', label: 'Enquiry', gateId: 'G1', state: 'passed' as const },
			{ id: 's2', label: 'Design', gateId: 'G2', state: 'current' as const },
			{ id: 's3', label: 'Quote', gateId: 'G3', state: 'future' as const }
		];
		const stage = render(StageIndicator, { props: { stages, compact: false } });
		expect(stage.body).toContain('aria-label="Project stages"');
		expect(stage.body).toContain('Stage 2 of 3: Design');
		expect(stage.body).toContain('aria-current="step"');
		expect(stage.body).toContain('Current');

		const gate = render(GateBanner, {
			props: {
				gates: [
					{
						id: 'G3',
						title: 'Quote cannot be issued yet.',
						state: 'blocking' as const,
						reasons: ['Design is not approved.']
					}
				],
				fixHref: '/designs/1',
				fixLabel: 'Open design'
			}
		});
		expect(gate.body).toContain('role="alert"');
		expect(gate.body).toContain('Design is not approved.');
		expect(gate.body).toContain('href="/designs/1"');

		const stepper = render(Stepper, {
			props: {
				steps: [
					{ id: '1', label: 'Customer' },
					{ id: '2', label: 'Property' }
				],
				current: 1,
				onstep: noop
			}
		});
		expect(stepper.body).toContain('<ol');
		expect(stepper.body).toContain('Completed');
		expect(stepper.body).toContain('Current');
	});

	it('renders assignment chips and available surveyors', () => {
		const { body } = render(AssignmentPanel, {
			props: {
				assignments: [
					{ id: 'a1', userId: 'u1', userName: 'Jane Smith', userEmail: 'jane@example.com' }
				],
				surveyors: [
					{ id: 'u1', displayName: 'Jane Smith', email: 'jane@example.com', assigned: true },
					{ id: 'u2', displayName: 'Sam Lee', email: 'sam@example.com', assigned: false }
				],
				onadd: noop,
				onremove: noop
			}
		});
		expect(body).toContain('Remove Jane Smith');
		expect(body).toContain('Sam Lee');
		expect(body).toContain('1 surveyor assigned');
	});

	it('renders the dedup review modal with no accidental default decision', () => {
		const { body } = render(DedupReviewModal, {
			props: {
				open: true,
				held: {
					id: 'held',
					caption: 'Jane Smith',
					state: 'pending_review',
					createdAt: '2026-10-22T13:05:00.000Z',
					fields: [{ label: 'Email', value: 'jane@example.com' }]
				},
				candidates: [
					{
						id: 'c1',
						caption: 'J. Smith',
						createdAt: '2026-10-20T09:00:00.000Z',
						matchReasons: ['Same email'],
						fields: [{ label: 'Email', value: 'jane@example.com' }]
					}
				],
				onreview: noop
			}
		});
		expect(body).toContain('Review possible duplicate');
		expect(body).toContain('Choose the matching record');
		expect(body).toContain('Same email');
		expect(body).toContain('Link to the existing record');
		expect(body).toContain('Confirm these are different records');
		expect(body).toContain('Submit review');
	});

	it('renders the confirm dialog footer actions', () => {
		const { body } = render(ConfirmDialog, {
			props: {
				open: true,
				title: 'Delete draft version V2?',
				description: 'This cannot be undone.',
				confirmLabel: 'Delete version',
				destructive: true,
				onconfirm: noop
			}
		});
		expect(body).toContain('Delete draft version V2?');
		expect(body).toContain('Cancel');
		expect(body).toContain('Delete version');
	});
});
