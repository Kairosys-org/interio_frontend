<script lang="ts">
	import { stateCategory, stateLabel, type StateCategory } from '$shared/lib/status';
	import { cn } from '$lib/utils';

	/**
	 * Canonical workflow state (DESIGN §9.2 + Appendix B). The label is always
	 * present; colour is never the only carrier of meaning. Not interactive.
	 */
	interface Props {
		entity: string;
		state: string;
		label?: string;
		class?: string;
	}

	let { entity, state, label, class: className }: Props = $props();

	const CATEGORY_CLASSES: Record<StateCategory, { chip: string; dot: string }> = {
		neutral: { chip: 'bg-chip-neutral text-chip-neutral-ink', dot: 'bg-ink-tertiary' },
		info: { chip: 'bg-notice-soft text-notice-ink', dot: 'bg-notice' },
		warning: { chip: 'bg-caution-soft text-caution-ink', dot: 'bg-caution' },
		success: { chip: 'bg-safe-soft text-safe-ink', dot: 'bg-safe' },
		danger: { chip: 'bg-critical-soft text-critical-ink', dot: 'bg-critical' },
		muted: { chip: 'bg-canvas-nested text-ink-tertiary', dot: 'bg-ink-disabled' }
	};

	const category = $derived(stateCategory(entity, state));
	const text = $derived(label ?? stateLabel(state));
	const tone = $derived(CATEGORY_CLASSES[category]);
</script>

<span
	class={cn(
		'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 text-caption',
		tone.chip,
		className
	)}
	title={`${entity}.${state}`}
>
	<span class={cn('size-1.5 shrink-0 rounded-full', tone.dot)} aria-hidden="true"></span>
	{text}
</span>
