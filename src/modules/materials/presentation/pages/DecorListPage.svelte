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
	import {
		DECOR_COLOUR_FAMILIES,
		DECOR_MATERIAL_TYPES,
		MATERIAL_STATUSES,
		PREMIUM_TIERS
	} from '$shared/domain/record-states';
	import type {
		DecorColourFamily,
		DecorMaterialType,
		MaterialStatus,
		PremiumTier
	} from '$shared/domain/record-states';
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
	import type { DecorDuplicateCandidate, DecorListRow, DecorSort } from '../../domain/types';
	import {
		colourFamilyLabel,
		COLOUR_FAMILY_LABELS,
		materialStatusLabel,
		MATERIAL_TYPE_LABELS,
		materialTypeLabel,
		PREMIUM_TIER_LABELS,
		premiumTierLabel
	} from '../materials-display';
	import DecorFormDrawer from '../components/DecorFormDrawer.svelte';

	/**
	 * `/materials/decor` (phase-3 §3).
	 *
	 * Six facets — manufacturer, colour, material, tier, status and customer
	 * visibility — plus search. Filters live in the URL so a reload restores
	 * the same view.
	 */
	const PAGE_SIZE = 20;

	const SORT_KEYS: readonly DecorSort[] = ['caption', 'decorCode', 'manufacturer', 'updatedAt'];

	const VISIBILITY_OPTIONS = [
		{ value: 'all', label: 'All decors' },
		{ value: 'visible', label: 'Customer visible' },
		{ value: 'hidden', label: 'Hidden' }
	];

	const STATUS_OPTIONS = [
		{ value: 'all', label: 'All statuses' },
		{ value: 'active', label: 'Active' },
		{ value: 'discontinued', label: 'Discontinued' }
	];

	function readSort(value: string | null): DecorSort {
		return SORT_KEYS.includes(value as DecorSort) ? (value as DecorSort) : 'caption';
	}

	function readDir(value: string | null, sort: DecorSort): 'asc' | 'desc' {
		if (value === 'asc' || value === 'desc') return value;
		return sort === 'updatedAt' ? 'desc' : 'asc';
	}

	function readVisibility(value: string | null): 'visible' | 'hidden' | 'all' {
		return value === 'visible' || value === 'hidden' ? value : 'all';
	}

	function readPage(value: string | null): number {
		const parsed = Number.parseInt(value ?? '', 10);
		return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 1;
	}

	function readManufacturer(value: string | null): string {
		return value ?? 'all';
	}

	function readColour(value: string | null): DecorColourFamily | 'all' {
		return DECOR_COLOUR_FAMILIES.includes(value as DecorColourFamily)
			? (value as DecorColourFamily)
			: 'all';
	}

	function readMaterial(value: string | null): DecorMaterialType | 'all' {
		return DECOR_MATERIAL_TYPES.includes(value as DecorMaterialType)
			? (value as DecorMaterialType)
			: 'all';
	}

	function readTier(value: string | null): PremiumTier | 'all' {
		return PREMIUM_TIERS.includes(value as PremiumTier) ? (value as PremiumTier) : 'all';
	}

	function readStatus(value: string | null): MaterialStatus | 'all' {
		return MATERIAL_STATUSES.includes(value as MaterialStatus) ? (value as MaterialStatus) : 'all';
	}

	let manufacturers = $state<Array<{ id: string; caption: string }>>([]);
	let query = $state(page.url.searchParams.get('q') ?? '');
	let manufacturerId = $state(readManufacturer(page.url.searchParams.get('manufacturer')));
	let colourFamily = $state<DecorColourFamily | 'all'>(
		readColour(page.url.searchParams.get('colour'))
	);
	let materialType = $state<DecorMaterialType | 'all'>(
		readMaterial(page.url.searchParams.get('material'))
	);
	let premiumTier = $state<PremiumTier | 'all'>(readTier(page.url.searchParams.get('tier')));
	let status = $state<MaterialStatus | 'all'>(readStatus(page.url.searchParams.get('status')));
	let visibility = $state<'visible' | 'hidden' | 'all'>(
		readVisibility(page.url.searchParams.get('visibility'))
	);
	const initialSort = readSort(page.url.searchParams.get('sort'));
	let sort = $state<DecorSort>(initialSort);
	let sortDir = $state<'asc' | 'desc'>(readDir(page.url.searchParams.get('dir'), initialSort));
	let currentPage = $state(readPage(page.url.searchParams.get('page')));

	let rows = $state<DecorListRow[]>([]);
	let total = $state(0);
	let hasMore = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let formOpen = $state(false);
	let duplicateNotice = $state<{
		caption: string;
		candidates: DecorDuplicateCandidate[];
	} | null>(null);
	let requestSequence = 0;
	let lastUrl = `${page.url.pathname}${page.url.search}`;

	const hasFilters = $derived(
		query.trim().length > 0 ||
			manufacturerId !== 'all' ||
			colourFamily !== 'all' ||
			materialType !== 'all' ||
			premiumTier !== 'all' ||
			status !== 'all' ||
			visibility !== 'all'
	);

	const manufacturerOptions = $derived([
		{ value: 'all', label: 'All manufacturers' },
		...manufacturers.map((row) => ({ value: row.id, label: row.caption }))
	]);
	const colourOptions = [
		{ value: 'all', label: 'All colours' },
		...DECOR_COLOUR_FAMILIES.map((value) => ({ value, label: COLOUR_FAMILY_LABELS[value] }))
	];
	const materialOptions = [
		{ value: 'all', label: 'All materials' },
		...DECOR_MATERIAL_TYPES.map((value) => ({ value, label: MATERIAL_TYPE_LABELS[value] }))
	];
	const tierOptions = [
		{ value: 'all', label: 'All tiers' },
		...PREMIUM_TIERS.map((value) => ({ value, label: PREMIUM_TIER_LABELS[value] }))
	];

	function syncUrl(): void {
		const params = new SvelteURLSearchParams();
		if (query.trim().length > 0) params.set('q', query.trim());
		if (manufacturerId !== 'all') params.set('manufacturer', manufacturerId);
		if (colourFamily !== 'all') params.set('colour', colourFamily);
		if (materialType !== 'all') params.set('material', materialType);
		if (premiumTier !== 'all') params.set('tier', premiumTier);
		if (status !== 'all') params.set('status', status);
		if (visibility !== 'all') params.set('visibility', visibility);
		params.set('sort', sort);
		params.set('dir', sortDir);
		if (currentPage > 1) params.set('page', String(currentPage));

		const target = `/materials/decor?${params.toString()}`;
		if (target === lastUrl) return;
		lastUrl = target;
		void goto(resolve(`/materials/decor?${params.toString()}`), {
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
			const result = await materialsApi.listDecors({
				search: query.trim().length > 0 ? query.trim() : undefined,
				manufacturerId,
				colourFamily,
				materialType,
				premiumTier,
				status,
				customerVisible: visibility,
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
			error = isApiError(caught) ? caught.message : 'We could not load decors.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	async function loadManufacturers(): Promise<void> {
		try {
			const tree = await materialsApi.listManufacturers();
			manufacturers = tree.map((node) => ({
				id: node.manufacturer.id,
				caption: node.manufacturer.caption
			}));
		} catch {
			manufacturers = [];
		}
	}

	let initialised = false;
	$effect(() => {
		if (initialised) return;
		initialised = true;
		syncUrl();
		void loadManufacturers();
		void load();
	});

	function reloadFromFirstPage(): void {
		currentPage = 1;
		syncUrl();
		void load();
	}

	function onSort(key: string): void {
		if (!SORT_KEYS.includes(key as DecorSort)) return;
		const next = key as DecorSort;
		if (sort === next) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sort = next;
			sortDir = 'asc';
		}
		reloadFromFirstPage();
	}

	function clearFilters(): void {
		query = '';
		manufacturerId = 'all';
		colourFamily = 'all';
		materialType = 'all';
		premiumTier = 'all';
		status = 'all';
		visibility = 'all';
		reloadFromFirstPage();
	}
</script>

<PageHeader
	eyebrow="Materials"
	title="Decor"
	description="The decor library behind every finish: manufacturer, collection, code, tier and customer visibility."
>
	{#snippet actions()}
		<PermissionGate permission={PERMISSIONS.MATERIALS_CREATE}>
			<Button onclick={() => (formOpen = true)}>
				{#snippet icon()}<Plus size={18} strokeWidth={1.75} aria-hidden="true" />{/snippet}
				New decor
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
							{duplicateNotice.caption} was created. It looks similar to existing decors.
						</p>
						<ul class="flex list-disc flex-col gap-1 ps-5 text-footnote text-ink-secondary">
							{#each duplicateNotice.candidates as candidate (candidate.id)}
								<li>
									<a class="underline" href={resolve(`/materials/decor/${candidate.id}`)}>
										{candidate.caption}
									</a>
									({candidate.decorCode}, {candidate.collectionCaption}) —
									{candidate.matchReasons.join(', ')}
								</li>
							{/each}
						</ul>
						<p class="text-footnote text-ink-secondary">
							Nothing was merged. Review both records and deactivate the duplicate.
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

	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<div class="sm:col-span-2">
			<SearchInput
				label="Search decors"
				bind:value={query}
				placeholder="Search by name, code, collection"
				onsearch={reloadFromFirstPage}
			/>
		</div>
		<Select
			label="Manufacturer"
			bind:value={manufacturerId}
			options={manufacturerOptions}
			onchange={reloadFromFirstPage}
		/>
		<Select
			label="Colour family"
			bind:value={colourFamily}
			options={colourOptions}
			onchange={reloadFromFirstPage}
		/>
		<Select
			label="Material"
			bind:value={materialType}
			options={materialOptions}
			onchange={reloadFromFirstPage}
		/>
		<Select
			label="Premium tier"
			bind:value={premiumTier}
			options={tierOptions}
			onchange={reloadFromFirstPage}
		/>
		<Select
			label="Status"
			bind:value={status}
			options={STATUS_OPTIONS}
			onchange={reloadFromFirstPage}
		/>
		<Select
			label="Customer visibility"
			bind:value={visibility}
			options={VISIBILITY_OPTIONS}
			onchange={reloadFromFirstPage}
		/>
	</div>

	<div class="flex flex-wrap items-center gap-3">
		<p class="text-footnote text-ink-secondary">
			{loading ? 'Loading decors…' : `${total} ${total === 1 ? 'decor' : 'decors'}`}
		</p>
		{#if hasFilters}
			<Button variant="ghost" onclick={clearFilters}>Clear filters</Button>
		{/if}
	</div>

	<DataTable
		caption="Decor library"
		columns={[
			{ key: 'caption', label: 'Decor', sortable: true },
			{ key: 'code', label: 'Code', sortable: true },
			{ key: 'manufacturer', label: 'Manufacturer', sortable: true },
			{ key: 'colour', label: 'Colour' },
			{ key: 'material', label: 'Material' },
			{ key: 'tier', label: 'Tier' },
			{ key: 'status', label: 'Status' },
			{ key: 'visible', label: 'Visible' }
		]}
		{rows}
		rowKey={(row) => row.id}
		sort={{ key: sort, dir: sortDir }}
		{onSort}
		{loading}
		{error}
		density="compact"
		empty={{
			title: hasFilters ? 'No decors match those filters' : 'No decors yet',
			description: hasFilters
				? 'Clear a filter or try another search.'
				: 'Create the first decor inside a manufacturer collection.'
		}}
	>
		{#snippet cell({ row, column })}
			{#if column.key === 'caption'}
				<EntityLink href={`/materials/decor/${row.id}`}>{row.caption}</EntityLink>
			{:else if column.key === 'code'}
				<span class="font-mono text-callout text-ink">{row.decorCode}</span>
			{:else if column.key === 'manufacturer'}
				{row.manufacturerCaption} · {row.collectionCaption}
			{:else if column.key === 'colour'}
				{colourFamilyLabel(row.colourFamily)}
			{:else if column.key === 'material'}
				{materialTypeLabel(row.materialType)}
			{:else if column.key === 'tier'}
				{premiumTierLabel(row.premiumTier)}
			{:else if column.key === 'status'}
				<Badge
					label={materialStatusLabel(row.status)}
					tone={row.status === 'active' ? 'success' : 'neutral'}
				/>
			{:else if column.key === 'visible'}
				{row.customerVisible ? 'Customer visible' : 'Hidden'}
			{/if}
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
		totalLabel={`${rows.length} of ${total} decors loaded`}
	/>
</div>

<DecorFormDrawer
	bind:open={formOpen}
	onClose={() => (formOpen = false)}
	onSaved={(decor, candidates) => {
		toast.success('Decor saved.');
		duplicateNotice = candidates.length > 0 ? { caption: decor.caption, candidates } : null;
		reloadFromFirstPage();
	}}
/>
