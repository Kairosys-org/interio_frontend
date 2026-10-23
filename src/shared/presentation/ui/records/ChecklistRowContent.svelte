<script lang="ts">
	import { CircleAlert, CircleCheck, CircleDashed } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import Badge from '../feedback/Badge.svelte';
	import type { ChecklistRow } from './checklist-types';

	/**
	 * One checklist row's body, shared by the link/button/static wrappers in
	 * `ChecklistDrawer`. Internal to the drawer, not part of the barrel.
	 */
	interface Props {
		row: ChecklistRow;
	}

	let { row }: Props = $props();

	const STATUS = {
		pass: { label: 'Complete', Icon: CircleCheck },
		fail: { label: 'Needs attention', Icon: CircleAlert },
		pending: { label: 'Not checked', Icon: CircleDashed }
	} as const;

	const status = $derived(STATUS[row.status]);
</script>

<span class="flex min-w-0 flex-1 flex-col gap-1">
	<span class="flex flex-wrap items-center gap-2">
		<span class="text-callout text-ink">{row.label}</span>
		{#if row.status === 'fail' && row.blocking !== false}
			<Badge label="Blocks submission" tone="danger" />
		{/if}
	</span>
	{#if row.detail}
		<span class="text-footnote text-ink-secondary">{row.detail}</span>
	{/if}
	<span
		class={cn(
			'inline-flex items-center gap-1 text-caption',
			row.status === 'fail' ? 'text-critical-ink' : 'text-ink-secondary'
		)}
	>
		<status.Icon size={14} strokeWidth={1.75} aria-hidden="true" />
		{status.label}
	</span>
</span>
