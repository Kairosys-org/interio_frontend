<script lang="ts">
	import { cn } from '$lib/utils';
	import TextLink from '../link/TextLink.svelte';

	/**
	 * Definition list of record facts (DESIGN §10.2 detail hub). Missing values
	 * render an em dash so the row keeps its place and layout.
	 */
	interface KeyValueItem {
		label: string;
		value: string | null;
		href?: string;
		mono?: boolean;
	}

	interface Props {
		items: KeyValueItem[];
		columns?: 1 | 2 | 3;
	}

	let { items, columns = 2 }: Props = $props();

	const columnClasses = $derived(
		columns === 1
			? 'grid-cols-1'
			: columns === 2
				? 'grid-cols-1 sm:grid-cols-2'
				: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
	);
</script>

<dl class={cn('grid gap-4', columnClasses)}>
	{#each items as item, index (index)}
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-footnote text-ink-secondary">{item.label}</dt>
			<dd
				class={cn(
					'min-w-0 text-callout break-words text-ink',
					item.mono && 'font-mono text-footnote'
				)}
			>
				{#if item.value}
					{#if item.href}
						<TextLink href={item.href}>{item.value}</TextLink>
					{:else}
						{item.value}
					{/if}
				{:else}
					<span class="text-ink-tertiary">—</span>
				{/if}
			</dd>
		</div>
	{/each}
</dl>
