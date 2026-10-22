<script lang="ts">
	import type { Snippet } from 'svelte';
	import ForbiddenPage from './ForbiddenPage.svelte';

	/**
	 * Catches unexpected render/runtime errors in a subtree (DESIGN §9.2) and
	 * hands them to the error variant of `ForbiddenPage`. `reset()` replays the
	 * failed subtree; `onRetry` lets the caller refresh its data first.
	 */
	interface Props {
		onRetry?: () => void;
		children: Snippet;
		class?: string;
	}

	let { onRetry, children, class: className }: Props = $props();
</script>

<svelte:boundary>
	{@render children()}

	{#snippet failed(_error, reset)}
		<ForbiddenPage
			variant="error"
			class={className}
			onRetry={() => {
				onRetry?.();
				reset();
			}}
		/>
	{/snippet}
</svelte:boundary>
