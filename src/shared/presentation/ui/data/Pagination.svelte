<script lang="ts">
	import { cn } from '$lib/utils';
	import Button from '../button/Button.svelte';

	interface Props {
		hasMore: boolean;
		loading?: boolean;
		onLoadMore: () => void;
		/** Total or loaded count, announced politely when it changes. */
		totalLabel?: string;
		class?: string;
	}

	let { hasMore, loading = false, onLoadMore, totalLabel, class: className }: Props = $props();
</script>

{#if hasMore}
	<nav aria-label="Pagination" class={cn('flex flex-col items-start gap-2', className)}>
		<Button variant="secondary" {loading} loadingLabel="Loading…" onclick={onLoadMore}>
			Load more
		</Button>

		{#if totalLabel}
			<p class="text-footnote text-ink-secondary" role="status" aria-live="polite">{totalLabel}</p>
		{/if}
	</nav>
{/if}
