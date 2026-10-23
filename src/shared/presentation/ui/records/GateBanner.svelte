<script lang="ts">
	import { CircleAlert, CircleCheck, TriangleAlert } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import Badge from '../feedback/Badge.svelte';

	type GateState = 'blocking' | 'warning' | 'passed';
	type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

	interface Gate {
		id: string;
		title: string;
		state: GateState;
		reasons: string[];
	}

	interface Props {
		gates: Gate[];
		fixHref?: string;
		fixLabel?: string;
		class?: string;
	}

	let { gates, fixHref, fixLabel = 'Fix this', class: className }: Props = $props();

	const SURFACE: Record<GateState, string> = {
		blocking: 'border-critical bg-critical-soft',
		warning: 'border-caution bg-caution-soft',
		passed: 'border-safe bg-safe-soft'
	};

	const INK: Record<GateState, string> = {
		blocking: 'text-critical-ink',
		warning: 'text-caution-ink',
		passed: 'text-safe-ink'
	};

	const BADGE_TONE: Record<GateState, BadgeTone> = {
		blocking: 'danger',
		warning: 'warning',
		passed: 'success'
	};

	/** Blocking outranks warning; every gate passed renders the success banner. */
	const activeGate = $derived(
		gates.find((gate) => gate.state === 'blocking') ??
			gates.find((gate) => gate.state === 'warning') ??
			null
	);

	const state = $derived<GateState>(activeGate?.state ?? 'passed');
	const passedAll = $derived(activeGate === null && gates.length > 0);

	/**
	 * Hrefs arrive already resolved by the caller (`resolve()` from
	 * `$app/paths`); spread the attributes so the primitive stays route-agnostic.
	 */
	const fixAttributes = $derived({ href: fixHref ?? '' });
</script>

{#if gates.length > 0}
	<section
		role={state === 'blocking' ? 'alert' : 'status'}
		tabindex="-1"
		class={cn('flex flex-col gap-3 rounded-lg border p-4', SURFACE[state], className)}
	>
		<div class="flex items-start gap-3">
			<span class={cn('mt-0.5 shrink-0', INK[state])} aria-hidden="true">
				{#if state === 'blocking'}
					<CircleAlert size={20} strokeWidth={1.75} />
				{:else if state === 'warning'}
					<TriangleAlert size={20} strokeWidth={1.75} />
				{:else}
					<CircleCheck size={20} strokeWidth={1.75} />
				{/if}
			</span>

			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<div class="flex flex-wrap items-center gap-2">
					<h2 class={cn('text-title-3', INK[state])}>
						{activeGate ? activeGate.title : 'All gates passed'}
					</h2>
					{#if activeGate}
						<Badge label={activeGate.id} tone={BADGE_TONE[state]} />
					{/if}
				</div>

				{#if activeGate && activeGate.reasons.length > 0}
					<ul class="flex list-disc flex-col gap-1 ps-5 text-callout text-ink">
						{#each activeGate.reasons as reason (reason)}
							<li>{reason}</li>
						{/each}
					</ul>
				{:else if passedAll}
					<div class="flex flex-col gap-2">
						<p class="text-callout text-ink">Nothing is blocking this step.</p>
						<ul class="flex list-none flex-wrap gap-2 p-0">
							{#each gates as gate (gate.id)}
								<li><Badge label={gate.id} tone={BADGE_TONE[gate.state]} /></li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if fixHref}
					<div>
						<a
							{...fixAttributes}
							class="inline-flex min-h-target items-center justify-center rounded-md border border-hairline-strong bg-canvas px-4 text-subheadline whitespace-nowrap text-ink hover:bg-canvas-grouped"
						>
							{fixLabel}
						</a>
					</div>
				{/if}
			</div>
		</div>
	</section>
{/if}
