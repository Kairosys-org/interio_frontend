<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface Step {
		id: string;
		label: string;
		description?: string;
	}

	interface Props {
		steps: Step[];
		current: number;
		onstep?: (index: number) => void;
		class?: string;
	}

	let { steps, current, onstep, class: className }: Props = $props();

	function cardClasses(index: number): string {
		return cn(
			'flex min-h-target w-full items-start gap-3 rounded-md border p-3 text-left',
			index === current ? 'border-brand bg-brand-soft' : 'border-hairline bg-canvas',
			onstep && index !== current && 'hover:bg-canvas-grouped'
		);
	}

	function numberClasses(index: number): string {
		return cn(
			'flex size-6 shrink-0 items-center justify-center rounded-full border text-caption',
			index < current
				? 'border-safe bg-safe-soft text-safe-ink'
				: index === current
					? 'border-brand bg-brand text-on-brand'
					: 'border-hairline-strong bg-canvas text-ink-secondary'
		);
	}
</script>

{#snippet stepContent(step: Step, index: number)}
	<span class={numberClasses(index)} aria-hidden="true">{index + 1}</span>
	<span class="flex min-w-0 flex-col gap-1">
		<span class="text-callout break-words text-ink">{step.label}</span>
		{#if step.description}
			<span class="text-footnote text-ink-secondary">{step.description}</span>
		{/if}
		{#if index < current}
			<span class="inline-flex items-center gap-1 text-caption text-safe-ink">
				<Check size={12} strokeWidth={2} aria-hidden="true" />
				Completed
			</span>
		{:else if index === current}
			<span class="text-caption text-brand">Current</span>
		{/if}
	</span>
{/snippet}

<ol class={cn('flex list-none flex-col gap-2 p-0 md:flex-row md:items-stretch', className)}>
	{#each steps as step, index (step.id)}
		<li class="min-w-0 md:flex-1" aria-current={index === current ? 'step' : undefined}>
			{#if onstep}
				<button type="button" onclick={() => onstep?.(index)} class={cardClasses(index)}>
					{@render stepContent(step, index)}
				</button>
			{:else}
				<div class={cardClasses(index)}>
					{@render stepContent(step, index)}
				</div>
			{/if}
		</li>
	{/each}
</ol>
