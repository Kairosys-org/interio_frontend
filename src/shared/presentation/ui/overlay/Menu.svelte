<script lang="ts">
	import { Ellipsis } from '@lucide/svelte';
	import type { Component, Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { cn } from '$lib/utils';
	import IconButton from '../button/IconButton.svelte';

	/**
	 * Secondary-actions menu (DESIGN §9.3). Callers keep it to ~8 items; the
	 * component does not paginate or virtualise.
	 *
	 * `MoreHorizontal` was renamed to `Ellipsis` in @lucide/svelte v1, which is
	 * the icon used for the default trigger.
	 */
	interface MenuItem {
		label: string;
		onSelect: () => void;
		icon?: Component;
		disabled?: boolean;
		danger?: boolean;
	}

	interface Props {
		label: string;
		items: MenuItem[];
		align?: 'start' | 'end';
		trigger?: Snippet;
		class?: string;
	}

	let { label, items, align = 'end', trigger, class: className }: Props = $props();

	const menuId = $props.id();
	let open = $state(false);
	let wrapperEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let panelEl = $state<HTMLDivElement | null>(null);

	function getItems(): HTMLButtonElement[] {
		const panel = panelEl;
		if (!panel) return [];
		return Array.from(
			panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])')
		);
	}

	function focusItem(index: number): void {
		const menuItems = getItems();
		if (menuItems.length === 0) return;
		const bounded = (index + menuItems.length) % menuItems.length;
		menuItems[bounded]?.focus();
	}

	function toggle(): void {
		open = !open;
	}

	/** The custom trigger is bound directly; the default IconButton is found in the wrapper. */
	function focusTrigger(): void {
		if (triggerEl) {
			triggerEl.focus();
			return;
		}
		wrapperEl?.querySelector<HTMLButtonElement>('button')?.focus();
	}

	function close(returnFocus = true): void {
		if (!open) return;
		open = false;
		if (returnFocus) focusTrigger();
	}

	function select(item: MenuItem): void {
		if (item.disabled) return;
		open = false;
		focusTrigger();
		item.onSelect();
	}

	// Move focus into the menu once the panel exists.
	$effect(() => {
		if (!open) return;
		const menuItems = getItems();
		if (menuItems.length > 0) {
			focusItem(0);
			return;
		}
		void tick().then(() => {
			if (open) focusItem(0);
		});
	});

	// Outside pointer-down closes without stealing focus from the click target.
	$effect(() => {
		if (!open) return;
		const handlePointerDown = (event: PointerEvent): void => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (wrapperEl?.contains(target)) return;
			close(false);
		};
		document.addEventListener('pointerdown', handlePointerDown);
		return () => document.removeEventListener('pointerdown', handlePointerDown);
	});

	function handlePanelKeydown(event: KeyboardEvent): void {
		const menuItems = getItems();
		const currentIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				focusItem(currentIndex + 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				focusItem(currentIndex - 1);
				break;
			case 'Home':
				event.preventDefault();
				focusItem(0);
				break;
			case 'End':
				event.preventDefault();
				focusItem(menuItems.length - 1);
				break;
			case 'Escape':
				event.preventDefault();
				close();
				break;
			case 'Tab':
				close(false);
				break;
		}
	}
</script>

<div bind:this={wrapperEl} class={cn('relative inline-flex', className)}>
	{#if trigger}
		<button
			bind:this={triggerEl}
			type="button"
			aria-label={label}
			aria-haspopup="menu"
			aria-expanded={open}
			aria-controls={open ? menuId : undefined}
			onclick={toggle}
			class="inline-flex min-h-target min-w-target items-center justify-center gap-2 rounded-md text-ink-secondary hover:bg-canvas-nested hover:text-ink"
		>
			{@render trigger()}
		</button>
	{:else}
		<IconButton
			{label}
			aria-haspopup="menu"
			aria-expanded={open}
			aria-controls={open ? menuId : undefined}
			onclick={toggle}
		>
			{#snippet icon()}
				<Ellipsis size={20} aria-hidden="true" />
			{/snippet}
		</IconButton>
	{/if}

	{#if open}
		<div
			bind:this={panelEl}
			id={menuId}
			role="menu"
			aria-label={label}
			tabindex="-1"
			class={cn('menu-panel material rounded-xl border border-hairline p-1 shadow-e3', {
				'menu-align-start': align === 'start',
				'menu-align-end': align === 'end'
			})}
			onkeydown={handlePanelKeydown}
		>
			{#each items as item, index (index)}
				<button
					type="button"
					role="menuitem"
					tabindex="-1"
					disabled={item.disabled}
					onclick={() => select(item)}
					class={cn(
						'flex min-h-target w-full items-center gap-2 rounded-md px-3 text-left text-callout',
						item.danger ? 'text-critical-ink' : 'text-ink',
						item.disabled ? 'text-ink-disabled' : 'hover:bg-canvas-nested'
					)}
				>
					{#if item.icon}
						{@const Icon = item.icon}
						<Icon size={20} aria-hidden="true" />
					{/if}
					<span class="truncate">{item.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.menu-panel {
		position: absolute;
		z-index: 50;
		inset-block-start: 100%;
		margin-block-start: var(--spacing-2);
		inline-size: max-content;
		min-inline-size: 100%;
		max-inline-size: var(--layout-sidebar);
		max-height: calc(100dvh - var(--spacing-16));
		overflow-y: auto;
	}

	.menu-align-start {
		inset-inline-start: 0;
	}

	.menu-align-end {
		inset-inline-end: 0;
	}
</style>
