<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { CircleAlert, Plus, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { formatDate } from '$shared/lib/format';
	import {
		Badge,
		Button,
		DataTable,
		EntityLink,
		IconButton,
		PageHeader,
		Pagination,
		PermissionGate,
		SearchInput,
		Select
	} from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { Supplier, SupplierDuplicateCandidate } from '../../domain/types';
	import SupplierFormDialog from '../components/SupplierFormDialog.svelte';

	/**
	 * `/materials/suppliers` (phase-3 §3).
	 *
	 * Supplier master data with lead time. A create that matches an existing
	 * name or contact still saves the new supplier — the candidates are
	 * reported in a dismissible notice and nothing is merged (R5).
	 */
	const PAGE_SIZE = 20;
	const SORT_KEYS = ['caption', 'leadTimeDays', 'updatedAt'] as const;
	type SupplierSort = (typeof SORT_KEYS)[number];

	const STATUS_OPTIONS = [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' },
		{ value: 'all', label: 'All suppliers' }
	];

	function readSort(value: string | null): SupplierSort {
		return SORT_KEYS.includes(value as SupplierSort) ? (value as SupplierSort) : 'caption';
	}

	function readDir(value: string | null, sort: SupplierSort): 'asc' | 'desc' {
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
	let sort = $state<SupplierSort>(initialSort);
	let sortDir = $state<'asc' | 'desc'>(readDir(page.url.searchParams.get('dir'), initialSort));
	let currentPage = $state(readPage(page.url.searchParams.get('page')));

	let rows = $state<Supplier[]>([]);
	let total = $state(0);
	let hasMore = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let requestSequence = 0;
	let lastUrl = `${page.url.pathname}${page.url.search}`;

	let formOpen = $state(false);
	let editing = $state<Supplier | null>(null);
	let duplicateNotice = $state<{
		caption: string;
		candidates: SupplierDuplicateCandidate[];
	} | null>(null);

	const hasFilters = $derived(query.trim().length > 0 || status !== 'all');

	function syncUrl(): void {
		const params = new SvelteURLSearchParams();
		if (query.trim().length > 0) params.set('q', query.trim());
		if (status !== 'all') params.set('status', status);
		params.set('sort', sort);
		params.set('dir', sortDir);
		if (currentPage > 1) params.set('page', String(currentPage));

		const target = `/materials/suppliers?${params.toString()}`;
		if (target === lastUrl) return;
		lastUrl = target;
		void goto(resolve(`/materials/suppliers?${params.toString()}`), {
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
			const result = await materialsApi.listSuppliers({
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
			error = isApiError(caught) ? caught.message : 'We could not load suppliers.';
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
		if (!SORT_KEYS.includes(key as SupplierSort)) return;
		const next = key as SupplierSort;
		if (sort === next) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sort = next;
			sortDir = 'asc';
		}
		reloadFromFirstPage();
	}

	function createSupplier(): void {
		editing = null;
		formOpen = true;
	}

	function editSupplier(row: Supplier): void {
		editing = row;
		formOpen = true;
	}

	function onSaved(result: { supplier: Supplier; candidates: SupplierDuplicateCandidate[] }): void {
		toast.success('Supplier saved.');
		duplicateNotice =
			result.candidates.length > 0
				? { caption: result.supplier.caption, candidates: result.candidates }
				: null;
		reloadFromFirstPage();
	}
</script>

<PageHeader
	eyebrow="Materials"
	title="Suppliers"
	description="Supplier master data, lead times and the decors each supplier stocks."
>
	{#snippet actions()}
		<PermissionGate permission={PERMISSIONS.MATERIALS_CREATE}>
			<Button onclick={createSupplier}>
				{#snippet icon()}<Plus size={18} strokeWidth={1.75} aria-hidden="true" />{/snippet}
				New supplier
			</Button>
		</PermissionGate>
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-4">
	{#if duplicateNotice}
		<div
			class="border-warning bg-warning-soft flex flex-col gap-3 rounded-lg border p-4"
			role="status"
		>
			<div class="flex items-start justify-between gap-3">
				<div class="flex min-w-0 items-start gap-2">
					<CircleAlert
						size={20}
						strokeWidth={1.75}
						aria-hidden="true"
						class="text-warning-ink mt-0.5 shrink-0"
					/>
					<div class="flex min-w-0 flex-col gap-1">
						<p class="text-callout text-ink">
							{duplicateNotice.caption} was created. It looks similar to existing suppliers.
						</p>
						<ul class="flex list-disc flex-col gap-1 ps-5 text-footnote text-ink-secondary">
							{#each duplicateNotice.candidates as candidate (candidate.id)}
								<li>
									<a class="underline" href={resolve(`/materials/suppliers/${candidate.id}`)}>
										{candidate.caption}
									</a>
									— {candidate.matchReasons.join(', ')}
								</li>
							{/each}
						</ul>
						<p class="text-footnote text-ink-secondary">
							Nothing was merged. Review the records and deactivate the one that should not be used.
						</p>
					</div>
				</div>
				<IconButton
					label="Dismiss duplicate notice"
					variant="ghost"
					onclick={() => (duplicateNotice = null)}
				>
					{#snippet icon()}<X size={18} strokeWidth={1.75} aria-hidden="true" />{/snippet}
				</IconButton>
			</div>
		</div>
	{/if}

	<div class="grid gap-3 sm:grid-cols-2">
		<SearchInput
			label="Search suppliers"
			bind:value={query}
			placeholder="Search by name or contact"
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
			{loading ? 'Loading suppliers…' : `${total} ${total === 1 ? 'supplier' : 'suppliers'}`}
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
		caption="Supplier master data"
		columns={[
			{ key: 'caption', label: 'Supplier', sortable: true },
			{ key: 'contact', label: 'Contact' },
			{ key: 'lead', label: 'Lead time', sortable: true },
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
			title: hasFilters ? 'No suppliers match those filters' : 'No suppliers yet',
			description: hasFilters
				? 'Clear the filters or try another search.'
				: 'Create the first supplier so decors can record where they are bought.'
		}}
	>
		{#snippet cell({ row, column })}
			{#if column.key === 'caption'}
				<EntityLink href={`/materials/suppliers/${row.id}`}>{row.caption}</EntityLink>
			{:else if column.key === 'contact'}
				{row.contact ?? '—'}
			{:else if column.key === 'lead'}
				{row.leadTimeDays === null ? '—' : `${row.leadTimeDays} days`}
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
				<Button variant="tertiary" onclick={() => editSupplier(row)}>
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
		totalLabel={`${rows.length} of ${total} suppliers loaded`}
	/>
</div>

<SupplierFormDialog
	bind:open={formOpen}
	supplier={editing}
	onClose={() => (formOpen = false)}
	{onSaved}
/>
