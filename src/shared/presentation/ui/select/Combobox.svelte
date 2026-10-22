<script lang="ts">
	import { tick } from 'svelte';
	import { Check, ChevronDown, CircleAlert } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface ComboboxOption {
		value: string;
		label: string;
	}

	interface Props {
		label: string;
		/** Selected option value, not the typed filter text. */
		value?: string;
		options: ComboboxOption[];
		placeholder?: string;
		hint?: string;
		error?: string;
		emptyMessage?: string;
		disabled?: boolean;
		id?: string;
		name?: string;
		onchange?: (value: string) => void;
		class?: string;
	}

	let {
		label,
		value = $bindable(''),
		options,
		placeholder,
		hint,
		error,
		emptyMessage = 'No matches',
		disabled = false,
		id,
		name,
		onchange,
		class: className
	}: Props = $props();

	const autoId = $props.id();
	const fieldId = $derived(id ?? autoId);
	const listId = $derived(`${fieldId}-listbox`);
	const hintId = $derived(`${fieldId}-hint`);
	const errorId = $derived(`${fieldId}-error`);

	const describedBy = $derived(
		[hint ? hintId : '', error ? errorId : ''].filter((part) => part !== '').join(' ') || undefined
	);

	let rootEl = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let open = $state(false);
	let typed = $state(false);
	let query = $state('');
	let activeIndex = $state(-1);

	const selected = $derived(options.find((option) => option.value === value) ?? null);
	const filtered = $derived(
		typed
			? options.filter((option) =>
					option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
				)
			: options
	);
	const displayValue = $derived(open && typed ? query : (selected?.label ?? ''));

	function optionId(index: number): string {
		return `${fieldId}-option-${index}`;
	}

	async function openList(): Promise<void> {
		if (disabled || open) return;
		open = true;
		typed = false;
		query = '';
		const selectedIndex = selected
			? options.findIndex((option) => option.value === selected.value)
			: -1;
		activeIndex = selectedIndex >= 0 ? selectedIndex : options.length > 0 ? 0 : -1;
		await tick();
		inputEl?.select();
	}

	function closeList(): void {
		open = false;
		typed = false;
		query = '';
		activeIndex = -1;
	}

	function selectOption(option: ComboboxOption): void {
		value = option.value;
		closeList();
		onchange?.(option.value);
		inputEl?.focus();
	}

	function moveActive(step: 1 | -1): void {
		const count = filtered.length;
		if (count === 0) {
			activeIndex = -1;
			return;
		}
		activeIndex = (activeIndex + step + count) % count;
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (disabled) return;

		switch (event.key) {
			case 'ArrowDown': {
				event.preventDefault();
				if (!open) {
					void openList();
					return;
				}
				moveActive(1);
				break;
			}
			case 'ArrowUp': {
				event.preventDefault();
				if (!open) {
					void openList();
					return;
				}
				moveActive(-1);
				break;
			}
			case 'Home': {
				if (!open) return;
				event.preventDefault();
				activeIndex = filtered.length > 0 ? 0 : -1;
				break;
			}
			case 'End': {
				if (!open) return;
				event.preventDefault();
				activeIndex = filtered.length > 0 ? filtered.length - 1 : -1;
				break;
			}
			case 'Enter': {
				const option = activeIndex >= 0 ? filtered[activeIndex] : undefined;
				if (open && option) {
					event.preventDefault();
					selectOption(option);
				}
				break;
			}
			case 'Escape': {
				if (!open) return;
				event.preventDefault();
				closeList();
				break;
			}
			case 'Tab': {
				closeList();
				break;
			}
			default:
				break;
		}
	}

	function handleBlur(event: FocusEvent): void {
		const next = event.relatedTarget;
		if (next instanceof Node && rootEl?.contains(next)) return;
		closeList();
	}

	$effect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent): void => {
			const target = event.target;
			if (target instanceof Node && rootEl?.contains(target)) return;
			closeList();
		};
		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	});

	$effect(() => {
		if (!open || activeIndex < 0) return;
		document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
	});

	$effect(() => {
		const count = filtered.length;
		if (activeIndex >= count) activeIndex = count - 1;
	});
</script>

<div class={cn('flex flex-col gap-2', className)}>
	<label for={fieldId} class="text-subheadline text-ink">
		{label}
	</label>

	<div bind:this={rootEl} class="relative">
		<input
			bind:this={inputEl}
			id={fieldId}
			{name}
			type="text"
			role="combobox"
			aria-expanded={open}
			aria-controls={open ? listId : undefined}
			aria-autocomplete="list"
			aria-haspopup="listbox"
			aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			{disabled}
			{placeholder}
			autocomplete="off"
			spellcheck="false"
			value={displayValue}
			oninput={(event) => {
				open = true;
				typed = true;
				query = event.currentTarget.value;
				activeIndex = filtered.length > 0 ? 0 : -1;
			}}
			onclick={() => {
				if (!open) void openList();
			}}
			onkeydown={handleKeydown}
			onblur={handleBlur}
			class={cn(
				'min-h-target w-full rounded-md border border-hairline-strong bg-canvas py-2 ps-3 pe-10 text-callout text-ink placeholder:text-ink-tertiary disabled:cursor-not-allowed disabled:bg-canvas-grouped disabled:text-ink-disabled',
				error && 'border-critical'
			)}
		/>

		<span class="pointer-events-none absolute inset-y-0 end-3 flex items-center text-ink-tertiary">
			<ChevronDown
				size={20}
				strokeWidth={1.75}
				aria-hidden="true"
				class={cn('combobox-chevron', open && 'combobox-chevron-open')}
			/>
		</span>

		{#if open}
			<div
				class="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-hairline bg-canvas p-1 shadow-e3"
			>
				<ul id={listId} role="listbox" aria-label={label} class="m-0 list-none p-0">
					{#each filtered as option, index (option.value)}
						<li
							id={optionId(index)}
							role="option"
							aria-selected={option.value === value}
							class={cn(
								'flex min-h-target cursor-pointer items-center justify-between gap-2 rounded-sm px-3 py-2 text-callout text-ink',
								index === activeIndex && 'bg-brand-soft'
							)}
							onmousedown={(event) => {
								event.preventDefault();
								selectOption(option);
							}}
							onpointermove={() => (activeIndex = index)}
						>
							<span>{option.label}</span>
							{#if option.value === value}
								<Check size={16} strokeWidth={1.75} aria-hidden="true" class="shrink-0" />
							{/if}
						</li>
					{:else}
						<li role="presentation" class="px-3 py-2 text-callout text-ink-secondary">
							{emptyMessage}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
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

<style>
	.combobox-chevron {
		transition: transform var(--motion-fast) var(--ease-standard);
	}

	.combobox-chevron-open {
		transform: rotate(180deg);
	}
</style>
