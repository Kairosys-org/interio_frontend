<script lang="ts">
	import { mode } from 'mode-watcher';
	import { Toaster as SonnerToaster } from 'svelte-sonner';
	import { cn } from '$lib/utils';

	/**
	 * Design-system wrapper around `svelte-sonner` (DESIGN §9.3).
	 *
	 * Toasts confirm; they never carry an error that needs action (those stay
	 * inline). One action per toast is the caller's rule.
	 */
	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();

	const theme = $derived<'light' | 'dark'>(mode.current === 'dark' ? 'dark' : 'light');
</script>

<SonnerToaster
	class={cn('toaster-surface', className)}
	{theme}
	position="top-right"
	duration={4000}
	closeButton={false}
	gap={8}
	offset={24}
	mobileOffset={16}
	containerAriaLabel="Notifications"
	toastOptions={{
		class: 'interio-toast',
		duration: 4000,
		descriptionClass: 'text-ink-secondary'
	}}
/>

<style>
	/* Phones: bottom-centre, never wider than the viewport. */
	@media (width < 48rem) {
		:global(.toaster-surface[data-y-position='top'][data-x-position='right']) {
			inset-block-start: auto;
			inset-block-end: var(--mobile-offset-bottom);
			inset-inline-start: 50%;
			inset-inline-end: auto;
			transform: translateX(-50%);
			width: calc(100dvw - var(--mobile-offset-left) - var(--mobile-offset-right));
			max-width: var(--width);
		}
	}

	/* Solid token surface: sonner's own defaults use hsl values we must override. */
	:global(ol.toaster-surface .interio-toast[data-styled='true']) {
		padding: var(--spacing-4);
		border: 1px solid var(--color-separator);
		border-radius: var(--radius-md);
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-3);
		font-family: var(--font-sans);
		font-size: var(--text-callout);
	}

	:global(ol.toaster-surface .interio-toast[data-styled='true'] [data-title]) {
		color: var(--color-text-primary);
		font-size: var(--text-callout);
		font-weight: 500;
	}

	:global(ol.toaster-surface .interio-toast [data-description]) {
		color: var(--color-text-secondary);
		font-size: var(--text-footnote);
	}

	:global(ol.toaster-surface .interio-toast [data-button]) {
		min-height: var(--layout-target-min);
		border: 0;
		background: transparent;
		color: var(--color-accent);
		font-family: var(--font-sans);
		font-size: var(--text-footnote);
		font-weight: 500;
	}

	:global(ol.toaster-surface .interio-toast [data-button]:hover) {
		color: var(--color-accent-hover);
	}
</style>
