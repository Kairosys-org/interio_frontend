<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		/** Visible and announced name for the bar. */
		label: string;
		/** 0–100. Ignored when `indeterminate`. */
		value?: number;
		indeterminate?: boolean;
		/** Human-readable value, e.g. "3 of 8 files". */
		valueLabel?: string;
		class?: string;
	}

	let { label, value = 0, indeterminate = false, valueLabel, class: className }: Props = $props();

	const baseId = $props.id();
	const labelId = $derived(`${baseId}-progress-label`);

	const clamped = $derived(Math.min(100, Math.max(0, value)));
	const valueText = $derived(
		valueLabel ?? (indeterminate ? undefined : `${Math.round(clamped)} %`)
	);
</script>

<div class={cn('flex flex-col gap-2', className)}>
	<div class="flex items-baseline justify-between gap-2">
		<span id={labelId} class="text-footnote text-ink-secondary">{label}</span>
		{#if valueText}
			<span class="text-footnote text-ink tabular-nums">{valueText}</span>
		{/if}
	</div>

	<div
		role="progressbar"
		aria-labelledby={labelId}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={indeterminate ? undefined : clamped}
		aria-valuetext={valueText}
		class="h-2 w-full overflow-hidden rounded-full bg-canvas-nested"
	>
		{#if indeterminate}
			<div class="progress-indeterminate h-full w-1/3 rounded-full bg-brand"></div>
		{:else}
			<div
				class="progress-bar h-full rounded-full bg-brand"
				style={`--progress: ${clamped}%`}
			></div>
		{/if}
	</div>
</div>

<style>
	.progress-bar {
		inline-size: var(--progress);
	}

	/* Indeterminate only moves when motion is welcome; otherwise it is a static mark. */
	@media (prefers-reduced-motion: no-preference) {
		.progress-indeterminate {
			animation: progress-slide calc(var(--motion-page) * 3) var(--ease-standard) infinite;
		}
	}

	@keyframes progress-slide {
		from {
			transform: translateX(-100%);
		}

		to {
			transform: translateX(300%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.progress-indeterminate {
			opacity: 0.6;
		}
	}
</style>
