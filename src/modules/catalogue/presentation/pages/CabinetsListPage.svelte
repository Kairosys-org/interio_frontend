<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { CABINET_FAMILIES, CONSTRUCTION_METHODS } from '$shared/domain/record-states';
	import type { CabinetFamily, ConstructionMethod } from '$shared/domain/record-states';
	import {
		Badge,
		Button,
		DataTable,
		EntityLink,
		FilterPills,
		PageHeader,
		Pagination,
		PermissionGate,
		SearchInput,
		Select
	} from '$shared/presentation/ui';
	import { catalogueApi } from '../../data/api';
	import type { CabinetListRow, CabinetSort } from '../../domain/types';
	import {
		CABINET_FAMILY_LABELS,
		cabinetFamilyLabel,
		cabinetStatusLabel,
		constructionMethodLabel
	} from '../catalogue-display';
	import CabinetFormDialog from '../components/CabinetFormDialog.svelte';

	/**
	 * `/catalogue/cabinets` (DESIGN §10.2, phase-3 §3).
	 *
	 * Family chips, status and construction filters, a sortable table and the
	 * New cabinet dialog. Search, filters, sort and page live in the URL.
	 */
	const PAGE_SIZE = 20;

	const SORT_KEYS: readonly CabinetSort[] = [
		'caption',
		'family',
		'constructionMethod',
		'updatedAt'
	];

	const FAMILY_OPTIONS = [
		{ value: 'all', label: 'All families' },
		...CABINET_FAMILIES.map((family) => ({
			value: family,
			label: CABINET_FAMILY_LABELS[family]
		}))
	];

	const STATUS_OPTIONS = [
		{ value: 'active', label: 'Active' },
		{ value: 'discontinued', label: 'Discontinued' },
		{ value: 'all', label: 'All statuses' }
	];

	const CONSTRUCTION_OPTIONS = [
		{ value: 'all', label: 'All construction methods' },
		...CONSTRUCTION_METHODS.map((method) => ({
			value: method,
			label: constructionMethodLabel(method)
		}))
	];

	interface Column {
		key: string;
		label: string;
		sortable?: boolean;
	}

	const COLUMNS: Column[] = [
		{ key: 'caption', label: 'Cabinet', sortable: true },
		{ key: 'family', label: 'Family', sortable: true },
		{ key: 'construction', label: 'Construction', sortable: true },
		{ key: 'parameters', label: 'Parameters' },
		{ key: 'rules', label: 'Rules' },
		{ key: 'status', label: 'Status' }
	];

	function readSort(value: string | null): CabinetSort {
		return SORT_KEYS.includes(value as CabinetSort) ? (value as CabinetSort) : 'caption';
	}

	function readDir(value: string | null, sortValue: CabinetSort): 'asc' | 'desc' {
		if (value === 'asc' || value === 'desc') return value;
		return sortValue === 'updatedAt' ? 'desc' : 'asc';
	}

	function readFamily(value: string | null): CabinetFamily | 'all' {
		return CABINET_FAMILIES.includes(value as CabinetFamily) ? (value as CabinetFamily) : 'all';
	}

	function readConstruction(value: string | null): ConstructionMethod | 'all' {
		return CONSTRUCTION_METHODS.includes(value as ConstructionMethod)
			? (value as ConstructionMethod)
			: 'all';
	}

	function readStatus(value: string | null): 'active' | 'discontinued' | 'all' {
		return value === 'active' || value === 'discontinued' ? value : 'all';
	}

	function readPage(value: string | null): number {
		const parsed = Number.parseInt(value ?? '', 10);
		return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 1;
	}

	const initialSort = readSort(page.url.searchParams.get('sort'));
	let query = $state(page.url.searchParams.get('q') ?? '');
	let family = $state<CabinetFamily | 'all'>(readFamily(page.url.searchParams.get('family')));
	let status = $state<'active' | 'discontinued' | 'all'>(
		readStatus(page.url.searchParams.get('status'))
	);
	let construction = $state<ConstructionMethod | 'all'>(
		readConstruction(page.url.searchParams.get('construction'))
	);
	let sort = $state<CabinetSort>(initialSort);
	let sortDir = $state<'asc' | 'desc'>(readDir(page.url.searchParams.get('dir'), initialSort));
	let currentPage = $state(readPage(page.url.searchParams.get('page')));

	let rows = $state<CabinetListRow[]>([]);
	let total = $state(0);
	let hasMore = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let formOpen = $state(false);
	let requestSequence = 0;
	let lastUrl = `${page.url.pathname}${page.url.search}`;

	const hasFilters = $derived(
		query.trim().length > 0 || family !== 'all' || status !== 'all' || construction !== 'all'
	);

	function syncUrl(): void {
		const params = new SvelteURLSearchParams();
		if (query.trim().length > 0) params.set('q', query.trim());
		if (family !== 'all') params.set('family', family);
		if (status !== 'all') params.set('status', status);
		if (construction !== 'all') params.set('construction', construction);
		params.set('sort', sort);
		params.set('dir', sortDir);
		if (currentPage > 1) params.set('page', String(currentPage));

		const target = `/catalogue/cabinets?${params.toString()}`;
		if (target === lastUrl) return;
		lastUrl = target;
		void goto(resolve(`/catalogue/cabinets?${params.toString()}`), {
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
			const result = await catalogueApi.list({
				search: query.trim().length > 0 ? query.trim() : undefined,
				family,
				status,
				constructionMethod: construction,
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
			error = isApiError(caught)
				? caught.message
				: 'We could not load the cabinet catalogue. Try again.';
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

	function reloadFromFirstPage(): void {
		currentPage = 1;
		syncUrl();
		void load();
	}

	function onSort(key: string): void {
		if (!SORT_KEYS.includes(key as CabinetSort)) return;
		const next = key as CabinetSort;
		if (sort === next) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sort = next;
			sortDir = 'asc';
		}
		reloadFromFirstPage();
	}

	function loadMore(): void {
		currentPage += 1;
		syncUrl();
		void load();
	}

	function clearFilters(): void {
		query = '';
		family = 'all';
		status = 'all';
		construction = 'all';
		reloadFromFirstPage();
	}

	function onSaved(): void {
		toast.success('Cabinet saved.');
		reloadFromFirstPage();
	}
</script>

<PageHeader
	eyebrow="Catalogue"
	title="Cabinets"
	description="Master cabinet library. Parameters and component rules feed placement and engineering."
>
	{#snippet actions()}
		<PermissionGate permission={PERMISSIONS.CABINET_CREATE}>
			<Button onclick={() => (formOpen = true)}>
				{#snippet icon()}<Plus size={18} strokeWidth={1.75} aria-hidden="true" />{/snippet}
				New cabinet
			</Button>
		</PermissionGate>
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-3">
		<FilterPills
			label="Family"
			options={FAMILY_OPTIONS}
			value={family}
			onchange={(value) => {
				family = value as CabinetFamily | 'all';
				reloadFromFirstPage();
			}}
		/>

		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<div class="sm:col-span-2">
				<SearchInput
					label="Search cabinets"
					bind:value={query}
					placeholder="Search by caption"
					onsearch={reloadFromFirstPage}
				/>
			</div>
			<Select
				label="Status"
				bind:value={status}
				options={STATUS_OPTIONS}
				onchange={reloadFromFirstPage}
			/>
			<Select
				label="Construction"
				bind:value={construction}
				options={CONSTRUCTION_OPTIONS}
				onchange={reloadFromFirstPage}
			/>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<p class="text-footnote text-ink-secondary">
				{loading ? 'Loading cabinets…' : `${total} ${total === 1 ? 'cabinet' : 'cabinets'}`}
			</p>
			{#if hasFilters}
				<Button variant="ghost" onclick={clearFilters}>Clear filters</Button>
			{/if}
		</div>
	</div>

	<DataTable
		caption="Cabinet catalogue"
		columns={COLUMNS}
		{rows}
		rowKey={(row) => row.id}
		sort={{ key: sort, dir: sortDir }}
		{onSort}
		{loading}
		{error}
		density="compact"
		empty={{
			title: hasFilters ? 'No cabinets match those filters' : 'No cabinets yet',
			description: hasFilters
				? 'Clear the filters or try a different search.'
				: 'Create the first cabinet to start the master catalogue.'
		}}
	>
		{#snippet cell({ row, column })}
			{#if column.key === 'caption'}
				<EntityLink href={`/catalogue/cabinets/${row.id}`}>{row.caption}</EntityLink>
			{:else if column.key === 'family'}
				{cabinetFamilyLabel(row.family)}
			{:else if column.key === 'construction'}
				{constructionMethodLabel(row.constructionMethod)}
			{:else if column.key === 'parameters'}
				{row.parameterCount}
			{:else if column.key === 'rules'}
				{row.ruleCount}
			{:else if column.key === 'status'}
				<Badge label={cabinetStatusLabel(row.active)} tone={row.active ? 'success' : 'neutral'} />
			{/if}
		{/snippet}
	</DataTable>

	<Pagination
		{hasMore}
		{loading}
		onLoadMore={loadMore}
		totalLabel={`${rows.length} of ${total} cabinets loaded`}
	/>
</div>

<CabinetFormDialog bind:open={formOpen} onClose={() => (formOpen = false)} {onSaved} />
