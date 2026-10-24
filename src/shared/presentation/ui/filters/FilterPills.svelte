<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import { formatCount } from '$shared/lib/format';

	/**
	 * Single-select filter row (DESIGN §9.3 "Badge / Pill", §3.5 selection).
	 *
	 * The chips are buttons: every target is at least 44 × 44 px, the selected
	 * state carries `aria-pressed` plus a check icon (never colour alone), and
	 * the row wraps instead of forcing page-level horizontal scroll.
	 */
	interface FilterOption {
		value: string;
		label: string;
		count?: number;
	}

	interface Props {
		/** Visible group label, e.g. "Cabinet family". */
		label: string;
		options: FilterOption[];
		value: string;
		onchange: (value: string) => void;
		class?: string;
	}

	let { label, options, value, onchange, class: className }: Props = $props();
</script>

<fieldset class={cn('flex min-w-0 flex-col gap-2 border-0 p-0', className)}>
	<legend class="p-0 text-subheadline text-ink">{label}</legend>

	<div class="flex min-w-0 flex-wrap items-center gap-2">
		{#each options as option (option.value)}
			{@const selected = option.value === value}
			<button
				type="button"
				aria-pressed={selected ? 'true' : 'false'}
				onclick={() => onchange(option.value)}
				class={cn(
					'inline-flex min-h-target max-w-full min-w-target touch-manipulation items-center gap-2 rounded-full border px-4 text-start text-callout',
					selected
						? 'border-brand bg-brand-soft text-ink'
						: 'border-hairline-strong bg-canvas text-ink-secondary enabled:hover:bg-canvas-grouped enabled:hover:text-ink'
				)}
			>
				{#if selected}
					<Check size={16} strokeWidth={2} aria-hidden="true" class="shrink-0 text-brand" />
				{/if}

				<span class="min-w-0 break-words">{option.label}</span>

				{#if option.count !== undefined}
					<span
						class={cn(
							'shrink-0 tabular-nums',
							selected ? 'text-ink-secondary' : 'text-ink-tertiary'
						)}
					>
						{formatCount(option.count)}
					</span>
				{/if}
			</button>
		{/each}
	</div>
</fieldset>
