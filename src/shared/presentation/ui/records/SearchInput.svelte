<script lang="ts">
	import { Search, X } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import IconButton from '../button/IconButton.svelte';

	/**
	 * Debounced list search (architecture §5). URL state stays with the page:
	 * this component only reports the settled query through `onsearch`.
	 */
	interface Props {
		label: string;
		value?: string;
		placeholder?: string;
		onsearch?: (value: string) => void;
		debounceMs?: number;
		class?: string;
	}

	let {
		label,
		value = $bindable(''),
		placeholder,
		onsearch,
		debounceMs = 250,
		class: className
	}: Props = $props();

	const inputId = $props.id();
	let inputEl = $state<HTMLInputElement | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;
	/** The first run mirrors the initial value; the page already loaded that query. */
	let skipNextRun = true;
	/** The clear button already searched; do not schedule a second call. */
	let ignoreNextChange = false;

	function cancelTimer(): void {
		if (timer === null) return;
		clearTimeout(timer);
		timer = null;
	}

	function searchNow(next: string): void {
		cancelTimer();
		onsearch?.(next);
	}

	$effect(() => {
		const next = value;

		if (skipNextRun) {
			skipNextRun = false;
			return;
		}

		if (ignoreNextChange) {
			ignoreNextChange = false;
			return;
		}

		cancelTimer();

		if (debounceMs <= 0) {
			onsearch?.(next);
			return;
		}

		timer = setTimeout(() => {
			timer = null;
			onsearch?.(next);
		}, debounceMs);
	});

	// Destroy cleanup: a pending search must never fire after the field is gone.
	$effect(() => () => cancelTimer());

	function handleInput(event: Event): void {
		value = (event.currentTarget as HTMLInputElement).value;
	}

	function handleClear(): void {
		if (value === '') return;
		ignoreNextChange = true;
		value = '';
		searchNow('');
		inputEl?.focus();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		searchNow(value);
	}
</script>

<div class={cn('flex items-center', className)}>
	<label for={inputId} class="sr-only">{label}</label>

	<div class="relative flex w-full items-center">
		<span
			class="pointer-events-none absolute start-3 flex items-center text-ink-tertiary"
			aria-hidden="true"
		>
			<Search size={20} strokeWidth={1.75} />
		</span>

		<input
			bind:this={inputEl}
			id={inputId}
			type="search"
			{value}
			{placeholder}
			aria-label={label}
			autocomplete="off"
			enterkeyhint="search"
			oninput={handleInput}
			onkeydown={handleKeydown}
			class={cn(
				'search-input min-h-target w-full rounded-md border border-hairline-strong bg-canvas py-2 ps-10 text-callout text-ink placeholder:text-ink-tertiary',
				value === '' ? 'pe-3' : 'pe-12'
			)}
		/>

		{#if value !== ''}
			<IconButton
				label="Clear search"
				onclick={handleClear}
				class="absolute end-1 top-1/2 -translate-y-1/2"
			>
				{#snippet icon()}
					<X size={20} strokeWidth={1.75} aria-hidden="true" />
				{/snippet}
			</IconButton>
		{/if}
	</div>
</div>

<style>
	/* One clear affordance (the labelled button), not two. */
	.search-input::-webkit-search-cancel-button,
	.search-input::-webkit-search-decoration {
		appearance: none;
	}
</style>
