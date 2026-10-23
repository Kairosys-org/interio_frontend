<script lang="ts">
	import { Info } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import Skeleton from '../feedback/Skeleton.svelte';
	import Sheet from '../overlay/Sheet.svelte';
	import ChecklistRowContent from './ChecklistRowContent.svelte';
	import type { ChecklistRow, ChecklistSection } from './checklist-types';

	/**
	 * Submission / verification readiness (DESIGN §9.2, spec Part 9 §14).
	 *
	 * A bottom sheet on phones and a side panel from `lg` up. The blocker count
	 * is part of the sheet title so it survives a collapsed scan, each row
	 * names its state in words, and the page owns the gated action through the
	 * `footer` snippet.
	 */
	interface Props {
		open?: boolean;
		title?: string;
		description?: string;
		sections: ChecklistSection[];
		/** Unsatisfied blocking rows, used in the title. */
		blockers: number;
		loading?: boolean;
		onclose?: () => void;
		/** Called for a row without `href`; usually scrolls to the section. */
		onjump?: (row: ChecklistRow) => void;
		footer?: Snippet;
		class?: string;
	}

	let {
		open = $bindable(false),
		title = 'Submission checklist',
		description,
		sections,
		blockers,
		loading = false,
		onclose,
		onjump,
		footer,
		class: className
	}: Props = $props();

	let desktop = $state(false);

	$effect(() => {
		const query = window.matchMedia('(min-width: 64rem)');
		const update = () => {
			desktop = query.matches;
		};
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	});

	const sheetTitle = $derived(
		loading
			? `${title} · Checking…`
			: blockers > 0
				? `${title} · ${blockers} blocking`
				: `${title} · Ready`
	);
</script>

<Sheet
	bind:open
	title={sheetTitle}
	{description}
	side={desktop ? 'end' : 'bottom'}
	onclose={onclose ? () => onclose() : undefined}
	{footer}
	class={className}
>
	{#if loading}
		<div class="flex flex-col gap-3" role="status" aria-live="polite">
			<span class="sr-only">Checking readiness</span>
			{#each [0, 1, 2, 3] as index (index)}
				<Skeleton />
			{/each}
		</div>
	{:else if sections.length === 0}
		<p class="text-callout text-ink-secondary">Nothing to check yet.</p>
	{:else}
		<div class="flex flex-col gap-6">
			{#each sections as section (section.id)}
				<section class="flex flex-col gap-2" aria-labelledby={`checklist-${section.id}`}>
					<h3 id={`checklist-${section.id}`} class="text-subheadline text-ink">
						{section.label}
					</h3>
					<ul class="flex flex-col gap-1">
						{#each section.rows as row (row.id)}
							<li>
								{#if row.href}
									<a
										{...{ href: row.href ?? '' }}
										class="flex min-h-target touch-manipulation items-start gap-3 rounded-md px-2 py-2 hover:bg-canvas-grouped"
									>
										<ChecklistRowContent {row} />
									</a>
								{:else if onjump}
									<button
										type="button"
										onclick={() => onjump(row)}
										class="flex min-h-target w-full touch-manipulation items-start gap-3 rounded-md px-2 py-2 text-start hover:bg-canvas-grouped"
									>
										<ChecklistRowContent {row} />
									</button>
								{:else}
									<div class="flex min-h-target items-start gap-3 px-2 py-2">
										<ChecklistRowContent {row} />
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/each}

			{#if blockers > 0}
				<p class="flex items-start gap-2 text-footnote text-critical-ink" role="status">
					<Info size={16} strokeWidth={1.75} aria-hidden="true" class="mt-1 shrink-0" />
					<span>
						{blockers}
						{blockers === 1 ? 'item blocks' : 'items block'} submission. Fix every blocking item before
						submitting.
					</span>
				</p>
			{/if}
		</div>
	{/if}
</Sheet>
