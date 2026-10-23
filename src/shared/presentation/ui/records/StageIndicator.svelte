<script lang="ts">
	import { Check, CircleAlert, TriangleAlert } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import Badge from '../feedback/Badge.svelte';

	type StageState = 'passed' | 'current' | 'future' | 'blocking' | 'warning';
	type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

	interface Stage {
		id: string;
		label: string;
		gateId: string | null;
		state: StageState;
	}

	interface Props {
		stages: Stage[];
		compact?: boolean;
		class?: string;
	}

	let { stages, compact = false, class: className }: Props = $props();

	const STATE_LABELS: Record<StageState, string> = {
		passed: 'Passed',
		current: 'Current',
		future: 'Upcoming',
		blocking: 'Blocked',
		warning: 'Warning'
	};

	const BADGE_TONES: Record<StageState, BadgeTone> = {
		passed: 'success',
		current: 'info',
		future: 'neutral',
		blocking: 'danger',
		warning: 'warning'
	};

	const ITEM_CLASSES: Record<StageState, string> = {
		passed: 'border-hairline bg-canvas',
		current: 'border-brand bg-brand-soft',
		future: 'border-hairline bg-canvas',
		blocking: 'border-critical bg-critical-soft',
		warning: 'border-caution bg-caution-soft'
	};

	const NUMBER_CLASSES: Record<StageState, string> = {
		passed: 'border-safe bg-safe-soft text-safe-ink',
		current: 'border-brand bg-brand text-on-brand',
		future: 'border-hairline-strong bg-canvas text-ink-secondary',
		blocking: 'border-critical bg-critical text-on-brand',
		warning: 'border-caution bg-caution text-on-brand'
	};

	const STATE_TEXT_CLASSES: Record<StageState, string> = {
		passed: 'text-safe-ink',
		current: 'text-brand',
		future: 'text-ink-tertiary',
		blocking: 'text-critical-ink',
		warning: 'text-caution-ink'
	};

	/** Compact shows the current stage and its immediate neighbours (DESIGN §9.2). */
	const visibleStages = $derived.by(() => {
		const numbered = stages.map((stage, index) => ({ stage, number: index + 1 }));
		if (!compact) return numbered;

		const currentIndex = stages.findIndex((stage) => stage.state === 'current');
		if (currentIndex === -1) return numbered;

		const start = Math.max(0, currentIndex - 1);
		const end = Math.min(stages.length, currentIndex + 2);
		return numbered.slice(start, end);
	});
</script>

<ol
	aria-label="Project stages"
	class={cn('flex list-none flex-row gap-2 overflow-x-auto p-0', className)}
>
	{#each visibleStages as { stage, number } (stage.id)}
		<li
			aria-current={stage.state === 'current' ? 'step' : undefined}
			aria-label={`Stage ${number} of ${stages.length}: ${stage.label}, ${STATE_LABELS[stage.state]}`}
			class={cn(
				'flex min-w-max shrink-0 flex-col justify-between gap-2 rounded-md border p-3 md:min-w-0 md:flex-1 md:shrink',
				ITEM_CLASSES[stage.state]
			)}
		>
			<div class="flex items-start gap-2">
				<span
					class={cn(
						'flex size-6 shrink-0 items-center justify-center rounded-full border text-caption',
						NUMBER_CLASSES[stage.state]
					)}
					aria-hidden="true"
				>
					{number}
				</span>
				<span class="min-w-0 text-callout break-words text-ink">{stage.label}</span>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				{#if stage.gateId}
					<Badge label={stage.gateId} tone={BADGE_TONES[stage.state]} />
				{/if}

				<span
					class={cn('inline-flex items-center gap-1 text-caption', STATE_TEXT_CLASSES[stage.state])}
				>
					{#if stage.state === 'passed'}
						<Check size={14} strokeWidth={2} aria-hidden="true" />
					{:else if stage.state === 'blocking'}
						<CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
					{:else if stage.state === 'warning'}
						<TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
					{/if}
					{STATE_LABELS[stage.state]}
				</span>
			</div>
		</li>
	{/each}
</ol>
