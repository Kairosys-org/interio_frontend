<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	/**
	 * Enhancement-only hint (DESIGN §9.3). Never the sole label for a control:
	 * the caller must give the child its own accessible name. The 44 px target
	 * belongs to the child.
	 */
	interface Props {
		content: string;
		delay?: number;
		children: Snippet;
		class?: string;
	}

	let { content, delay = 500, children, class: className }: Props = $props();

	const tooltipId = $props.id();
	let visible = $state(false);
	let wrapperEl = $state<HTMLSpanElement>();
	let timer: ReturnType<typeof setTimeout> | undefined;

	function clearTimer(): void {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	function show(): void {
		clearTimer();
		timer = setTimeout(() => {
			visible = true;
			timer = undefined;
		}, delay);
	}

	function hide(): void {
		clearTimer();
		visible = false;
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') hide();
	}

	$effect(() => {
		return () => clearTimer();
	});

	/**
	 * The wrapper is a passive proxy for the child control, so its listeners are
	 * attached directly instead of through static element handlers (which would
	 * require an interactive role the wrapper does not have).
	 */
	$effect(() => {
		const el = wrapperEl;
		if (!el) return;

		el.addEventListener('pointerenter', show);
		el.addEventListener('pointerleave', hide);
		el.addEventListener('focusin', show);
		el.addEventListener('focusout', hide);
		el.addEventListener('keydown', handleKeydown);

		return () => {
			el.removeEventListener('pointerenter', show);
			el.removeEventListener('pointerleave', hide);
			el.removeEventListener('focusin', show);
			el.removeEventListener('focusout', hide);
			el.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<span
	bind:this={wrapperEl}
	class={cn('relative inline-flex', className)}
	aria-describedby={visible ? tooltipId : undefined}
>
	{@render children()}

	{#if visible}
		<span
			id={tooltipId}
			role="tooltip"
			class="tooltip material rounded-md border border-hairline px-2 py-1 text-footnote text-ink shadow-e3"
		>
			{content}
		</span>
	{/if}
</span>

<style>
	.tooltip {
		position: absolute;
		z-index: 50;
		inset-block-end: calc(100% + var(--spacing-1));
		inset-inline-start: 50%;
		transform: translateX(-50%);
		inline-size: max-content;
		max-inline-size: var(--layout-content-reading);
		pointer-events: none;
		text-align: start;
	}
</style>
