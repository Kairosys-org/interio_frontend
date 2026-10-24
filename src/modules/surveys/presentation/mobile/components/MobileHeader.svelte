<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	/**
	 * Mobile page heading (DESIGN §11).
	 *
	 * One `h1` per screen, an optional back link that is a real 44 px target,
	 * and a compact action slot. The subtitle carries the context that the web
	 * breadcrumb would show on a wider screen.
	 */
	interface Props {
		title: string;
		subtitle?: string;
		backHref?: string;
		backLabel?: string;
		actions?: Snippet;
	}

	let { title, subtitle, backHref, backLabel = 'Back', actions }: Props = $props();
</script>

<header class="flex flex-col gap-2 pb-4">
	{#if backHref}
		<a
			{...{ href: backHref }}
			class="-ms-2 inline-flex min-h-target touch-manipulation items-center gap-1 rounded-md px-2 text-footnote text-ink-secondary hover:bg-canvas-grouped hover:text-ink"
		>
			<ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
			<span>{backLabel}</span>
		</a>
	{/if}

	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="flex min-w-0 flex-1 basis-48 flex-col gap-1">
			<h1 class="text-title-2 break-words text-ink">{title}</h1>
			{#if subtitle}
				<p class="text-footnote break-words text-ink-secondary">{subtitle}</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>
</header>
