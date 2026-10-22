<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { Check, Minus } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface Props extends Omit<
		HTMLInputAttributes,
		'type' | 'checked' | 'value' | 'children' | 'class' | 'onchange' | 'disabled'
	> {
		label: string;
		checked?: boolean;
		description?: string;
		disabled?: boolean;
		indeterminate?: boolean;
		name?: string;
		value?: string;
		onchange?: (event: Event) => void;
		class?: string;
	}

	let {
		label,
		checked = $bindable(false),
		description,
		disabled = false,
		indeterminate = false,
		name,
		value,
		onchange,
		class: className,
		...rest
	}: Props = $props();

	const autoId = $props.id();
	const fieldId = $derived(`${autoId}-checkbox`);
	const descriptionId = $derived(`${fieldId}-description`);

	let inputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (inputEl) inputEl.indeterminate = indeterminate;
	});
</script>

<div class={cn('flex flex-col', className)}>
	<label
		for={fieldId}
		class={cn(
			'flex min-h-target items-start gap-3 py-2',
			disabled ? 'cursor-not-allowed' : 'cursor-pointer'
		)}
	>
		<span class="relative mt-1 inline-flex size-5 shrink-0 items-center justify-center">
			<input
				{...rest}
				bind:this={inputEl}
				id={fieldId}
				type="checkbox"
				{name}
				{value}
				{disabled}
				{checked}
				onchange={(event) => {
					checked = event.currentTarget.checked;
					onchange?.(event);
				}}
				aria-describedby={description ? descriptionId : undefined}
				class={cn(
					'peer size-5 appearance-none rounded-sm border border-hairline-strong bg-canvas checked:border-brand checked:bg-brand indeterminate:border-brand indeterminate:bg-brand disabled:cursor-not-allowed disabled:opacity-60',
					disabled ? 'cursor-not-allowed' : 'cursor-pointer'
				)}
			/>
			{#if indeterminate}
				<Minus
					size={16}
					strokeWidth={1.75}
					aria-hidden="true"
					class="pointer-events-none absolute text-on-brand"
				/>
			{:else if checked}
				<Check
					size={16}
					strokeWidth={1.75}
					aria-hidden="true"
					class="pointer-events-none absolute text-on-brand"
				/>
			{/if}
		</span>

		<span class="flex flex-col gap-1">
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
	</label>
</div>
