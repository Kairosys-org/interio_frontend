<script lang="ts">
	import { tick } from 'svelte';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface Tab {
		id: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		/** Accessible name for the tab list. */
		label: string;
		tabs: Tab[];
		/** Active tab id; defaults to the first enabled tab. */
		value?: string;
		children?: Snippet<[string]>;
		class?: string;
	}

	let { label, tabs, value = $bindable(''), children, class: className }: Props = $props();

	const baseId = $props.id();

	let tablistEl = $state<HTMLDivElement | null>(null);

	const activeValue = $derived(value || (tabs.find((tab) => !tab.disabled) ?? tabs[0])?.id || '');

	function select(tabId: string): void {
		value = tabId;
	}

	function focusTab(index: number): void {
		void tick().then(() => {
			const tabEl = tablistEl?.querySelector<HTMLButtonElement>(`[data-tab-index="${index}"]`);
			tabEl?.focus();
		});
	}

	function handleKeydown(event: KeyboardEvent): void {
		const enabled = tabs.map((tab, index) => ({ tab, index })).filter((item) => !item.tab.disabled);
		if (enabled.length === 0) return;

		const current = enabled.findIndex((item) => item.tab.id === activeValue);
		let nextIndex = current;

		switch (event.key) {
			case 'ArrowRight':
				nextIndex = (current + 1) % enabled.length;
				break;
			case 'ArrowLeft':
				nextIndex = (current - 1 + enabled.length) % enabled.length;
				break;
			case 'Home':
				nextIndex = 0;
				break;
			case 'End':
				nextIndex = enabled.length - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		const next = enabled[nextIndex];
		if (!next) return;
		select(next.tab.id);
		focusTab(next.index);
	}
</script>

<div class={cn('flex min-w-0 flex-col', className)}>
	<div
		bind:this={tablistEl}
		role="tablist"
		aria-label={label}
		class="flex gap-1 overflow-x-auto border-b border-hairline"
	>
		{#each tabs as tab, index (tab.id)}
			<button
				type="button"
				role="tab"
				id={`${baseId}-tab-${tab.id}`}
				data-tab-index={index}
				aria-selected={tab.id === activeValue}
				aria-controls={`${baseId}-panel-${tab.id}`}
				tabindex={tab.id === activeValue && !tab.disabled ? 0 : -1}
				disabled={tab.disabled}
				onclick={() => select(tab.id)}
				onkeydown={handleKeydown}
				class={cn(
					'-mb-px inline-flex min-h-target items-center gap-2 rounded-t-sm border-b-2 px-3 text-subheadline whitespace-nowrap',
					tab.id === activeValue
						? 'border-brand text-ink'
						: 'border-transparent text-ink-secondary enabled:hover:text-ink',
					tab.disabled && 'cursor-not-allowed text-ink-disabled'
				)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#each tabs as tab (tab.id)}
		<div
			role="tabpanel"
			id={`${baseId}-panel-${tab.id}`}
			aria-labelledby={`${baseId}-tab-${tab.id}`}
			tabindex="0"
			hidden={tab.id !== activeValue}
			class="pt-4"
		>
			{#if children}
				{@render children(tab.id)}
			{/if}
		</div>
	{/each}
</div>

<style>
	[role='tab'] {
		transition:
			color var(--motion-fast) var(--ease-standard),
			border-color var(--motion-fast) var(--ease-standard);
	}
</style>
