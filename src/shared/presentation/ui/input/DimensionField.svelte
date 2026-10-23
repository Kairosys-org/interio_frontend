<script lang="ts">
	import { CircleAlert, Ruler, ShieldAlert, ShieldCheck } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import { formatDimension } from '$shared/lib/format';
	import Badge from '../feedback/Badge.svelte';

	/**
	 * Millimetre capture (DESIGN §9.2 + §4.3, spec Part 9 §10).
	 *
	 * Value is an integer millimetre string because it comes from a form
	 * control; an empty string means "not captured yet" and is never coerced to
	 * zero. The range hint is advisory — the server owns the hard rule — but a
	 * reading outside it is announced before submit. The critical flag and the
	 * verification state are always text, never colour alone.
	 */
	interface Props {
		label: string;
		value?: string;
		hint?: string;
		error?: string;
		/** Inclusive advisory bounds, rendered as a range hint. */
		min?: number;
		max?: number;
		critical?: boolean;
		verified?: boolean;
		/** How it was verified, e.g. "laser" or "second person". */
		verificationMethod?: string | null;
		id?: string;
		name?: string;
		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		placeholder?: string;
		oninput?: (event: Event) => void;
		onblur?: (event: FocusEvent) => void;
		class?: string;
	}

	let {
		label,
		value = $bindable(''),
		hint,
		error,
		min,
		max,
		critical = false,
		verified = false,
		verificationMethod = null,
		id,
		name,
		required = false,
		disabled = false,
		readonly = false,
		placeholder,
		oninput,
		onblur,
		class: className
	}: Props = $props();

	const autoId = $props.id();
	const fieldId = $derived(id ?? autoId);
	const hintId = $derived(`${fieldId}-hint`);
	const warningId = $derived(`${fieldId}-range`);
	const errorId = $derived(`${fieldId}-error`);

	const numeric = $derived(value.trim() === '' ? null : Number(value));
	const measurable = $derived(numeric !== null && Number.isFinite(numeric));
	const outOfRange = $derived(
		measurable &&
			((min !== undefined && (numeric as number) < min) ||
				(max !== undefined && (numeric as number) > max))
	);

	const rangeHint = $derived.by(() => {
		if (min !== undefined && max !== undefined) {
			return `Usually ${formatDimension(min)} to ${formatDimension(max)}.`;
		}
		if (min !== undefined) return `Usually ${formatDimension(min)} or more.`;
		if (max !== undefined) return `Usually ${formatDimension(max)} or less.`;
		return hint;
	});

	const describedBy = $derived(
		[rangeHint && !error ? hintId : '', error ? errorId : '', outOfRange && !error ? warningId : '']
			.filter((part) => part !== '')
			.join(' ') || undefined
	);
</script>

<div class={cn('flex flex-col gap-2', className)}>
	<div class="flex flex-wrap items-center justify-between gap-2">
		<label for={fieldId} class="text-subheadline text-ink">
			{label}{#if required}<span class="text-footnote text-ink-tertiary">&nbsp;(required)</span
				>{/if}
		</label>

		{#if critical}
			<Badge label="Manufacturing-critical" tone={verified ? 'success' : 'warning'} />
		{/if}
	</div>

	<div class="relative">
		<input
			id={fieldId}
			{name}
			type="text"
			inputmode="numeric"
			pattern="[0-9]*"
			enterkeyhint="next"
			autocomplete="off"
			{placeholder}
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
				'min-h-target w-full rounded-md border border-hairline-strong bg-canvas py-2 ps-3 pe-12 text-callout text-ink tabular-nums placeholder:text-ink-tertiary read-only:bg-canvas-grouped disabled:cursor-not-allowed disabled:bg-canvas-grouped disabled:text-ink-disabled',
				error && 'border-critical'
			)}
		/>
		<span
			class="pointer-events-none absolute inset-y-0 end-3 flex items-center gap-1 text-footnote text-ink-tertiary"
			aria-hidden="true"
		>
			<Ruler size={16} strokeWidth={1.75} />
			mm
		</span>
	</div>

	{#if critical}
		<p
			class={cn(
				'flex items-center gap-1 text-footnote',
				verified ? 'text-safe-ink' : 'text-caution-ink'
			)}
		>
			{#if verified}
				<ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
				Verified{verificationMethod ? ` with ${verificationMethod}` : ''}.
			{:else}
				<ShieldAlert size={16} strokeWidth={1.75} aria-hidden="true" />
				Verification is required before the survey can be verified.
			{/if}
		</p>
	{/if}

	{#if rangeHint && !error}
		<p id={hintId} class="text-footnote text-ink-secondary">{rangeHint}</p>
	{/if}

	{#if outOfRange && !error}
		<p id={warningId} class="flex items-start gap-1 text-footnote text-caution-ink">
			<CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" class="mt-1 shrink-0" />
			<span>This reading is outside the usual range. Check it before saving.</span>
		</p>
	{/if}

	{#if error}
		<p id={errorId} class="flex items-start gap-1 text-footnote text-critical-ink">
			<CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" class="mt-1 shrink-0" />
			<span>{error}</span>
		</p>
	{/if}
</div>
