<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Variant = 'ghost' | 'secondary' | 'destructive';

	interface Props extends Omit<
		HTMLButtonAttributes,
		'children' | 'onclick' | 'disabled' | 'class' | 'type'
	> {
		/** Required accessible name; also used as the hover tooltip. */
		label: string;
		/** Decorative icon at 20 px, `aria-hidden="true"`. */
		icon: Snippet;
		variant?: Variant;
		disabled?: boolean;
		loading?: boolean;
		onclick?: (event: MouseEvent) => void;
		class?: string;
	}

	let {
		label,
		icon,
		variant = 'ghost',
		disabled = false,
		loading = false,
		onclick,
		class: className,
		...rest
	}: Props = $props();

	const VARIANTS: Record<Variant, string> = {
		ghost: 'text-ink enabled:hover:bg-canvas-grouped',
		secondary: 'border border-hairline-strong bg-canvas text-ink enabled:hover:bg-canvas-grouped',
		destructive: 'text-critical-ink enabled:hover:bg-critical-soft'
	};

	const isDisabled = $derived(disabled || loading);
</script>

<button
	{...rest}
	type="button"
	aria-label={label}
	title={label}
	disabled={isDisabled}
	aria-busy={loading ? 'true' : undefined}
	{onclick}
	class={cn(
		'icon-button inline-flex min-h-target min-w-target touch-manipulation items-center justify-center rounded-md p-3 select-none disabled:cursor-not-allowed disabled:text-ink-disabled disabled:opacity-60',
		VARIANTS[variant],
		className
	)}
>
	{#if loading}
		<span class="icon-button-spinner" aria-hidden="true"></span>
	{:else}
		{@render icon()}
	{/if}
</button>

<style>
	.icon-button {
		transition:
			background-color var(--motion-fast) var(--ease-standard),
			border-color var(--motion-fast) var(--ease-standard),
			color var(--motion-fast) var(--ease-standard);
	}

	.icon-button-spinner {
		inline-size: var(--spacing-4);
		block-size: var(--spacing-4);
		flex-shrink: 0;
		border: 2px solid currentColor;
		border-block-start-color: transparent;
		border-radius: var(--radius-full);
		animation: icon-button-spin calc(var(--motion-page) * 2) linear infinite;
	}

	@keyframes icon-button-spin {
		to {
			transform: rotate(1turn);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.icon-button-spinner {
			animation: none;
			border-block-start-color: currentColor;
			opacity: 0.6;
		}
	}
</style>
