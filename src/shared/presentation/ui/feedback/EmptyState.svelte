<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	/**
	 * Empty list / no-content state (DESIGN §9.3): short explanation, one next
	 * action, optional secondary link. No illustration.
	 */
	interface Props {
		title: string;
		description?: string;
		icon?: Snippet;
		action?: Snippet;
		secondaryAction?: Snippet;
		class?: string;
	}

	let { title, description, icon, action, secondaryAction, class: className }: Props = $props();
</script>

<div
	class={cn(
		'mx-auto flex max-w-content-reading flex-col items-center gap-4 px-4 py-16 text-center',
		className
	)}
>
	{#if icon}
		<span class="empty-state-icon text-ink-tertiary" aria-hidden="true">
			{@render icon()}
		</span>
	{/if}

	<div class="flex flex-col gap-2">
		<h2 class="text-title-3 text-ink">{title}</h2>
		{#if description}
			<p class="text-callout text-ink-secondary">{description}</p>
		{/if}
	</div>

	{#if action || secondaryAction}
		<div class="flex flex-col items-center gap-2">
			{#if action}
				{@render action()}
			{/if}
			{#if secondaryAction}
				{@render secondaryAction()}
			{/if}
		</div>
	{/if}
</div>

<style>
	.empty-state-icon :global(svg) {
		width: var(--spacing-6);
		height: var(--spacing-6);
	}
</style>
