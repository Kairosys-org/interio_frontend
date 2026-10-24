<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import Button from '../button/Button.svelte';

	/**
	 * Monospace expression / JSON editor (DESIGN §4.1, §12.5; phase-3 §6).
	 *
	 * The editor only displays text and reports changes. Parsing, formatting and
	 * validation belong to the page or domain layer — nothing here is evaluated,
	 * so a rule expression can never run in the browser.
	 */
	interface Props {
		label: string;
		value: string;
		onchange: (value: string) => void;
		hint?: string;
		error?: string | null;
		/** One-based line number the last validation error refers to. */
		errorLine?: number | null;
		rows?: number;
		disabled?: boolean;
		onformat?: () => void;
		formatLabel?: string;
		class?: string;
	}

	let {
		label,
		value,
		onchange,
		hint,
		error = null,
		errorLine = null,
		rows = 10,
		disabled = false,
		onformat,
		formatLabel = 'Format JSON',
		class: className
	}: Props = $props();

	const uid = $props.id();
	const fieldId = `${uid}-editor`;
	const hintId = `${fieldId}-hint`;
	const errorId = `${fieldId}-error`;
	const countId = `${fieldId}-count`;

	const lineNumbers = $derived(
		Array.from({ length: value.split('\n').length }, (_, index) => index + 1)
	);
	const lineCount = $derived(lineNumbers.length);
	const countLabel = $derived(`${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`);

	const errorText = $derived(
		error ? `${error}${errorLine === null ? '' : ` (line ${errorLine})`}` : null
	);

	const describedBy = $derived(
		[countId, hint && !error ? hintId : '', error ? errorId : '']
			.filter((part) => part !== '')
			.join(' ')
	);

	let gutterEl = $state<HTMLDivElement | null>(null);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	/** Keep the line-number gutter aligned while only the textarea scrolls. */
	function syncScroll(): void {
		if (gutterEl && textareaEl) gutterEl.scrollTop = textareaEl.scrollTop;
	}
</script>

<div class={cn('flex min-w-0 flex-col gap-2', className)}>
	<div class="flex flex-wrap items-center justify-between gap-2">
		<label for={fieldId} class="text-subheadline text-ink">{label}</label>

		{#if onformat}
			<Button variant="tertiary" onclick={onformat} {disabled}>{formatLabel}</Button>
		{/if}
	</div>

	<div class="flex min-w-0 items-stretch">
		<div
			bind:this={gutterEl}
			aria-hidden="true"
			class={cn(
				'line-gutter shrink-0 overflow-hidden rounded-s-md border border-e-0 bg-canvas-grouped py-2 ps-3 pe-2 text-end font-mono text-callout whitespace-pre text-ink-tertiary',
				disabled && 'text-ink-disabled',
				error && 'border-critical'
			)}
		>
			{#each lineNumbers as lineNumber (lineNumber)}
				<div>{lineNumber}</div>
			{/each}
		</div>

		<textarea
			bind:this={textareaEl}
			id={fieldId}
			{rows}
			{disabled}
			spellcheck="false"
			autocomplete="off"
			wrap="off"
			{value}
			oninput={(event) => onchange(event.currentTarget.value)}
			onscroll={syncScroll}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			class={cn(
				'min-h-target w-full min-w-0 resize-y overflow-y-auto rounded-e-md border border-s-0 bg-canvas px-3 py-2 font-mono text-callout text-ink placeholder:text-ink-tertiary disabled:cursor-not-allowed disabled:bg-canvas-grouped disabled:text-ink-disabled',
				error && 'border-critical'
			)}></textarea>
	</div>

	<p id={countId} class="text-footnote text-ink-tertiary tabular-nums">{countLabel}</p>

	{#if hint && !error}
		<p id={hintId} class="text-footnote text-ink-secondary">{hint}</p>
	{/if}

	{#if errorText}
		<p id={errorId} role="alert" class="flex items-start gap-1 text-footnote text-critical-ink">
			<CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" class="mt-1 shrink-0" />
			<span>{errorText}</span>
		</p>
	{/if}
</div>
