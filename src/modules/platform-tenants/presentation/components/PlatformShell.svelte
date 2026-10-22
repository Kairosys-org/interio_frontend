<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import {
		Building2,
		ChevronDown,
		ClipboardList,
		Menu as MenuIcon,
		SunMoon,
		X
	} from '@lucide/svelte';
	import { setMode } from 'mode-watcher';
	import type { Component, Snippet } from 'svelte';
	import { clearSession, sessionStore } from '$shared/application/session';
	import { cn } from '$lib/utils';
	import { Avatar, IconButton, Menu } from '$shared/presentation/ui';

	/**
	 * Platform console chrome — Interio only (DESIGN §2.2, §10.2 "Platform
	 * console", §11). No tenant branding, no tenant navigation, no tenant
	 * switcher: platform staff are not members of any tenant (spec Part 2 §2.5).
	 */
	interface Props {
		children: Snippet;
		/** Injected by the route so revocation stays outside the shell. */
		onSignOut?: () => void;
	}

	let { children, onSignOut }: Props = $props();

	interface PlatformNavItem {
		label: string;
		href: Pathname;
		icon: Component;
	}

	const NAV_ITEMS: readonly PlatformNavItem[] = [
		{ label: 'Tenants', href: '/platform/tenants', icon: Building2 },
		{ label: 'Audit log', href: '/platform/audit', icon: ClipboardList }
	];

	const pathname = $derived(page.url.pathname);
	const userName = $derived($sessionStore.user?.displayName ?? 'Platform staff');
	const userEmail = $derived($sessionStore.user?.email ?? '');

	function isActive(href: string): boolean {
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	// ---- Account menu -------------------------------------------------------

	const themeItems = [
		{ label: 'Light', onSelect: () => setMode('light') },
		{ label: 'Dark', onSelect: () => setMode('dark') },
		{ label: 'System', onSelect: () => setMode('system') }
	];

	const accountItems = [
		{ label: 'Exit to app', onSelect: () => void goto(resolve('/dashboard')) },
		{
			label: 'Sign out',
			danger: true,
			onSelect: () => {
				if (onSignOut) {
					onSignOut();
					return;
				}
				clearSession();
				void goto(resolve('/login'));
			}
		}
	];

	// ---- Drawer below `lg` --------------------------------------------------

	let drawerEl = $state<HTMLDialogElement | null>(null);
	let drawerOpen = $state(false);
	let menuButtonEl = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		const drawer = drawerEl;
		if (!drawer) return;
		if (drawerOpen && !drawer.open) drawer.showModal();
		else if (!drawerOpen && drawer.open) drawer.close();
	});

	$effect(() => {
		if (!drawerOpen) return;
		const { body } = document;
		const previousOverflow = body.style.overflow;
		body.style.overflow = 'hidden';
		return () => {
			body.style.overflow = previousOverflow;
		};
	});

	function closeDrawer(returnFocus = true): void {
		if (!drawerOpen) return;
		drawerOpen = false;
		if (returnFocus) menuButtonEl?.focus();
	}

	function handleDrawerKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeDrawer();
			return;
		}
		if (event.key !== 'Tab') return;

		const drawer = drawerEl;
		if (!drawer) return;
		const focusable = Array.from(
			drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
		);
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (!first || !last) return;

		const active = document.activeElement;
		if (event.shiftKey) {
			if (active === first || !drawer.contains(active)) {
				event.preventDefault();
				last.focus();
			}
			return;
		}
		if (active === last || !drawer.contains(active)) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

