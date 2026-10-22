<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import { ChevronDown, CircleAlert } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface SelectOption {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props extends Omit<
		HTMLSelectAttributes,
		'value' | 'children' | 'class' | 'onchange' | 'size'
	> {
		label: string;
		value?: string;
		options: SelectOption[];
		/** Disabled empty option shown until a real choice is made. */
		placeholder?: string;
		hint?: string;
		error?: string;
		id?: string;
		name?: string;
		onchange?: (event: Event) => void;
		class?: string;
	}

	let {
		label,
		value = $bindable(''),
		options,
		placeholder,
		hint,
		error,
		id,
		name,
		required = false,
		disabled = false,
		onchange,
		class: className,
		...rest
	}: Props = $props();

	const autoId = $props.id();
	const fieldId = $derived(id ?? autoId);
	const hintId = $derived(`${fieldId}-hint`);
	const errorId = $derived(`${fieldId}-error`);

	const describedBy = $derived(
		[hint ? hintId : '', error ? errorId : ''].filter((part) => part !== '').join(' ') || undefined
	);
</script>

<div class={cn('flex flex-col gap-2', className)}>
	<label for={fieldId} class="text-subheadline text-ink">
		{label}{#if required}<span class="text-footnote text-ink-tertiary"> (required)</span>{/if}
	</label>

	<div class="relative">
		<select
			{...rest}
			id={fieldId}
			{name}
			{required}
			{disabled}
			{value}
			onchange={(event) => {
				value = event.currentTarget.value;
				onchange?.(event);
			}}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			class={cn(
				'min-h-target w-full appearance-none rounded-md border border-hairline-strong bg-canvas py-2 ps-3 pe-10 text-callout text-ink disabled:cursor-not-allowed disabled:bg-canvas-grouped disabled:text-ink-disabled',
				error && 'border-critical'
			)}
		>
			{#if placeholder}
				<option value="" disabled>{placeholder}</option>
			{/if}
			{#each options as option (option.value)}
				<option value={option.value} disabled={option.disabled}>{option.label}</option>
			{/each}
		</select>

		<span class="pointer-events-none absolute inset-y-0 end-3 flex items-center text-ink-tertiary">
			<ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" />
		</span>
	</div>

	{#if hint}
		<p id={hintId} class="text-footnote text-ink-secondary">{hint}</p>
	{/if}

	{#if error}
		<p id={errorId} class="flex items-start gap-1 text-footnote text-critical-ink">
			<CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" class="mt-1 shrink-0" />
			<span>{error}</span>
		</p>
	{/if}
</div>
