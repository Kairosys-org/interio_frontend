<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import EmptyState from '../feedback/EmptyState.svelte';
	import Skeleton from '../feedback/Skeleton.svelte';
	import Select from '../select/Select.svelte';

	interface AuditRow {
		id: string;
		action: string;
		actorEmail: string;
		occurredAt: string;
		payload: Record<string, unknown> | null;
	}

	interface Props {
		rows: AuditRow[];
		loading?: boolean;
		error?: string | null;
		emptyLabel?: string;
		class?: string;
	}

	let {
		rows,
		loading = false,
		error = null,
		emptyLabel = 'No activity yet.',
		class: className
	}: Props = $props();

	const ALL = 'all';

	let action = $state(ALL);

	const actionOptions = $derived(
		Array.from(new Set(rows.map((row) => row.action)))
			.sort((a, b) => a.localeCompare(b))
			.map((value) => ({ value, label: humaniseAction(value) }))
	);

	/** Keep the select valid when a filter value disappears after a reload. */
	const activeAction = $derived(
		action === ALL || actionOptions.some((option) => option.value === action) ? action : ALL
	);

	const filteredRows = $derived(
		activeAction === ALL ? rows : rows.filter((row) => row.action === activeAction)
	);

	const summary = $derived(
		filteredRows.length === rows.length
			? `${rows.length} ${rows.length === 1 ? 'event' : 'events'}`
			: `${filteredRows.length} of ${rows.length} events`
	);

	function humaniseAction(value: string): string {
		const words = value.replace(/[._-]+/g, ' ').trim();
		if (words === '') return value;
		return words.charAt(0).toUpperCase() + words.slice(1);
	}

	const dateFormat = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/London'
	});

	function formatTimestamp(value: string): string {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
	}

	function prettyPayload(payload: Record<string, unknown>): string {
		try {
			return JSON.stringify(payload, null, 2);
		} catch {
			return 'The details for this event could not be displayed.';
		}
	}
</script>

<div class={cn('flex flex-col gap-4', className)}>
	{#if loading}
		<div class="flex flex-col gap-3" role="status" aria-live="polite">
			<span class="sr-only">Loading activity</span>
			{#each [0, 1, 2] as index (index)}
				<Skeleton lines={2} />
			{/each}
		</div>
	{:else if error}
		<p class="flex items-start gap-2 text-callout text-critical-ink" role="alert">
			<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
			<span>{error}</span>
		</p>
	{:else if rows.length === 0}
		<EmptyState title={emptyLabel} />
	{:else}
		<div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
			<Select
				label="Filter by action"
				value={activeAction}
				onchange={(event) => (action = (event.currentTarget as HTMLSelectElement).value)}
				options={[{ value: ALL, label: 'All actions' }, ...actionOptions]}
				class="w-full sm:max-w-xs"
			/>
			<p class="text-footnote text-ink-secondary" role="status" aria-live="polite">{summary}</p>
		</div>

		{#if filteredRows.length === 0}
			<p class="rounded-md bg-canvas-grouped p-4 text-callout text-ink-secondary">
				No events recorded for this action.
			</p>
		{:else}
			<ol class="flex list-none flex-col p-0">
				{#each filteredRows as row (row.id)}
					<li class="flex gap-3 border-s border-hairline ps-4 pb-6 last:pb-0">
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<p class="text-callout text-ink">{humaniseAction(row.action)}</p>
							<p class="text-footnote text-ink-secondary">By {row.actorEmail}</p>
							<time class="text-footnote text-ink-tertiary" datetime={row.occurredAt}>
								{formatTimestamp(row.occurredAt)}
							</time>

							{#if row.payload}
								<details class="mt-1">
									<summary
										class="inline-flex min-h-target cursor-pointer items-center text-footnote text-brand"
									>
										Details
									</summary>
									<pre
										class="mt-2 overflow-x-auto rounded-md bg-canvas-nested p-3 font-mono text-footnote whitespace-pre text-ink">{prettyPayload(
											row.payload
										)}</pre>
								</details>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		{/if}
	{/if}
</div>