{#snippet navList(onNavigate?: () => void)}
	<ul class="flex list-none flex-col gap-1 p-0">
		{#each NAV_ITEMS as item (item.href)}
			{@const active = isActive(item.href)}
			{@const Icon = item.icon}
			<li>
				<a
					href={resolve(item.href)}
					aria-current={active ? 'page' : undefined}
					onclick={() => onNavigate?.()}
					class={cn(
						'flex min-h-target items-center gap-3 rounded-md px-3 text-callout',
						active
							? 'bg-brand-soft text-brand'
							: 'text-ink-secondary hover:bg-canvas-nested hover:text-ink'
					)}
				>
					<Icon size={20} strokeWidth={1.75} aria-hidden="true" class="shrink-0" />
					<span class="truncate">{item.label}</span>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet themeTrigger()}
	<SunMoon size={20} strokeWidth={1.75} aria-hidden="true" />
{/snippet}

{#snippet accountTrigger()}
	<Avatar name={userName} size="sm" />
	<ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" class="text-ink-tertiary" />
{/snippet}

{#snippet menuIcon()}
	<MenuIcon size={20} strokeWidth={1.75} aria-hidden="true" />
{/snippet}

{#snippet closeIcon()}
	<X size={20} strokeWidth={1.75} aria-hidden="true" />
{/snippet}

<a href="#main-content" class="skip-link">Skip to content</a>

<div class="flex min-h-dvh bg-canvas text-ink">
	<aside
		class="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col border-e border-hairline bg-canvas-grouped px-4 py-6 lg:flex"
	>
		<div class="flex flex-col gap-1 px-2 pb-8">
			<span class="text-title-3 text-ink">Interio</span>
			<span class="text-footnote text-ink-tertiary">Platform console</span>
		</div>
		<nav aria-label="Platform">
			{@render navList()}
		</nav>
	</aside>

	<div class="flex min-w-0 flex-1 flex-col">
		<header
			class="sticky top-0 z-30 flex h-topbar shrink-0 items-center justify-between gap-4 border-b border-hairline bg-canvas px-4 md:px-6"
		>
			<div class="flex min-w-0 items-center gap-2">
				<button
					bind:this={menuButtonEl}
					type="button"
					aria-label="Open navigation"
					aria-haspopup="dialog"
					aria-expanded={drawerOpen}
					onclick={() => (drawerOpen = true)}
					class="inline-flex min-h-target min-w-target items-center justify-center rounded-md text-ink-secondary hover:bg-canvas-nested hover:text-ink lg:hidden"
				>
					{@render menuIcon()}
				</button>
				<div class="flex min-w-0 flex-col lg:hidden">
					<span class="text-subheadline text-ink">Interio</span>
					<span class="text-caption text-ink-tertiary">Platform console</span>
				</div>
				<p class="hidden text-footnote text-ink-tertiary lg:block">Platform console</p>
			</div>

			<div class="flex items-center gap-2">
				<Menu label="Change theme" items={themeItems} trigger={themeTrigger} align="end" />
				<Menu label="Account" items={accountItems} trigger={accountTrigger} align="end" />
			</div>
		</header>

		<main id="main-content" tabindex="-1" class="page-container flex-1 py-6 md:py-8">
			<div class="mx-auto w-full max-w-content-data">
				{@render children()}
			</div>
		</main>
	</div>
</div>

<dialog
	bind:this={drawerEl}
	class="drawer"
	aria-label="Platform navigation"
	oncancel={(event) => {
		event.preventDefault();
		closeDrawer();
	}}
	onclose={() => (drawerOpen = false)}
	onkeydown={handleDrawerKeydown}
>
	<div class="flex h-full flex-col px-4 py-4">
		<div class="flex items-start justify-between gap-4 px-2 pb-8">
			<div class="flex flex-col gap-1">
				<span class="text-title-3 text-ink">Interio</span>
				<span class="text-footnote text-ink-tertiary">Platform console</span>
			</div>
			<IconButton label="Close navigation" icon={closeIcon} onclick={() => closeDrawer()} />
		</div>
		<nav aria-label="Platform" class="min-h-0 flex-1 overflow-y-auto">
			{@render navList(() => closeDrawer(false))}
		</nav>
		<p class="px-2 pt-6 text-footnote text-ink-tertiary">{userEmail}</p>
	</div>
</dialog>

<style>
	.drawer {
		position: fixed;
		inset-block: 0;
		inset-inline-start: 0;
		inline-size: min(var(--layout-sidebar), calc(100dvw - var(--spacing-8)));
		block-size: 100dvh;
		max-block-size: 100dvh;
		margin: 0;
		padding: 0;
		border: 0;
		border-inline-end: 1px solid var(--color-separator);
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-4);
	}

	.drawer::backdrop {
		background: color-mix(in oklab, var(--color-text-primary) 32%, transparent);
	}

	@media (prefers-reduced-motion: no-preference) {
		.drawer[open] {
			animation: drawer-enter var(--motion-overlay) var(--ease-enter);
		}

		@keyframes drawer-enter {
			from {
				opacity: 0;
				transform: translateX(-100%);
			}
			to {
				opacity: 1;
				transform: translateX(0);
			}
		}
	}
</style>
