<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Sticky action bar (DESIGN §11).
	 *
	 * Sits directly above the fixed tab bar and keeps the primary action of a
	 * capture screen reachable with one thumb. The page decides which actions
	 * exist; the bar only owns placement and the safe-area offset.
	 */
	interface Props {
		children: Snippet;
		/** Short sentence that explains what the action will do. */
		hint?: string;
	}

	let { children, hint }: Props = $props();
</script>

<div class="mobile-actionbar border-t border-hairline bg-canvas pt-3">
	{#if hint}
		<p class="pb-2 text-footnote text-ink-secondary">{hint}</p>
	{/if}
	<div class="flex flex-wrap items-center justify-end gap-2">
		{@render children()}
	</div>
</div>

<style>
	.mobile-actionbar {
		position: sticky;
		bottom: calc(4rem + env(safe-area-inset-bottom));
		z-index: 20;
		margin-inline: calc(var(--layout-gutter-mobile) * -1);
		padding-inline: var(--layout-gutter-mobile);
		padding-block-end: 0.75rem;
	}
</style>
