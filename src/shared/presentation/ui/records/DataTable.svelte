<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { ArrowDown, ArrowUp, ChevronsUpDown, CircleAlert } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import EmptyState from '../feedback/EmptyState.svelte';
	import Skeleton from '../feedback/Skeleton.svelte';

	interface Column {
		key: string;
		label: string;
		sortable?: boolean;
		align?: 'start' | 'end';
	}

	interface Props {
		caption: string;
		columns: Column[];
		rows: T[];
		rowKey: (row: T) => string;
		cell: Snippet<[{ row: T; column: Column }]>;
		actions?: Snippet<[T]>;
		sort?: { key: string; dir: 'asc' | 'desc' } | null;
		onSort?: (key: string) => void;
		loading?: boolean;
		error?: string | null;
		empty?: { title: string; description?: string } | null;
		density?: 'comfortable' | 'compact';
	}

	let {
		caption,
		columns,
		rows,
		rowKey,
		cell,
		actions,
		sort = null,
		onSort,
		loading = false,
		error = null,
		empty = null,
		density = 'comfortable'
	}: Props = $props();

	const compact = $derived(density === 'compact');

	function ariaSort(column: Column): 'ascending' | 'descending' | 'none' | undefined {
		if (!column.sortable) return undefined;
		if (sort?.key !== column.key) return 'none';
		return sort.dir === 'asc' ? 'ascending' : 'descending';
	}

	function sortStateLabel(column: Column): string {
		if (sort?.key !== column.key) return 'Sortable';
		return sort.dir === 'asc' ? 'Sorted ascending' : 'Sorted descending';
	}
</script>

<div
	class="w-full min-w-0 overflow-hidden rounded-lg border border-hairline bg-canvas contain-paint"
>
	{#if loading}
		<div class="flex flex-col gap-3 p-4" role="status" aria-live="polite">
			<span class="sr-only">Loading {caption}</span>
			{#each [0, 1, 2] as index (index)}
				<div class="flex items-center gap-4">
					<div class="flex-1"><Skeleton /></div>
					<div class="w-24"><Skeleton /></div>
					<div class="w-16"><Skeleton /></div>
				</div>
			{/each}
		</div>
	{:else if error}
		<p class="flex items-start gap-2 p-4 text-callout text-critical-ink" role="alert">
			<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
			<span>{error}</span>
		</p>
	{:else if rows.length === 0}
		<EmptyState
			title={empty?.title ?? 'No results'}
			description={empty?.description ?? 'There is nothing to show here yet.'}
		/>
	{:else}
		<div class="hidden overflow-x-auto md:block">
			<table
				class={cn(
					'data-table w-full border-collapse text-left tabular-nums',
					compact && 'data-table-compact'
				)}
			>
				<caption class="sr-only">{caption}</caption>
				<thead class="bg-canvas-grouped">
					<tr>
						{#each columns as column (column.key)}
							<th
								scope="col"
								aria-sort={ariaSort(column)}
								class={cn(
									'px-4 py-3 text-footnote font-normal text-ink-secondary',
									compact && 'px-3 py-2',
									column.align === 'end' && 'text-end'
								)}
							>
								{#if column.sortable && onSort}
									<button
										type="button"
										onclick={() => onSort?.(column.key)}
										class={cn(
											'-mx-2 inline-flex min-h-target items-center gap-1.5 rounded-sm px-2 text-footnote text-ink-secondary hover:text-ink',
											column.align === 'end' && 'w-full justify-end'
										)}
									>
										<span>{column.label}</span>
										{#if sort?.key === column.key && sort.dir === 'asc'}
											<ArrowUp size={14} strokeWidth={1.75} aria-hidden="true" />
										{:else if sort?.key === column.key && sort.dir === 'desc'}
											<ArrowDown size={14} strokeWidth={1.75} aria-hidden="true" />
										{:else}
											<ChevronsUpDown size={14} strokeWidth={1.75} aria-hidden="true" />
										{/if}
										<span class="sr-only">, {sortStateLabel(column)}</span>
									</button>
								{:else}
									<span class="inline-flex items-center">{column.label}</span>
								{/if}
							</th>
						{/each}
						{#if actions}
							<th
								scope="col"
								class={cn(
									'sticky right-0 border-l border-hairline bg-canvas-grouped px-4 py-3 text-end',
									compact && 'px-3 py-2'
								)}
							>
								<span class="sr-only">Actions</span>
							</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each rows as row (rowKey(row))}
						<tr class="border-t border-hairline hover:bg-canvas-grouped">
							{#each columns as column (column.key)}
								<td
									class={cn(
										'px-4 py-3 align-middle text-callout text-ink',
										compact && 'px-3 py-2',
										column.align === 'end' && 'text-end'
									)}
								>
									{@render cell({ row, column })}
								</td>
							{/each}
							{#if actions}
								<td
									class={cn(
										'sticky right-0 border-l border-hairline bg-canvas px-4 py-3 align-middle',
										compact && 'px-3 py-2'
									)}
								>
									<div class="flex items-center justify-end gap-2">
										{@render actions(row)}
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<ul class="flex list-none flex-col divide-y divide-hairline p-0 md:hidden">
			{#each rows as row (rowKey(row))}
				<li class="flex flex-col">
					<dl class="flex flex-col gap-2 p-4">
						{#each columns as column (column.key)}
							<div class="flex items-start justify-between gap-4">
								<dt class="text-footnote text-ink-secondary">{column.label}</dt>
								<dd
									class={cn(
										'min-w-0 text-end text-callout break-words text-ink',
										column.align === 'end' && 'tabular-nums'
									)}
								>
									{@render cell({ row, column })}
								</dd>
							</div>
						{/each}
					</dl>

					{#if actions}
						<div
							class="flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-4 py-2"
						>
							{@render actions(row)}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	/* Row heights come from the density tokens; padding never sets them (DESIGN §5.5). */
	.data-table {
		--data-row-height: var(--layout-row-comfortable);
	}

	.data-table-compact {
		--data-row-height: var(--layout-row-compact);
	}

	.data-table tbody tr {
		height: var(--data-row-height);
	}
</style>
