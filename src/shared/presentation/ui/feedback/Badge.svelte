<script lang="ts">
	import { cn } from '$lib/utils';

	/**
	 * Read-only count or category pill (DESIGN §9.3). Never interactive — an
	 * interactive filter pill is a 44 px button, not a Badge.
	 */
	interface Props {
		label: string;
		tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
		class?: string;
	}

	let { label, tone = 'neutral', class: className }: Props = $props();

	const TONE_CLASSES: Record<NonNullable<Props['tone']>, string> = {
		neutral: 'bg-chip-neutral text-chip-neutral-ink',
		info: 'bg-notice-soft text-notice-ink',
		success: 'bg-safe-soft text-safe-ink',
		warning: 'bg-caution-soft text-caution-ink',
		danger: 'bg-critical-soft text-critical-ink'
	};
</script>

<span
	class={cn(
		'inline-flex items-center rounded-full px-2 py-1 text-caption',
		TONE_CLASSES[tone],
		className
	)}
>
	{label}
</span>
