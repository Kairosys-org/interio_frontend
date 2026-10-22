<script lang="ts">
	import { cn } from '$lib/utils';

	type Variant = 'text' | 'block' | 'circle';

	interface Props {
		variant?: Variant;
		/** Only used by `text`; the last line is shorter to mirror prose. */
		lines?: number;
		class?: string;
	}

	let { variant = 'text', lines = 1, class: className }: Props = $props();

	const lineIndexes = $derived(
		Array.from({ length: Math.max(1, Math.floor(lines)) }, (_unused, index) => index)
	);
</script>

<div aria-hidden="true" class={cn('flex flex-col gap-2', className)}>
	{#if variant === 'circle'}
		<div class="skeleton size-10 rounded-full"></div>
	{:else if variant === 'block'}
		<div class="skeleton h-16 w-full rounded-lg"></div>
	{:else}
		{#each lineIndexes as index (index)}
			<div
				class={cn(
					'skeleton h-4 rounded-sm',
					index === lineIndexes.length - 1 && lineIndexes.length > 1 ? 'w-3/4' : 'w-full'
				)}
			></div>
		{/each}
	{/if}
</div>

<style>
	.skeleton {
		background: var(--color-bg-tertiary);
	}

	/* Pulse only when motion is welcome; otherwise a calm static block. */
	@media (prefers-reduced-motion: no-preference) {
		.skeleton {
			animation: skeleton-pulse calc(var(--motion-page) * 2) var(--ease-standard) infinite alternate;
		}
	}

	@keyframes skeleton-pulse {
		from {
			opacity: 1;
		}

		to {
			opacity: 0.55;
		}
	}
</style>
