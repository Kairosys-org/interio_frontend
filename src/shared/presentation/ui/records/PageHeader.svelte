<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Page title block (DESIGN §10.1): optional breadcrumb and eyebrow, one
	 * `h1` per page, supporting line and the page's actions.
	 */
	interface Props {
		title: string;
		description?: string;
		eyebrow?: string;
		actions?: Snippet;
		breadcrumbs?: Snippet;
	}

	let { title, description, eyebrow, actions, breadcrumbs }: Props = $props();
</script>

<header class="flex flex-col gap-3">
	{#if breadcrumbs}
		<div>{@render breadcrumbs()}</div>
	{/if}

	<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
		<div class="flex min-w-0 flex-col gap-2">
			{#if eyebrow}
				<p class="text-footnote text-ink-secondary">{eyebrow}</p>
			{/if}
			<h1 class="text-large-title break-words text-ink">{title}</h1>
			{#if description}
				<p class="max-w-content-reading text-body text-ink-secondary">{description}</p>
			{/if}
		</div>

		{#if actions}
			<div class="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
				{@render actions()}
			</div>
		{/if}
	</div>
</header>
