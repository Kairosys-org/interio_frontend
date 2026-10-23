<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	/**
	 * Grouped panel on a detail hub (DESIGN §10.2): one surface, one hairline,
	 * one `h2`. Never nest a card inside a card beyond this level.
	 */
	interface Props {
		title: string;
		description?: string;
		actions?: Snippet;
		children: Snippet;
		class?: string;
	}

	let { title, description, actions, children, class: className }: Props = $props();
</script>

<section
	class={cn(
		'flex flex-col gap-4 rounded-lg border border-hairline bg-canvas p-4 md:p-5',
		className
	)}
>
	<div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
		<div class="flex min-w-0 flex-col gap-1">
			<h2 class="text-title-3 text-ink">{title}</h2>
			{#if description}
				<p class="text-callout text-ink-secondary">{description}</p>
			{/if}
		</div>

		{#if actions}
			<div class="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
				{@render actions()}
			</div>
		{/if}
	</div>

	{@render children()}
</section>
