<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		label: string;
		checked?: boolean;
		description?: string;
		disabled?: boolean;
		id?: string;
		onchange?: (event: Event) => void;
		class?: string;
	}

	let {
		label,
		checked = $bindable(false),
		description,
		disabled = false,
		id,
		onchange,
		class: className
	}: Props = $props();

	const autoId = $props.id();
	const fieldId = $derived(id ?? autoId);
	const descriptionId = $derived(`${fieldId}-description`);

	function toggle(event: MouseEvent): void {
		if (disabled) return;
		checked = !checked;
		onchange?.(event);
	}
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-describedby={description ? descriptionId : undefined}
	{disabled}
	onclick={toggle}
	class={cn(
		'switch flex min-h-target w-full touch-manipulation items-center justify-between gap-3 rounded-md py-2 text-start select-none disabled:cursor-not-allowed',
		className
	)}
>
	<span class="flex min-w-0 flex-col gap-1">
		<span class={cn('text-callout', disabled ? 'text-ink-disabled' : 'text-ink')}>{label}</span>
		{#if description}
			<span
				id={descriptionId}
				class={cn('text-footnote', disabled ? 'text-ink-disabled' : 'text-ink-secondary')}
			>
				{description}
			</span>
		{/if}
	</span>

	<span
		class={cn(
			'switch-track inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1',
			disabled ? 'bg-canvas-nested' : checked ? 'bg-brand' : 'bg-hairline-strong'
		)}
		aria-hidden="true"
	>
		<span
			class={cn(
				'switch-thumb size-4 rounded-full shadow-e1',
				disabled ? 'bg-canvas-grouped' : 'bg-canvas',
				checked && 'translate-x-5'
			)}
		></span>
	</span>
</button>

<style>
	.switch-track {
		transition: background-color var(--motion-fast) var(--ease-standard);
	}

	.switch-thumb {
		transition: transform var(--motion-fast) var(--ease-standard);
	}

	/* Position still updates; only the animated travel is removed. */
	@media (prefers-reduced-motion: reduce) {
		.switch-thumb {
			transition: none;
		}
	}
</style>
