<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { CircleAlert, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import type { CustomerState } from '$shared/domain/record-states';
	import { formatCount, formatDate } from '$shared/lib/format';
	import {
		Button,
		ConfirmDialog,
		DataTable,
		EmptyState,
		EntityLink,
		PageHeader,
		Pagination,
		PermissionGate,
		SearchInput,
		Select,
		StateChip
	} from '$shared/presentation/ui';
	import { customersApi } from '../../data/api';
	import type { CustomerDedupConflict, CustomerListRow, CustomerSort } from '../../domain/types';
	import CustomerDedupReview from '../components/CustomerDedupReview.svelte';
	import CustomerFormDialog from '../components/CustomerFormDialog.svelte';

	/**
	 * `/customers` list (DESIGN §10.2 List): header, toolbar, data table,
	 * keyset pagination. Search, state, sort and page live in the URL, so a
	 * reload restores the same view (Part 11 §1).
	 */
	const PAGE_SIZE = 20;

	const CUSTOMER_STATE_VALUES: readonly CustomerState[] = [
		'active',
		'pending_review',
		'archived',
		'cancelled'
	];

	const SORT_KEYS: readonly CustomerSort[] = [
		'caption',
		'createdAt',
		'updatedAt',
		'postcode',
		'state'
	];

	const STATE_OPTIONS = [
		{ value: 'all', label: 'All states' },
		{ value: 'active', label: 'Active' },
		{ value: 'pending_review', label: 'Pending review' },
		{ value: 'archived', label: 'Archived' },
		{ value: 'cancelled', label: 'Cancelled' }
	];

	interface Column {
		key: string;
		label: string;
		sortable?: boolean;
	}

	const COLUMNS: Column[] = [
		{ key: 'caption', label: 'Customer', sortable: true },
		{ key: 'contact', label: 'Contact' },
		{ key: 'postcode', label: 'Postcode', sortable: true },
		{ key: 'state', label: 'State', sortable: true }
	];

	function isCustomerState(value: string | null): value is CustomerState {
		return CUSTOMER_STATE_VALUES.includes(value as CustomerState);
	}

	function readSort(value: string | null): CustomerSort {
		return SORT_KEYS.includes(value as CustomerSort) ? (value as CustomerSort) : 'createdAt';
	}

	function readDir(value: string | null, sortValue: CustomerSort): 'asc' | 'desc' {
		if (value === 'asc' || value === 'desc') return value;
		return sortValue === 'createdAt' ? 'desc' : 'asc';
	}

	function readPage(value: string | null): number {
		const parsed = Number.parseInt(value ?? '', 10);
		return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 1;
	}

	const initialSort = readSort(page.url.searchParams.get('sort'));
	const initialQuery = page.url.searchParams.get('q') ?? '';
	const initialState = page.url.searchParams.get('state');

	let query = $state(initialQuery);
	let selectedState = $state<string>(isCustomerState(initialState) ? initialState : 'all');
	let sort = $state<CustomerSort>(initialSort);
	let sortDir = $state<'asc' | 'desc'>(readDir(page.url.searchParams.get('dir'), initialSort));
	let currentPage = $state(readPage(page.url.searchParams.get('page')));

	let rows = $state<CustomerListRow[]>([]);
	let total = $state(0);
	let hasMore = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let formOpen = $state(false);
	let archiveOpen = $state(false);
	let archiveTarget = $state<CustomerListRow | null>(null);
	let archiveError = $state<string | null>(null);
	let dedupOpen = $state(false);
	let dedupHeldId = $state<string | null>(null);
	let dedupCandidates = $state<CustomerDedupConflict['candidates']>([]);

	let requestSequence = 0;
	let lastUrl = `${page.url.pathname}${page.url.search}`;

	const stateFilter = $derived<CustomerState | 'all'>(
		isCustomerState(selectedState) ? selectedState : 'all'
	);
	const hasFilters = $derived(query.trim().length > 0 || stateFilter !== 'all');

	function syncUrl(): void {
		const params = new URLSearchParams();
		if (query.trim().length > 0) params.set('q', query.trim());
		if (stateFilter !== 'all') params.set('state', stateFilter);
		params.set('sort', sort);
		params.set('dir', sortDir);
		if (currentPage > 1) params.set('page', String(currentPage));

		const target = `/customers?${params.toString()}`;
		if (target === lastUrl) return;
		lastUrl = target;
		void goto(resolve(target as Pathname), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	async function load(): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;

		try {
			const result = await customersApi.list({
				search: query.trim().length > 0 ? query.trim() : undefined,
				state: stateFilter,
				sort,
				sortDir,
				page: 1,
				pageSize: Math.min(currentPage * PAGE_SIZE, MAX_PAGE_SIZE)
			});
			if (sequence !== requestSequence) return;
			rows = result.items;
			total = result.total;
			hasMore = result.hasMore;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			rows = [];
			total = 0;
			hasMore = false;
			error = isApiError(caught) ? caught.message : 'We could not load customers. Try again.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	let initialised = false;
	$effect(() => {
		if (initialised) return;
		initialised = true;
		syncUrl();
		void load();
	});

	/** Clear a finished archive attempt so the next row starts from a clean dialog. */
	let archiveWasOpen = false;
	$effect(() => {
		if (archiveWasOpen && !archiveOpen) {
			archiveTarget = null;
			archiveError = null;
		}
		archiveWasOpen = archiveOpen;
	});

	function applyFilters(): void {
		currentPage = 1;
		syncUrl();
		void load();
	}

	function applySearch(value: string): void {
		query = value;
		applyFilters();
	}

	function handleSort(key: string): void {
		if (!SORT_KEYS.includes(key as CustomerSort)) return;
		const next = key as CustomerSort;
		if (next === sort) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sort = next;
			sortDir = next === 'createdAt' ? 'desc' : 'asc';
		}
		applyFilters();
	}

	function loadMore(): void {
		currentPage += 1;
		syncUrl();
		void load();
	}

	function resetFilters(): void {
		query = '';
		selectedState = 'all';
		sort = 'createdAt';
		sortDir = 'desc';
		applyFilters();
	}

	function openCreate(): void {
		formOpen = true;
	}

	function openDedup(row: CustomerListRow): void {
		dedupHeldId = row.id;
		dedupCandidates = [];
		dedupOpen = true;
	}

	function handleSaved(): void {
		toast.success('Customer created.');
		void load();
	}

	function handleDedupConflict(conflict: CustomerDedupConflict): void {
		dedupHeldId = conflict.heldId;
		dedupCandidates = conflict.candidates;
		dedupOpen = true;
		void load();
	}

	function askArchive(row: CustomerListRow): void {
		archiveTarget = row;
		archiveError = null;
		archiveOpen = true;
	}

	async function confirmArchive(): Promise<void> {
		const target = archiveTarget;
		if (!target) return;

		archiveError = null;
		try {
			await customersApi.archive(target.id);
		} catch (caught) {
			archiveError = isApiError(caught)
				? caught.message
				: 'We could not archive this customer. Try again.';
			throw caught;
		}

		archiveOpen = false;
		toast.success('Customer archived.');
		void load();
	}
</script>

<svelte:head>
	<title>Customers · Interio</title>
</svelte:head>

{#snippet plusIcon()}
	<Plus size={20} strokeWidth={1.75} aria-hidden="true" />
{/snippet}

{#snippet headerActions()}
	<PermissionGate permission={PERMISSIONS.CUSTOMER_CREATE}>
		<Button variant="primary" icon={plusIcon} onclick={openCreate}>New customer</Button>
	</PermissionGate>
{/snippet}

{#snippet cell({ row, column }: { row: CustomerListRow; column: Column })}
	{#if column.key === 'caption'}
		<div class="flex min-w-0 flex-col gap-0.5">
			<EntityLink
				href={resolve(`/customers/${row.id}`)}
				class="inline-flex min-h-target min-w-target items-center"
			>
				{row.caption}
			</EntityLink>
			<span class="text-footnote text-ink-tertiary">{row.contactName ?? 'No contact name'}</span>
		</div>
	{:else if column.key === 'contact'}
		<div class="flex min-w-0 flex-col gap-0.5">
			<span class="break-words">{row.email ?? '—'}</span>
			<span class="text-footnote text-ink-tertiary tabular-nums">{row.phone ?? '—'}</span>
		</div>
	{:else if column.key === 'postcode'}
		<span class="break-words">{row.postcode ?? '—'}</span>
	{:else if column.key === 'state'}
		<StateChip entity="customer" state={row.state} />
	{:else if column.key === 'createdAt'}
		<time datetime={row.createdAt}>{formatDate(row.createdAt)}</time>
	{/if}
{/snippet}

{#snippet rowActions(row: CustomerListRow)}
	<EntityLink
		href={resolve(`/customers/${row.id}` as Pathname)}
		class="inline-flex min-h-target min-w-target items-center justify-center"
	>
		Open
	</EntityLink>
	{#if row.state === 'pending_review'}
		<PermissionGate permission={PERMISSIONS.CUSTOMER_UPDATE}>
			<Button variant="tertiary" onclick={() => openDedup(row)}>Review duplicate</Button>
		</PermissionGate>
	{:else if row.state === 'active'}
		<PermissionGate permission={PERMISSIONS.CUSTOMER_ARCHIVE}>
			<Button variant="tertiary" onclick={() => askArchive(row)}>Archive</Button>
		</PermissionGate>
	{/if}
{/snippet}

<PageHeader
	title="Customers"
	description="Everyone you quote and design for, with their properties and projects."
	actions={headerActions}
/>

<div class="flex flex-col gap-3 pt-6 pb-4 md:flex-row md:items-end">
	<SearchInput
		label="Search customers"
		bind:value={query}
		placeholder="Name, contact, email, phone or postcode"
		onsearch={applySearch}
		class="md:flex-1"
	/>
	<Select
		label="State"
		bind:value={selectedState}
		options={STATE_OPTIONS}
		onchange={applyFilters}
		class="md:w-sidebar"
	/>
</div>

<section
	aria-labelledby="customers-heading"
	class="flex flex-col gap-4"
	aria-busy={loading ? 'true' : undefined}
>
	<h2 id="customers-heading" class="sr-only">Customer list</h2>

	<p class="sr-only" role="status" aria-live="polite">
		{loading
			? 'Loading customers.'
			: `${formatCount(total)} ${total === 1 ? 'customer' : 'customers'} match this view.`}
	</p>

	{#if loading}
		<DataTable
			caption="Customers"
			columns={COLUMNS}
			rows={[]}
			rowKey={(row) => row.id}
			{cell}
			actions={rowActions}
			loading
		/>
	{:else if error}
		<div
			role="alert"
			class="flex flex-col items-start gap-3 rounded-lg border border-hairline bg-canvas p-4"
		>
			<p class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{error}</span>
			</p>
			<Button variant="secondary" onclick={() => void load()}>Try again</Button>
		</div>
	{:else if rows.length === 0}
		<EmptyState
			title={hasFilters ? 'No customers match these filters.' : 'No customers yet.'}
			description={hasFilters
				? 'Clear the search or state filter to see every customer.'
				: 'Create the first customer to start a project for them.'}
		>
			{#snippet action()}
				{#if hasFilters}
					<Button variant="secondary" onclick={resetFilters}>Clear filters</Button>
				{:else}
					<PermissionGate permission={PERMISSIONS.CUSTOMER_CREATE}>
						<Button variant="primary" icon={plusIcon} onclick={openCreate}>New customer</Button>
					</PermissionGate>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<DataTable
			caption="Customers"
			columns={COLUMNS}
			{rows}
			rowKey={(row) => row.id}
			{cell}
			actions={rowActions}
			sort={{ key: sort, dir: sortDir }}
			onSort={handleSort}
		/>

		<p class="text-footnote text-ink-secondary" role="status" aria-live="polite">
			Showing {formatCount(rows.length)} of {formatCount(total)}
			{total === 1 ? 'customer' : 'customers'}.
		</p>

		<Pagination
			{hasMore}
			onLoadMore={loadMore}
			totalLabel={`${formatCount(total)} ${total === 1 ? 'customer' : 'customers'}`}
		/>
	{/if}
</section>

<CustomerFormDialog
	bind:open={formOpen}
	onSaved={handleSaved}
	onDedupConflict={handleDedupConflict}
	onClose={() => (formOpen = false)}
/>

<ConfirmDialog
	bind:open={archiveOpen}
	title={`Archive ${archiveTarget?.caption ?? 'customer'}?`}
	description="The customer leaves the active list. The record and its history are kept."
	confirmLabel="Archive customer"
	destructive
	error={archiveError}
	onconfirm={confirmArchive}
/>

<CustomerDedupReview
	bind:open={dedupOpen}
	heldId={dedupHeldId}
	candidates={dedupCandidates}
	onReviewed={() => void load()}
/>
