<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'ghost';

	interface Props extends Omit<
		HTMLButtonAttributes,
		'type' | 'children' | 'onclick' | 'disabled' | 'class'
	> {
		/** Visual weight. One `primary` action per screen (DESIGN §3.5). */
		variant?: Variant;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		/** Announced and shown while `loading` keeps the button width stable. */
		loadingLabel?: string;
		fullWidth?: boolean;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
		/** Decorative icon rendered before the label (16–20 px, `aria-hidden`). */
		icon?: Snippet;
		class?: string;
	}

	let {
		variant = 'secondary',
		type = 'button',
		disabled = false,
		loading = false,
		loadingLabel = 'Working…',
		fullWidth = false,
		onclick,
		children,
		icon,
		class: className,
		...rest
	}: Props = $props();

	const VARIANTS: Record<Variant, string> = {
		primary:
			'bg-brand text-on-brand enabled:hover:bg-brand-hover disabled:bg-canvas-nested disabled:text-ink-disabled',
		secondary:
			'border border-hairline-strong bg-canvas text-ink enabled:hover:bg-canvas-grouped disabled:border-hairline disabled:bg-canvas-grouped',
		tertiary: 'text-brand enabled:hover:text-brand-hover disabled:bg-transparent',
		destructive:
			'border border-critical bg-critical-soft text-critical-ink enabled:hover:bg-critical enabled:hover:text-on-brand disabled:border-hairline disabled:bg-canvas-grouped',
		ghost: 'text-ink enabled:hover:bg-canvas-grouped disabled:bg-transparent'
	};

	const isDisabled = $derived(disabled || loading);
</script>

<button
	{...rest}
	{type}
	disabled={isDisabled}
	aria-busy={loading ? 'true' : undefined}
	{onclick}
	class={cn(
		'btn inline-flex min-h-target min-w-target touch-manipulation items-center justify-center gap-2 rounded-md px-4 text-subheadline whitespace-nowrap select-none disabled:cursor-not-allowed disabled:text-ink-disabled',
		VARIANTS[variant],
		fullWidth && 'w-full',
		className
	)}
>
	{#if loading}
		<span class="btn-spinner" aria-hidden="true"></span>
		<span>{loadingLabel}</span>
	{:else}
		{#if icon}
			<span class="inline-flex shrink-0 items-center justify-center">
				{@render icon()}
			</span>
		{/if}
		<span>{@render children()}</span>
	{/if}
</button>

<style>
	.btn {
		transition:
			background-color var(--motion-fast) var(--ease-standard),
			border-color var(--motion-fast) var(--ease-standard),
			color var(--motion-fast) var(--ease-standard),
			transform var(--motion-press) var(--ease-standard);
	}

	/* Press feedback only where motion is welcome; release follows the pointer-up. */
	@media (prefers-reduced-motion: no-preference) {
		.btn:not(:disabled):active {
			transform: scale(0.97);
		}
	}

	.btn-spinner {
		inline-size: var(--spacing-4);
		block-size: var(--spacing-4);
		flex-shrink: 0;
		border: 2px solid currentColor;
		border-block-start-color: transparent;
		border-radius: var(--radius-full);
		animation: btn-spin calc(var(--motion-page) * 2) linear infinite;
	}

	@keyframes btn-spin {
		to {
			transform: rotate(1turn);
		}
	}

	/* Reduced motion: the label ("Working…") carries the state, the ring stays static. */
	@media (prefers-reduced-motion: reduce) {
		.btn-spinner {
			animation: none;
			border-block-start-color: currentColor;
			opacity: 0.6;
		}
	}
</style>
