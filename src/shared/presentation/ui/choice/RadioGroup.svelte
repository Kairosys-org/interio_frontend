<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface RadioOption {
		value: string;
		label: string;
		description?: string;
		disabled?: boolean;
	}

	interface Props {
		/** Legend text for the group. */
		label: string;
		value?: string;
		options: RadioOption[];
		orientation?: 'vertical' | 'horizontal';
		name?: string;
		hint?: string;
		error?: string;
		id?: string;
		onchange?: (event: Event) => void;
		class?: string;
	}

	let {
		label,
		value = $bindable(''),
		options,
		orientation = 'vertical',
		name,
		hint,
		error,
		id,
		onchange,
		class: className
	}: Props = $props();

	const autoId = $props.id();
	const fieldId = $derived(id ?? autoId);
	const groupName = $derived(name ?? fieldId);
	const hintId = $derived(`${fieldId}-hint`);
	const errorId = $derived(`${fieldId}-error`);

	const describedBy = $derived(
		[hint && !error ? hintId : '', error ? errorId : ''].filter((part) => part !== '').join(' ') ||
			undefined
	);
</script>

<fieldset
	class={cn('flex min-w-0 flex-col gap-2 border-0 p-0', className)}
	aria-describedby={describedBy}
>
	<legend class="p-0 text-subheadline text-ink">{label}</legend>

	<div
		class={cn(
			'flex gap-2',
			orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap items-start'
		)}
	>
		{#each options as option (option.value)}
			<label
				class={cn(
					'flex min-h-target items-start gap-3 py-2',
					option.disabled ? 'cursor-not-allowed' : 'cursor-pointer'
				)}
			>
				<span class="relative mt-1 inline-flex size-5 shrink-0 items-center justify-center">
					<input
						type="radio"
						name={groupName}
						value={option.value}
						checked={option.value === value}
						disabled={option.disabled}
						onchange={(event) => {
							value = event.currentTarget.value;
							onchange?.(event);
						}}
						class="peer size-5 cursor-pointer appearance-none rounded-full border border-hairline-strong bg-canvas checked:border-brand disabled:cursor-not-allowed disabled:opacity-60"
					/>
					<span
						class="pointer-events-none absolute size-2 rounded-full bg-brand opacity-0 peer-checked:opacity-100"
					></span>
				</span>

				<span class="flex flex-col gap-1">
					<span class={cn('text-callout', option.disabled ? 'text-ink-disabled' : 'text-ink')}>
						{option.label}
					</span>
					{#if option.description}
						<span
							class={cn(
								'text-footnote',
								option.disabled ? 'text-ink-disabled' : 'text-ink-secondary'
							)}
						>
							{option.description}
						</span>
					{/if}
				</span>
			</label>
		{/each}
	</div>

	{#if hint && !error}
		<p id={hintId} class="text-footnote text-ink-secondary">{hint}</p>
	{/if}

	{#if error}
		<p id={errorId} class="flex items-start gap-1 text-footnote text-critical-ink">
			<CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" class="mt-1 shrink-0" />
			<span>{error}</span>
		</p>
	{/if}
</fieldset>
