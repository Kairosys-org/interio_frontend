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
	import { formatDate } from '$shared/lib/format';
	import {
		Badge,
		Button,
		DataTable,
		PageHeader,
		Pagination,
		PermissionGate,
		SearchInput,
		Select
	} from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { Edging } from '../../domain/types';
	import { colourFamilyLabel } from '../materials-display';
	import EdgingFormDialog from '../components/EdgingFormDialog.svelte';

	/**
	 * `/materials/edging` (phase-3 §3).
	 *
	 * The edging library is small and flat: search, active state, three
	 * sortable columns, and a dialog editor. Edging records are deactivated,
	 * never deleted.
	 */
	const PAGE_SIZE = 20;
	const SORT_KEYS = ['caption', 'edgingCode', 'updatedAt'] as const;
	type EdgingSort = (typeof SORT_KEYS)[number];

	const STATUS_OPTIONS = [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' },
		{ value: 'all', label: 'All edgings' }
	];

	function readSort(value: string | null): EdgingSort {
		return SORT_KEYS.includes(value as EdgingSort) ? (value as EdgingSort) : 'caption';
	}

	function readDir(value: string | null, sort: EdgingSort): 'asc' | 'desc' {
		if (value === 'asc' || value === 'desc') return value;
		return sort === 'updatedAt' ? 'desc' : 'asc';
	}

	function readStatus(value: string | null): 'active' | 'inactive' | 'all' {
		return value === 'active' || value === 'inactive' ? value : 'all';
	}

	function readPage(value: string | null): number {
		const parsed = Number.parseInt(value ?? '', 10);
		return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 1;
	}

	let query = $state(page.url.searchParams.get('q') ?? '');
	let status = $state<'active' | 'inactive' | 'all'>(
		readStatus(page.url.searchParams.get('status'))
	);
	const initialSort = readSort(page.url.searchParams.get('sort'));
	let sort = $state<EdgingSort>(initialSort);
	let sortDir = $state<'asc' | 'desc'>(readDir(page.url.searchParams.get('dir'), initialSort));
	let currentPage = $state(readPage(page.url.searchParams.get('page')));

	let rows = $state<Edging[]>([]);
	let total = $state(0);
	let hasMore = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let requestSequence = 0;
	let lastUrl = `${page.url.pathname}${page.url.search}`;

	let formOpen = $state(false);
	let editing = $state<Edging | null>(null);

	const hasFilters = $derived(query.trim().length > 0 || status !== 'all');

	function syncUrl(): void {
		const params = new SvelteURLSearchParams();
		if (query.trim().length > 0) params.set('q', query.trim());
		if (status !== 'all') params.set('status', status);
		params.set('sort', sort);
		params.set('dir', sortDir);
		if (currentPage > 1) params.set('page', String(currentPage));

		const target = `/materials/edging?${params.toString()}`;
		if (target === lastUrl) return;
		lastUrl = target;
		void goto(resolve(`/materials/edging?${params.toString()}`), {
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
			const result = await materialsApi.listEdgings({
				search: query.trim().length > 0 ? query.trim() : undefined,
				active: status,
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
			error = isApiError(caught) ? caught.message : 'We could not load edgings.';
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
		if (!SORT_KEYS.includes(key as EdgingSort)) return;
		const next = key as EdgingSort;
		if (sort === next) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sort = next;
			sortDir = 'asc';
		}
		reloadFromFirstPage();
	}

	function createEdging(): void {
		editing = null;
		formOpen = true;
	}

	function editEdging(row: Edging): void {
		editing = row;
		formOpen = true;
	}

	function onSaved(): void {
		toast.success('Edging saved.');
		reloadFromFirstPage();
	}
</script>

<PageHeader
	eyebrow="Materials"
	title="Edging"
	description="The edging library: codes, materials and thickness, linked to decors by match type."
>
	{#snippet actions()}
		<PermissionGate permission={PERMISSIONS.MATERIALS_CREATE}>
			<Button onclick={createEdging}>
				{#snippet icon()}<Plus size={18} strokeWidth={1.75} aria-hidden="true" />{/snippet}
				New edging
			</Button>
		</PermissionGate>
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-4">
	<div class="grid gap-3 sm:grid-cols-2">
		<SearchInput
			label="Search edging"
			bind:value={query}
			placeholder="Search by caption, code or material"
			onsearch={reloadFromFirstPage}
		/>
		<Select
			label="Status"
			bind:value={status}
			options={STATUS_OPTIONS}
			onchange={reloadFromFirstPage}
		/>
	</div>

	<div class="flex flex-wrap items-center gap-3">
		<p class="text-footnote text-ink-secondary">
			{loading ? 'Loading edging…' : `${total} ${total === 1 ? 'edging' : 'edgings'}`}
		</p>
		{#if hasFilters}
			<Button
				variant="ghost"
				onclick={() => {
					query = '';
					status = 'all';
					reloadFromFirstPage();
				}}
			>
				Clear filters
			</Button>
		{/if}
	</div>

	<DataTable
		caption="Edging library"
		columns={[
			{ key: 'caption', label: 'Edging', sortable: true },
			{ key: 'code', label: 'Code', sortable: true },
			{ key: 'material', label: 'Material' },
			{ key: 'thickness', label: 'Thickness', align: 'end' },
			{ key: 'colour', label: 'Colour' },
			{ key: 'status', label: 'Status' },
			{ key: 'updated', label: 'Updated', sortable: true }
		]}
		{rows}
		rowKey={(row) => row.id}
		sort={{ key: sort, dir: sortDir }}
		{onSort}
		{loading}
		{error}
		density="compact"
		empty={{
			title: hasFilters ? 'No edging matches those filters' : 'No edging yet',
			description: hasFilters
				? 'Clear the filters or try another search.'
				: 'Create the first edging so decors can reference their finish.'
		}}
	>
		{#snippet cell({ row, column })}
			{#if column.key === 'caption'}
				{row.caption}
			{:else if column.key === 'code'}
				<span class="font-mono text-callout text-ink">{row.edgingCode}</span>
			{:else if column.key === 'material'}
				{row.materialType}
			{:else if column.key === 'thickness'}
				{row.thicknessMm} mm
			{:else if column.key === 'colour'}
				{colourFamilyLabel(row.colourFamily)}
			{:else if column.key === 'status'}
				<Badge
					label={row.active ? 'Active' : 'Inactive'}
					tone={row.active ? 'success' : 'neutral'}
				/>
			{:else if column.key === 'updated'}
				{formatDate(row.updatedAt)}
			{/if}
		{/snippet}
		{#snippet actions(row)}
			<PermissionGate permission={PERMISSIONS.MATERIALS_UPDATE}>
				<Button variant="tertiary" onclick={() => editEdging(row)}>
					Edit<span class="sr-only"> {row.caption}</span>
				</Button>
			</PermissionGate>
		{/snippet}
	</DataTable>

	<Pagination
		{hasMore}
		{loading}
		onLoadMore={() => {
			currentPage += 1;
			syncUrl();
			void load();
		}}
		totalLabel={`${rows.length} of ${total} edgings loaded`}
	/>
</div>

<EdgingFormDialog
	bind:open={formOpen}
	edging={editing}
	onClose={() => (formOpen = false)}
	{onSaved}
/>
