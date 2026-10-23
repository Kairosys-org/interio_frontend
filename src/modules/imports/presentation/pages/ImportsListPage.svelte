<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { CircleAlert, Plus } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { IMPORT_KINDS, IMPORT_STATUSES } from '$shared/domain/record-states';
	import { formatCount, formatDate } from '$shared/lib/format';
	import { stateLabel } from '$shared/lib/status';
	import {
		Button,
		DataTable,
		EmptyState,
		EntityLink,
		PageHeader,
		Pagination,
		PermissionGate,
		Select,
		StateChip
	} from '$shared/presentation/ui';
	import { importsApi } from '../../data/api';
	import type { ImportBatch, ImportBatchPage, ImportKind, ImportStatus } from '../../domain/types';
	import { batchRowBreakdown, IMPORT_KIND_LABELS } from '../import-display';

	/**
	 * `/imports` list (DESIGN §10.2 List): header, kind/status filters, table,
	 * keyset "Load more". Filters and page live in the URL so a reload restores
	 * the same view (Part 11 §1).
	 */
	const PAGE_SIZE = 20;
	const MAX_PAGE = 20;

	interface TableColumn {
		key: string;
		label: string;
		align?: 'start' | 'end';
	}

	const columns: TableColumn[] = [
		{ key: 'file', label: 'File' },
		{ key: 'kind', label: 'Kind' },
		{ key: 'status', label: 'Status' },
		{ key: 'rows', label: 'Rows', align: 'end' },
		{ key: 'createdAt', label: 'Created' }
	];

	const kindOptions = [
		{ value: 'all', label: 'All kinds' },
		...IMPORT_KINDS.map((kind) => ({ value: kind, label: IMPORT_KIND_LABELS[kind] }))
	];

	const statusOptions = [
		{ value: 'all', label: 'All statuses' },
		...IMPORT_STATUSES.map((status) => ({ value: status, label: stateLabel(status) }))
	];

	interface ListUrlState {
		kind: ImportKind | 'all';
		status: ImportStatus | 'all';
		page: number;
	}

	function parseKind(value: string | null): ImportKind | 'all' {
		return value !== null && (IMPORT_KINDS as readonly string[]).includes(value)
			? (value as ImportKind)
			: 'all';
	}

	function parseStatus(value: string | null): ImportStatus | 'all' {
		return value !== null && (IMPORT_STATUSES as readonly string[]).includes(value)
			? (value as ImportStatus)
			: 'all';
	}

	function parsePage(value: string | null): number {
		const parsed = Number(value);
		if (!Number.isInteger(parsed) || parsed < 1) return 1;
		return Math.min(parsed, MAX_PAGE);
	}

	function readUrl(params: URLSearchParams): ListUrlState {
		return {
			kind: parseKind(params.get('kind')),
			status: parseStatus(params.get('status')),
			page: parsePage(params.get('page'))
		};
	}

	function buildHref(state: ListUrlState): string {
		const params = new URLSearchParams();
		if (state.kind !== 'all') params.set('kind', state.kind);
		if (state.status !== 'all') params.set('status', state.status);
		if (state.page > 1) params.set('page', String(state.page));
		const suffix = params.toString();
		return suffix.length > 0 ? `/imports?${suffix}` : '/imports';
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

	let rows = $state<ImportBatch[]>([]);
	let total = $state(0);
	let hasMore = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let requestSequence = 0;

	const hasFilters = $derived(urlState.kind !== 'all' || urlState.status !== 'all');

	async function load(state: ListUrlState): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;

		const collected: ImportBatch[] = [];
		let resultPage: ImportBatchPage | null = null;

		try {
			for (let index = 1; index <= state.page; index += 1) {
				resultPage = await importsApi.list({
					kind: state.kind,
					status: state.status,
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
			error = isApiError(caught) ? caught.message : 'We could not load imports. Try again.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	$effect(() => {
		void load(urlState);
	});

	function updateFilters(patch: Partial<ListUrlState>): void {
		applyUrl({ ...urlState, ...patch, page: patch.page ?? 1 });
	}

	function loadMore(): void {
		if (loading || !hasMore) return;
		applyUrl({ ...urlState, page: Math.min(urlState.page + 1, MAX_PAGE) });
	}

	function resetFilters(): void {
		applyUrl({ kind: 'all', status: 'all', page: 1 });
	}

	function retry(): void {
		void load(urlState);
	}
</script>

<svelte:head>
	<title>Imports · Interio</title>
</svelte:head>

{#snippet newImportAction()}
	<PermissionGate permission={PERMISSIONS.IMPORT_CREATE}>
		<a
			href={resolve('/imports/new')}
			class="inline-flex min-h-target min-w-target touch-manipulation items-center justify-center gap-2 rounded-md bg-brand px-4 text-subheadline whitespace-nowrap text-on-brand select-none hover:bg-brand-hover"
		>
			<Plus size={20} strokeWidth={1.75} aria-hidden="true" />
			New import
		</a>
	</PermissionGate>
{/snippet}

<PageHeader
	title="Imports"
	description="Every CSV batch you have staged, committed or cancelled, with what happened to each row."
>
	{#snippet actions()}
		{@render newImportAction()}
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-3 pt-6 pb-6 md:flex-row md:items-end">
	<Select
		label="Kind"
		value={urlState.kind}
		options={kindOptions}
		onchange={(event) =>
			updateFilters({ kind: parseKind((event.currentTarget as HTMLSelectElement).value) })}
		class="md:w-52"
	/>

	<Select
		label="Status"
		value={urlState.status}
		options={statusOptions}
		onchange={(event) =>
			updateFilters({ status: parseStatus((event.currentTarget as HTMLSelectElement).value) })}
		class="md:w-52"
	/>
</div>

<section
	aria-labelledby="imports-heading"
	class="flex flex-col gap-4"
	aria-busy={loading ? 'true' : undefined}
>
	<h2 id="imports-heading" class="sr-only">Import batches</h2>

	<p class="sr-only" role="status" aria-live="polite">
		{loading
			? 'Loading imports.'
			: `${formatCount(total)} ${total === 1 ? 'import batch' : 'import batches'} match this view.`}
	</p>

	{#if loading}
		<DataTable
			caption="Import batches"
			{columns}
			rows={[]}
			rowKey={(row) => row.id}
			loading
			density="compact"
		>
			{#snippet cell({ row }: { row: ImportBatch; column: TableColumn })}
				<span class="sr-only">{row.fileName}</span>
			{/snippet}
		</DataTable>
	{:else if error}
		<div class="flex flex-col items-start gap-3 rounded-lg border border-hairline bg-canvas p-4">
			<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{error}</span>
			</p>
			<Button variant="secondary" onclick={retry}>Try again</Button>
		</div>
	{:else if rows.length === 0}
		<EmptyState
			title={hasFilters ? 'No imports match these filters.' : 'No imports yet.'}
			description={hasFilters
				? 'Clear the kind or status filter to see every batch.'
				: 'Import customers, properties or projects from a CSV file to start a batch.'}
		>
			{#snippet action()}
				{#if hasFilters}
					<Button variant="secondary" onclick={resetFilters}>Clear filters</Button>
				{:else}
					{@render newImportAction()}
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<DataTable caption="Import batches" {columns} {rows} rowKey={(row) => row.id} density="compact">
			{#snippet cell({ row, column }: { row: ImportBatch; column: TableColumn })}
				{#if column.key === 'file'}
					<EntityLink
						href={resolve(`/imports/${row.id}` as Pathname)}
						class="inline-flex min-h-target items-center"
					>
						{row.fileName}
					</EntityLink>
				{:else if column.key === 'kind'}
					<span class="text-callout text-ink">{IMPORT_KIND_LABELS[row.kind]}</span>
				{:else if column.key === 'status'}
					<StateChip entity="import_batch" state={row.status} />
				{:else if column.key === 'rows'}
					<div class="flex flex-col gap-0.5 tabular-nums">
						<span class="text-callout text-ink">
							{formatCount(row.totalRows)}
							{row.totalRows === 1 ? 'row' : 'rows'}
						</span>
						<span class="text-footnote text-ink-tertiary">{batchRowBreakdown(row)}</span>
					</div>
				{:else if column.key === 'createdAt'}
					<time datetime={row.createdAt} class="text-callout text-ink-secondary">
						{formatDate(row.createdAt)}
					</time>
				{/if}
			{/snippet}
		</DataTable>

		<p class="text-footnote text-ink-secondary" role="status" aria-live="polite">
			Showing {formatCount(rows.length)} of {formatCount(total)}
			{total === 1 ? 'import batch' : 'import batches'}.
		</p>

		<Pagination
			{hasMore}
			{loading}
			onLoadMore={loadMore}
			totalLabel={`${formatCount(total)} ${total === 1 ? 'import batch' : 'import batches'}`}
		/>
	{/if}
</section>
