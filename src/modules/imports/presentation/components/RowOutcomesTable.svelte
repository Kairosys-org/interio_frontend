<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { CircleAlert } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { formatCount } from '$shared/lib/format';
	import { stateLabel } from '$shared/lib/status';
	import {
		Badge,
		Button,
		DataTable,
		EntityLink,
		Pagination,
		Select
	} from '$shared/presentation/ui';
	import type {
		ImportKind,
		ImportOutcome,
		ImportRow,
		ImportRowPage,
		ImportStatus,
		ImportValidation
	} from '../../domain/types';
	import { rowValues } from '../import-display';
	import { importsApi } from '../../data/api';

	/**
	 * Per-row outcomes for one batch (phase-1 §3). While staged the result is
	 * the validation state; after commit it is the final outcome. Filtering and
	 * pagination go through `importsApi.rows` so the server stays the authority.
	 */
	interface Props {
		batchId: string;
		status: ImportStatus;
		kind: ImportKind;
		/** First page loaded by the detail page, so opening it fetches rows once. */
		initial: ImportRowPage | null;
		/** Bumped after a commit so the table reloads the final outcomes. */
		reloadToken?: number;
	}

	let { batchId, status, kind, initial, reloadToken = 0 }: Props = $props();

	const PAGE_SIZE = 20;

	type RowFilter = ImportValidation | ImportOutcome | 'all';

	interface FilterOption {
		value: RowFilter;
		label: string;
	}

	const FILTERS: FilterOption[] = [
		{ value: 'all', label: 'All results' },
		{ value: 'ready', label: 'Ready' },
		{ value: 'imported', label: 'Imported' },
		{ value: 'needs_review', label: 'Needs review' },
		{ value: 'rejected', label: 'Rejected' }
	];

	/** Staged rows have no outcome yet; committed rows have no "ready" state. */
	const filterOptions = $derived(
		status === 'staged'
			? FILTERS.filter((option) => option.value !== 'imported')
			: FILTERS.filter((option) => option.value !== 'ready')
	);

	interface TableColumn {
		key: string;
		label: string;
		align?: 'start' | 'end';
	}

	const columns: TableColumn[] = [
		{ key: 'rowNo', label: 'Row', align: 'end' },
		{ key: 'record', label: 'Record' },
		{ key: 'result', label: 'Result' },
		{ key: 'detail', label: 'Detail' }
	];

	/** The first page is a one-shot handoff; later pages come from `load`. */
	const initialPage = untrack(() => initial);

	let filter = $state<RowFilter>('all');
	let page = $state(1);
	let rows = $state<ImportRow[]>(initialPage?.items ?? []);
	let total = $state(initialPage?.total ?? 0);
	let hasMore = $state(initialPage?.hasMore ?? false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let requestSequence = 0;
	let skipNextLoad = initialPage !== null;

	const summary = $derived(
		`${formatCount(rows.length)} of ${formatCount(total)} ${total === 1 ? 'row' : 'rows'} shown.`
	);

	function parseFilter(value: string): RowFilter {
		return FILTERS.some((option) => option.value === value) ? (value as RowFilter) : 'all';
	}

	/** Staged rows carry a validation state; committed rows carry the outcome. */
	function resultValue(row: ImportRow): string {
		return status === 'staged' ? row.validation : (row.outcome ?? row.validation);
	}

	function resultTone(value: string): 'info' | 'success' | 'warning' | 'danger' {
		if (value === 'ready') return 'info';
		if (value === 'imported') return 'success';
		if (value === 'needs_review') return 'warning';
		return 'danger';
	}

	function detailText(row: ImportRow): string | null {
		if (row.error) return row.error;
		if (resultValue(row) === 'needs_review') return 'Held for review; no record was linked.';
		return null;
	}

	function entityHref(row: ImportRow): string | null {
		if (!row.entityId || !row.entityType) return null;
		if (row.entityType === 'customer') return resolve(`/customers/${row.entityId}`);
		if (row.entityType === 'property') return resolve(`/properties/${row.entityId}`);
		if (row.entityType === 'project') return resolve(`/projects/${row.entityId}`);
		return null;
	}

	async function load(currentFilter: RowFilter, targetPage: number): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;

		const collected: ImportRow[] = [];
		let resultPage: ImportRowPage | null = null;

		try {
			for (let index = 1; index <= targetPage; index += 1) {
				resultPage = await importsApi.rows(batchId, {
					result: currentFilter,
					page: index,
					pageSize: PAGE_SIZE
				});
				collected.push(...resultPage.items);
				if (!resultPage.hasMore) break;
			}

			if (sequence !== requestSequence) return;
			rows = collected;
			total = resultPage?.total ?? 0;
			hasMore = resultPage?.hasMore ?? false;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			rows = [];
			total = 0;
			hasMore = false;
			error = isApiError(caught) ? caught.message : 'We could not load these rows. Try again.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	/**
	 * A commit flips the batch to `committed` and bumps `reloadToken`. Reset the
	 * filter first so the reload shows the final outcomes instead of an empty
	 * "Ready" view (ready is a validation state, not an outcome).
	 */
	let lastStatus: ImportStatus = untrack(() => status);

	$effect(() => {
		if (status === lastStatus) return;
		lastStatus = status;
		filter = 'all';
		page = 1;
	});

	$effect(() => {
		const currentFilter = filter;
		const currentPage = page;
		const token = reloadToken;
		void token;

		if (skipNextLoad) {
			skipNextLoad = false;
			return;
		}

		void load(currentFilter, currentPage);
	});

	function handleFilter(value: string): void {
		const next = parseFilter(value);
		if (next === filter) return;
		filter = next;
		page = 1;
	}

	function loadMore(): void {
		if (loading || !hasMore) return;
		page += 1;
	}

	function retry(): void {
		void load(filter, page);
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
		<Select
			label="Result"
			value={filter}
			options={filterOptions}
			onchange={(event) => handleFilter((event.currentTarget as HTMLSelectElement).value)}
			class="w-full sm:max-w-xs"
		/>
		<p class="text-footnote text-ink-secondary" role="status" aria-live="polite">{summary}</p>
	</div>

	{#if error}
		<div class="flex flex-col items-start gap-3 rounded-lg border border-hairline bg-canvas p-4">
			<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{error}</span>
			</p>
			<Button variant="secondary" onclick={retry}>Try again</Button>
		</div>
	{:else}
		<DataTable
			caption="Import rows"
			{columns}
			{rows}
			rowKey={(row) => row.id}
			{loading}
			density="compact"
			empty={{
				title: filter === 'all' ? 'This import has no rows.' : 'No rows match this result.',
				description:
					filter === 'all'
						? 'The file had a heading row but no data rows.'
						: 'Choose another result to see the rest of the batch.'
			}}
		>
			{#snippet cell({ row, column }: { row: ImportRow; column: TableColumn })}
				{#if column.key === 'rowNo'}
					<span class="tabular-nums">{row.rowNo}</span>
				{:else if column.key === 'record'}
					{@const values = rowValues(kind, row.payload)}
					<div class="flex min-w-0 flex-col gap-0.5">
						<span class="break-words text-ink">{values.primary}</span>
						{#if values.secondary}
							<span class="text-footnote break-words text-ink-tertiary">{values.secondary}</span>
						{/if}
					</div>
				{:else if column.key === 'result'}
					<Badge label={stateLabel(resultValue(row))} tone={resultTone(resultValue(row))} />
				{:else if column.key === 'detail'}
					{@const href = entityHref(row)}
					{#if href}
						<EntityLink {href} class="inline-flex min-h-target items-center">
							View {row.entityType}
						</EntityLink>
					{:else if detailText(row)}
						<span class="break-words text-critical-ink">{detailText(row)}</span>
					{:else}
						<span class="text-ink-tertiary">—</span>
					{/if}
				{/if}
			{/snippet}
		</DataTable>

		<Pagination
			{hasMore}
			{loading}
			onLoadMore={loadMore}
			totalLabel={`${formatCount(total)} ${total === 1 ? 'row' : 'rows'}`}
		/>
	{/if}
</div>
