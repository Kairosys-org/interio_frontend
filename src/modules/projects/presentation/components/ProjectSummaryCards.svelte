<script lang="ts">
	import { CalendarClock, ClipboardList, FileText, Hammer, ReceiptText } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import type { ProjectSummaryCounts } from '../../domain/types';

	/**
	 * Hub summary cards (Part 11 §4.2). Counts come from the project summary;
	 * until a module ships the count stays zero and the card says so rather than
	 * pretending the module is empty.
	 */
	interface Props {
		counts: ProjectSummaryCounts;
	}

	let { counts }: Props = $props();

	interface SummaryCard {
		id: string;
		label: string;
		value: string;
		note: string;
		icon: Component;
	}

	const cards = $derived<SummaryCard[]>([
		{
			id: 'surveys',
			label: 'Surveys',
			value: String(counts.surveys),
			note: 'Phase 2',
			icon: ClipboardList
		},
		{
			id: 'designs',
			label: 'Designs',
			value: String(counts.designs),
			note: 'Phase 4',
			icon: CalendarClock
		},
		{
			id: 'quotes',
			label: 'Quotes',
			value: String(counts.quotes),
			note: 'Phase 5',
			icon: FileText
		},
		{
			id: 'orders',
			label: 'Orders',
			value: String(counts.orders),
			note: 'Phase 5',
			icon: ReceiptText
		},
		{
			id: 'job',
			label: 'Job',
			value: counts.job ? 'Created' : 'Not started',
			note: 'Phase 6',
			icon: Hammer
		}
	]);
</script>

<ul class="grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-5">
	{#each cards as card (card.id)}
		{@const Icon = card.icon}
		<li class="flex min-w-0 flex-col gap-2 rounded-lg border border-hairline bg-canvas p-4">
			<span class="flex items-center gap-2 text-ink-secondary">
				<Icon size={18} strokeWidth={1.75} aria-hidden="true" />
				<span class="text-footnote">{card.label}</span>
			</span>
			<span class="text-title-2 text-ink tabular-nums">{card.value}</span>
			<span class="text-caption text-ink-tertiary">{card.note}</span>
		</li>
	{/each}
</ul>
