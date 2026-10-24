<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { formatDate } from '$shared/lib/format';
	import {
		Badge,
		DataTable,
		EntityLink,
		FilterPills,
		PageHeader,
		Pagination,
		PermissionGate,
		SearchInput,
		Select,
		Switch
	} from '$shared/presentation/ui';
	import { catalogueApi } from '../../data/api';
	import type { CabinetRuleListRow } from '../../domain/types';

	/**
	 * `/catalogue/rules` (phase-3 §3).
	 *
	 * One cross-cabinet view of every component rule, filtered by rule version
	 * and active state. The rules tab on a cabinet edits; this page audits and
	 * toggles without opening each cabinet.
	 */
	const PAGE_SIZE = 25;

	const STATUS_OPTIONS = [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' },
		{ value: 'all', label: 'All states' }
	];

	function readStatus(value: string | null): 'active' | 'inactive' | 'all' {
		return value === 'active' || value === 'inactive' ? value : 'all';
	}

	function readPage(value: string | null): number {
		const parsed = Number.parseInt(value ?? '', 10);
		return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 1;
	}

	let versions = $state<string[]>([]);
	let ruleVersion = $state<string>(page.url.searchParams.get('version') ?? 'all');
	let active = $state<'active' | 'inactive' | 'all'>(
		readStatus(page.url.searchParams.get('active'))
	);
	let query = $state(page.url.searchParams.get('q') ?? '');
	let currentPage = $state(readPage(page.url.searchParams.get('page')));

	let rows = $state<CabinetRuleListRow[]>([]);
	let total = $state(0);
	let hasMore = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let togglingRuleId = $state<string | null>(null);
	let requestSequence = 0;
	let lastUrl = `${page.url.pathname}${page.url.search}`;

	const versionOptions = $derived([
		{ value: 'all', label: `All versions (${versions.length})` },
		...versions.map((version) => ({ value: version, label: `Version ${version}` }))
	]);

	const hasFilters = $derived(query.trim().length > 0 || ruleVersion !== 'all' || active !== 'all');

	function syncUrl(): void {
		const params = new SvelteURLSearchParams();
		if (query.trim().length > 0) params.set('q', query.trim());
		if (ruleVersion !== 'all') params.set('version', ruleVersion);
		if (active !== 'all') params.set('active', active);
		if (currentPage > 1) params.set('page', String(currentPage));

		const target = `/catalogue/rules?${params.toString()}`;
		if (target === lastUrl) return;
		lastUrl = target;
		void goto(resolve(`/catalogue/rules?${params.toString()}`), {
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
			const result = await catalogueApi.listRules({
				search: query.trim().length > 0 ? query.trim() : undefined,
				ruleVersion,
				active,
				sort: 'updatedAt',
				sortDir: 'desc',
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
			error = isApiError(caught) ? caught.message : 'We could not load component rules.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	async function loadVersions(): Promise<void> {
		try {
			versions = await catalogueApi.listRuleVersions();
		} catch {
			versions = [];
		}
	}

	let initialised = false;
	$effect(() => {
		if (initialised) return;
		initialised = true;
		syncUrl();
		void loadVersions();
		void load();
	});

	function reloadFromFirstPage(): void {
		currentPage = 1;
		syncUrl();
		void load();
	}

	async function toggleRule(rule: CabinetRuleListRow, next: boolean): Promise<void> {
		if (togglingRuleId !== null) return;
		togglingRuleId = rule.id;
		try {
			const saved = await catalogueApi.setRuleActive(rule.id, next);
			rows = rows.map((row) =>
				row.id === saved.id ? { ...row, active: saved.active, updatedAt: saved.updatedAt } : row
			);
			toast.success(next ? 'Rule activated.' : 'Rule deactivated.');
		} catch (caught) {
			toast.error(isApiError(caught) ? caught.message : 'We could not change this rule.');
		} finally {
			togglingRuleId = null;
		}
	}
</script>

<PageHeader
	eyebrow="Catalogue"
	title="Component rules"
	description="Every cabinet rule in one list. A rule version changes only when the expression does."
/>

<div class="flex flex-col gap-4">
	<FilterPills
		label="Rule version"
		options={versionOptions}
		value={ruleVersion}
		onchange={(value) => {
			ruleVersion = value;
			reloadFromFirstPage();
		}}
	/>

	<div class="grid gap-3 sm:grid-cols-2">
		<SearchInput
			label="Search rules"
			bind:value={query}
			placeholder="Search by cabinet or part type"
			onsearch={reloadFromFirstPage}
		/>
		<Select
			label="Active state"
			bind:value={active}
			options={STATUS_OPTIONS}
			onchange={reloadFromFirstPage}
		/>
	</div>

	<p class="text-footnote text-ink-secondary">
		{loading ? 'Loading rules…' : `${total} ${total === 1 ? 'rule' : 'rules'}`}
	</p>

	<DataTable
		caption="Component rules across cabinets"
		columns={[
			{ key: 'cabinet', label: 'Cabinet' },
			{ key: 'partType', label: 'Part type' },
			{ key: 'version', label: 'Version' },
			{ key: 'condition', label: 'Condition' },
			{ key: 'updated', label: 'Updated' },
			{ key: 'active', label: 'Active' }
		]}
		{rows}
		rowKey={(row) => row.id}
		{loading}
		{error}
		density="compact"
		empty={{
			title: hasFilters ? 'No rules match those filters' : 'No component rules yet',
			description: hasFilters
				? 'Try another version or clear the search.'
				: 'Add rules on a cabinet detail page.'
		}}
	>
		{#snippet cell({ row, column })}
			{#if column.key === 'cabinet'}
				<EntityLink href={`/catalogue/cabinets/${row.cabinetId}`}>{row.cabinetCaption}</EntityLink>
			{:else if column.key === 'partType'}
				<span class="font-mono text-callout text-ink">{row.partType}</span>
			{:else if column.key === 'version'}
				<Badge label={`v${row.ruleVersion}`} tone="info" />
			{:else if column.key === 'condition'}
				{row.condition === null ? 'Always' : 'Conditional'}
			{:else if column.key === 'updated'}
				{formatDate(row.updatedAt)}
			{:else if column.key === 'active'}
				<PermissionGate permission={PERMISSIONS.CABINET_UPDATE}>
					<Switch
						label="Active"
						checked={row.active}
						disabled={togglingRuleId !== null}
						onchange={(checked) => void toggleRule(row, checked)}
					/>
				</PermissionGate>
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
		totalLabel={`${rows.length} of ${total} rules loaded`}
	/>
</div>
