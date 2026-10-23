<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { PanelLeft, PanelLeftClose } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import type { NavItem, NavSection } from '$shared/application/navigation';
	import { IconButton, Tooltip } from '$shared/presentation/ui';

	interface Props {
		sections: NavSection[];
		collapsed: boolean;
		onNavigate?: () => void;
		/** Omitted inside the mobile drawer, where the rail cannot collapse. */
		onToggleCollapse?: () => void;
		class?: string;
	}

	let { sections, collapsed, onNavigate, onToggleCollapse, class: className }: Props = $props();

	const pathname = $derived(page.url.pathname);
	const collapseLabel = $derived(collapsed ? 'Expand sidebar' : 'Collapse sidebar');

	function isActive(href: string): boolean {
		if (pathname === href) return true;
		return href !== '/' && pathname.startsWith(`${href}/`);
	}

	/**
	 * Arrow keys walk the real links in visual order; every link stays in the
	 * tab order, so Tab still moves through the nav as expected.
	 */
	function handleItemKeydown(event: KeyboardEvent): void {
		const current = event.currentTarget as HTMLAnchorElement | null;
		const nav = current?.closest('nav');
		if (!current || !nav) return;
		const items = Array.from(nav.querySelectorAll<HTMLAnchorElement>('[data-nav-item]'));
		const index = items.indexOf(current);
		if (index === -1) return;

		let next: number | null = null;
		switch (event.key) {
			case 'ArrowDown':
				next = (index + 1) % items.length;
				break;
			case 'ArrowUp':
				next = (index - 1 + items.length) % items.length;
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = items.length - 1;
				break;
		}

		if (next === null) return;
		event.preventDefault();
		items[next]?.focus();
	}
</script>

{#snippet navItem(entry: NavItem)}
	<a
		href={resolve(entry.href as '/dashboard')}
		data-nav-item
		aria-current={isActive(entry.href) ? 'page' : undefined}
		aria-label={collapsed ? entry.label : undefined}
		onclick={onNavigate}
		onkeydown={handleItemKeydown}
		class={cn(
			'nav-row flex items-center gap-3 rounded-md text-callout transition-colors',
			collapsed ? 'min-w-target justify-center px-2' : 'w-full border-s-2 px-3',
			isActive(entry.href)
				? 'border-brand bg-brand-soft font-medium text-brand'
				: 'border-transparent text-ink-secondary hover:bg-canvas-nested hover:text-ink'
		)}
	>
		<entry.icon size={18} aria-hidden="true" class="shrink-0" />
		<span class={collapsed ? 'sr-only' : 'min-w-0 truncate'}>{entry.label}</span>
	</a>
{/snippet}

<nav aria-label="Main" class={cn('flex h-full min-h-0 flex-col bg-canvas-grouped', className)}>
	<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
		{#each sections as section (section.id)}
			<div class="pb-2">
				<p
					id="nav-section-{section.id}"
					class={collapsed ? 'sr-only' : 'px-3 pt-4 pb-2 text-caption text-ink-tertiary uppercase'}
				>
					{section.label}
				</p>
				<ul aria-labelledby="nav-section-{section.id}" class="flex flex-col gap-2">
					{#each section.items as entry (entry.href)}
						<li>
							{#if collapsed}
								<Tooltip content={entry.label} class="w-full justify-center">
									{@render navItem(entry)}
								</Tooltip>
							{:else}
								{@render navItem(entry)}
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>

	{#if onToggleCollapse}
		<div class="border-t border-hairline p-2">
			<Tooltip content={collapseLabel} class={collapsed ? 'w-full justify-center' : 'w-full'}>
				<IconButton
					label={collapseLabel}
					variant="ghost"
					aria-expanded={!collapsed}
					onclick={onToggleCollapse}
					class={collapsed ? undefined : 'w-full justify-start px-3'}
				>
					{#snippet icon()}
						{#if collapsed}
							<PanelLeft size={20} aria-hidden="true" />
						{:else}
							<PanelLeftClose size={20} aria-hidden="true" />
						{/if}
					{/snippet}
				</IconButton>
			</Tooltip>
		</div>
	{/if}
</nav>

<style>
	/* Density comes from the shell root so rows follow the user preference. */
	.nav-row {
		min-height: var(--shell-row, var(--layout-row-comfortable));
	}
</style>
