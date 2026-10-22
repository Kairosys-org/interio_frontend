<script lang="ts">
	import type { HTMLTextareaAttributes, FullAutoFill } from 'svelte/elements';
	import { CircleAlert } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface Props extends Omit<
		HTMLTextareaAttributes,
		'value' | 'rows' | 'children' | 'class' | 'oninput' | 'onblur' | 'autocomplete' | 'enterkeyhint'
	> {
		label: string;
		value?: string;
		hint?: string;
		error?: string;
		id?: string;
		name?: string;
		placeholder?: string;
		autocomplete?: string;
		enterkeyhint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
		rows?: number;
		oninput?: (event: Event) => void;
		onblur?: (event: FocusEvent) => void;
		class?: string;
	}

	let {
		label,
		value = $bindable(''),
		hint,
		error,
		id,
		name,
		placeholder,
		autocomplete,
		enterkeyhint,
		rows = 4,
		required = false,
		disabled = false,
		readonly = false,
		oninput,
		onblur,
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

	<textarea
		{...rest}
		id={fieldId}
		{name}
		{placeholder}
		autocomplete={autocomplete as FullAutoFill | undefined}
		{enterkeyhint}
		{rows}
		{required}
		{disabled}
		{readonly}
		{value}
		oninput={(event) => {
			value = event.currentTarget.value;
			oninput?.(event);
		}}
		{onblur}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
		class={cn(
			'min-h-target w-full resize-y rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-callout text-ink placeholder:text-ink-tertiary read-only:bg-canvas-grouped disabled:cursor-not-allowed disabled:bg-canvas-grouped disabled:text-ink-disabled',
			error && 'border-critical'
		)}></textarea>

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
