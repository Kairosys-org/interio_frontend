<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { CircleAlert, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { customersApi } from '$modules/customers/data/api';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import type { PropertyState } from '$shared/domain/record-states';
	import { isUuid } from '$shared/domain/uuid';
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
	import { propertiesApi } from '../../data/api';
	import type { PropertyDedupConflict, PropertyListRow, PropertySort } from '../../domain/types';
	import PropertyDedupReview from '../components/PropertyDedupReview.svelte';
	import PropertyFormDialog from '../components/PropertyFormDialog.svelte';

	/**
	 * `/properties` list (DESIGN §10.2 List): header, toolbar, data table,
	 * keyset pagination. Search, customer, state, sort and page live in the
	 * URL, so a reload restores the same view (Part 11 §1).
	 */
	const PAGE_SIZE = 20;
	const PAGE_LIMIT = MAX_PAGE_SIZE / PAGE_SIZE;
	const DEFAULT_SORT: PropertySort = 'createdAt';
	const DEFAULT_DIR: 'asc' | 'desc' = 'desc';

	const PROPERTY_STATE_VALUES: readonly PropertyState[] = [
		'active',
		'pending_review',
		'archived',
		'cancelled'
	];

	const SORTABLE_KEYS: ReadonlySet<string> = new Set([
		'addressLine1',
		'postcode',
		'state',
		'createdAt'
	]);

	interface Column {
		key: string;
		label: string;
		sortable?: boolean;
	}

	interface ListUrlState {
		q: string;
		customer: string;
		state: PropertyState | 'all';
		sort: PropertySort;
		dir: 'asc' | 'desc';
		page: number;
	}

	const COLUMNS: Column[] = [
		{ key: 'addressLine1', label: 'Address', sortable: true },
		{ key: 'customer', label: 'Customer' },
		{ key: 'postcode', label: 'Postcode', sortable: true },
		{ key: 'state', label: 'State', sortable: true }
	];

	const STATE_OPTIONS = [
		{ value: 'all', label: 'All states' },
		{ value: 'active', label: 'Active' },
		{ value: 'pending_review', label: 'Pending review' },
		{ value: 'archived', label: 'Archived' },
		{ value: 'cancelled', label: 'Cancelled' }
	];

	function isPropertyState(value: string | null): value is PropertyState {
		return value !== null && PROPERTY_STATE_VALUES.includes(value as PropertyState);
	}

	function readState(value: string | null): PropertyState | 'all' {
		return isPropertyState(value) ? value : 'all';
	}

	function readCustomer(value: string | null): string {
		return isUuid(value) ? value : 'all';
	}

	function readSort(value: string | null): PropertySort {
		return value !== null && SORTABLE_KEYS.has(value) ? (value as PropertySort) : DEFAULT_SORT;
	}

	function readDir(value: string | null): 'asc' | 'desc' {
		return value === 'asc' || value === 'desc' ? value : DEFAULT_DIR;
	}

	function readPage(value: string | null): number {
		const parsed = Number.parseInt(value ?? '', 10);
		if (!Number.isInteger(parsed) || parsed < 1) return 1;
		return Math.min(parsed, PAGE_LIMIT);
	}

	/** URL is the single source of truth for every filter (DESIGN §10.3). */
	function readUrl(params: URLSearchParams): ListUrlState {
		return {
			q: params.get('q') ?? '',
			customer: readCustomer(params.get('customer')),
			state: readState(params.get('state')),
			sort: readSort(params.get('sort')),
			dir: readDir(params.get('dir')),
			page: readPage(params.get('page'))
		};
	}

	function buildHref(state: ListUrlState): string {
		const params = new URLSearchParams();
		const search = state.q.trim();
		if (search.length > 0) params.set('q', search);
		if (state.customer !== 'all') params.set('customer', state.customer);
		if (state.state !== 'all') params.set('state', state.state);
		params.set('sort', state.sort);
		params.set('dir', state.dir);
		if (state.page > 1) params.set('page', String(state.page));
		return `/properties?${params.toString()}`;
	}

	function applyUrl(next: ListUrlState): void {
		const target = buildHref(next);
		if (target === `${page.url.pathname}${page.url.search}`) return;
		void goto(resolve(target as Pathname), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	const urlState = $derived.by(() => readUrl(page.url.searchParams));

	let query = $derived(urlState.q);
	let rows = $state<PropertyListRow[]>([]);
	let total = $state(0);
	let hasMore = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let customers = $state<{ id: string; caption: string }[]>([]);
	let customersLoading = $state(true);
	let customersError = $state<string | null>(null);

	let formOpen = $state(false);
	let archiveOpen = $state(false);
	let archiveTarget = $state<PropertyListRow | null>(null);
	let archiveError = $state<string | null>(null);
	let dedupOpen = $state(false);
	let dedupHeldId = $state<string | null>(null);
	let dedupCandidates = $state<PropertyDedupConflict['candidates']>([]);

	let requestSequence = 0;

	const hasFilters = $derived(
		urlState.q.trim().length > 0 || urlState.customer !== 'all' || urlState.state !== 'all'
	);

	const customerOptions = $derived.by(() => {
		const options = [
			{ value: 'all', label: 'All customers' },
			...customers.map((customer) => ({ value: customer.id, label: customer.caption }))
		];
		if (urlState.customer !== 'all' && !customers.some((row) => row.id === urlState.customer)) {
			options.push({ value: urlState.customer, label: 'Selected customer' });
		}
		return options;
	});

	const customerFilterHint = $derived(
		customersLoading ? 'Loading customers…' : (customersError ?? undefined)
	);

	/** One load per URL state; a reload restores the same page. */
	$effect(() => {
		void load(urlState);
	});

	$effect(() => {
		void loadCustomers();
	});

	async function loadCustomers(): Promise<void> {
		customersLoading = true;
		customersError = null;
		try {
			const result = await customersApi.list({ pageSize: 100, state: 'active' });
			customers = result.items.map((row) => ({ id: row.id, caption: row.caption }));
		} catch (caught) {
			customers = [];
			customersError = isApiError(caught)
				? caught.message
				: 'We could not load customers. Try again.';
		} finally {
			customersLoading = false;
		}
	}

	async function load(state: ListUrlState): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;

		try {
			const result = await propertiesApi.list({
				search: state.q.trim().length > 0 ? state.q.trim() : undefined,
				customerId: state.customer === 'all' ? null : state.customer,
				state: state.state,
				sort: state.sort,
				sortDir: state.dir,
				page: 1,
				pageSize: Math.min(state.page * PAGE_SIZE, MAX_PAGE_SIZE)
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
			error = isApiError(caught) ? caught.message : 'We could not load properties. Try again.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	function reload(): void {
		void load(urlState);
	}

	function updateFilters(patch: Partial<ListUrlState>): void {
		applyUrl({
			...urlState,
			...patch,
			page: patch.page ?? 1
		});
	}

	function handleSort(key: string): void {
		if (!SORTABLE_KEYS.has(key)) return;
		const sort = key as PropertySort;
		const dir =
			urlState.sort === sort
				? urlState.dir === 'asc'
					? 'desc'
					: 'asc'
				: sort === 'createdAt'
					? 'desc'
					: 'asc';
		updateFilters({ sort, dir });
	}

	function loadMore(): void {
		if (loading || !hasMore) return;
		applyUrl({ ...urlState, page: Math.min(urlState.page + 1, PAGE_LIMIT) });
	}

	function resetFilters(): void {
		applyUrl({
			q: '',
			customer: 'all',
			state: 'all',
			sort: DEFAULT_SORT,
			dir: DEFAULT_DIR,
			page: 1
		});
	}

	function openCreate(): void {
		formOpen = true;
	}

	function openDedup(row: PropertyListRow): void {
		dedupHeldId = row.id;
		dedupCandidates = [];
		dedupOpen = true;
	}

	function handleSaved(): void {
		toast.success('Property created.');
		reload();
	}

	function handleDedupConflict(conflict: PropertyDedupConflict): void {
		dedupHeldId = conflict.heldId;
		dedupCandidates = conflict.candidates;
		dedupOpen = true;
		reload();
	}

	function askArchive(row: PropertyListRow): void {
		archiveTarget = row;
		archiveError = null;
		archiveOpen = true;
	}

	async function confirmArchive(): Promise<void> {
		const target = archiveTarget;
		if (!target) return;

		archiveError = null;
		try {
			await propertiesApi.archive(target.id);
		} catch (caught) {
			archiveError = isApiError(caught)
				? caught.message
				: 'We could not archive this property. Try again.';
			throw caught;
		}

		archiveOpen = false;
		toast.success('Property archived.');
		reload();
	}

	/** Clear a finished archive attempt so the next row starts clean. */
	let archiveWasOpen = false;
	$effect(() => {
		if (archiveWasOpen && !archiveOpen) {
			archiveTarget = null;
			archiveError = null;
		}
		archiveWasOpen = archiveOpen;
	});
</script>

<svelte:head>
	<title>Properties · Interio</title>
</svelte:head>

{#snippet plusIcon()}
	<Plus size={20} strokeWidth={1.75} aria-hidden="true" />
{/snippet}

{#snippet headerActions()}
	<PermissionGate permission={PERMISSIONS.PROPERTY_CREATE}>
		<Button variant="primary" icon={plusIcon} onclick={openCreate}>New property</Button>
	</PermissionGate>
{/snippet}

{#snippet cell({ row, column }: { row: PropertyListRow; column: Column })}
	{#if column.key === 'addressLine1'}
		<div class="flex min-w-0 flex-col gap-0.5">
			<EntityLink
				href={resolve(`/properties/${row.id}`)}
				class="inline-flex min-h-target items-center break-words"
			>
				{row.addressLine1}
			</EntityLink>
			{#if row.addressLine2 || row.town}
				<span class="text-footnote text-ink-tertiary">
					{[row.addressLine2, row.town]
						.filter((value): value is string => Boolean(value))
						.join(', ')}
				</span>
			{/if}
		</div>
	{:else if column.key === 'customer'}
		<EntityLink
			href={resolve(`/customers/${row.customerId}`)}
			class="inline-flex min-h-target items-center break-words"
		>
			{row.customerCaption}
		</EntityLink>
	{:else if column.key === 'postcode'}
		<span class="break-words">{row.postcode ?? '—'}</span>
	{:else if column.key === 'state'}
		<StateChip entity="property" state={row.state} />
	{:else if column.key === 'createdAt'}
		<time datetime={row.createdAt}>{formatDate(row.createdAt)}</time>
	{/if}
{/snippet}

{#snippet rowActions(row: PropertyListRow)}
	<EntityLink
		href={resolve(`/properties/${row.id}` as Pathname)}
		class="inline-flex min-h-target min-w-target items-center justify-center"
	>
		Open
	</EntityLink>
	{#if row.state === 'pending_review'}
		<PermissionGate permission={PERMISSIONS.PROPERTY_UPDATE}>
			<Button variant="tertiary" onclick={() => openDedup(row)}>Review duplicate</Button>
		</PermissionGate>
	{:else if row.state === 'active'}
		<PermissionGate permission={PERMISSIONS.PROPERTY_ARCHIVE}>
			<Button variant="tertiary" onclick={() => askArchive(row)}>Archive</Button>
		</PermissionGate>
	{/if}
{/snippet}

<PageHeader
	title="Properties"
	description="Every address you survey, design for and install in."
	actions={headerActions}
/>

<div class="flex flex-col gap-3 pt-6 pb-4 md:flex-row md:items-end">
	<SearchInput
		label="Search properties"
		bind:value={query}
		placeholder="Address, town, postcode or customer"
		onsearch={(value) => updateFilters({ q: value })}
		class="md:flex-1"
	/>

	<Select
		label="Customer"
		value={urlState.customer}
		options={customerOptions}
		hint={customerFilterHint}
		onchange={(event) =>
			updateFilters({ customer: (event.currentTarget as HTMLSelectElement).value })}
		class="md:w-56"
	/>

	<Select
		label="State"
		value={urlState.state}
		options={STATE_OPTIONS}
		onchange={(event) =>
			updateFilters({ state: readState((event.currentTarget as HTMLSelectElement).value) })}
		class="md:w-44"
	/>
</div>

<section
	aria-labelledby="properties-heading"
	class="flex flex-col gap-4"
	aria-busy={loading ? 'true' : undefined}
>
	<h2 id="properties-heading" class="sr-only">Property list</h2>

	<p class="sr-only" role="status" aria-live="polite">
		{loading
			? 'Loading properties.'
			: `${formatCount(total)} ${total === 1 ? 'property' : 'properties'} match this view.`}
	</p>

	{#if loading}
		<DataTable
			caption="Properties"
			columns={COLUMNS}
			rows={[]}
			rowKey={(row) => row.id}
			{cell}
			actions={rowActions}
			loading
			density="compact"
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
			<Button variant="secondary" onclick={reload}>Try again</Button>
		</div>
	{:else if rows.length === 0}
		<EmptyState
			title={hasFilters ? 'No properties match these filters.' : 'No properties yet.'}
			description={hasFilters
				? 'Clear the search, customer or state filter to see every property.'
				: 'Add the first property so you can plan work at that address.'}
		>
			{#snippet action()}
				{#if hasFilters}
					<Button variant="secondary" onclick={resetFilters}>Clear filters</Button>
				{:else}
					<PermissionGate permission={PERMISSIONS.PROPERTY_CREATE}>
						<Button variant="primary" icon={plusIcon} onclick={openCreate}>New property</Button>
					</PermissionGate>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<DataTable
			caption="Properties"
			columns={COLUMNS}
			{rows}
			rowKey={(row) => row.id}
			{cell}
			actions={rowActions}
			sort={{ key: urlState.sort, dir: urlState.dir }}
			onSort={handleSort}
			density="compact"
		/>

		<p class="text-footnote text-ink-secondary" role="status" aria-live="polite">
			Showing {formatCount(rows.length)} of {formatCount(total)}
			{total === 1 ? 'property' : 'properties'}.
		</p>

		<Pagination
			{hasMore}
			onLoadMore={loadMore}
			totalLabel={`${formatCount(total)} ${total === 1 ? 'property' : 'properties'}`}
		/>
	{/if}
</section>

<PropertyFormDialog
	bind:open={formOpen}
	onSaved={handleSaved}
	onDedupConflict={handleDedupConflict}
	onClose={() => (formOpen = false)}
/>

<ConfirmDialog
	bind:open={archiveOpen}
	title={`Archive ${archiveTarget?.addressLine1 ?? 'property'}?`}
	description="The property leaves the active list. The record, its projects and its history are kept."
	confirmLabel="Archive property"
	destructive
	error={archiveError}
	onconfirm={confirmArchive}
/>

<PropertyDedupReview
	bind:open={dedupOpen}
	heldId={dedupHeldId}
	candidates={dedupCandidates}
	onReviewed={reload}
/>
