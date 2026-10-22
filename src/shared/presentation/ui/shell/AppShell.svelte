<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { tick, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import { NAV_SECTIONS, visibleSections } from '$shared/application/navigation';
	import { clearSession, sessionStore } from '$shared/application/session';
	import { cn } from '$lib/utils';
	import SidebarNav from './SidebarNav.svelte';
	import TopBar from './TopBar.svelte';
	import {
		readDensity,
		readSidebarCollapsed,
		writeDensity,
		writeSidebarCollapsed,
		type Density
	} from './shell-preferences';

	interface Props {
		children: Snippet;
		class?: string;
	}

	let { children, class: className }: Props = $props();

	const user = $derived($sessionStore.user);
	const sections = $derived(visibleSections(NAV_SECTIONS, user?.permissions ?? []));
	const pageTitle = $derived(
		sections
			.flatMap((section) => section.items)
			.find(
				(entry) =>
					page.url.pathname === entry.href || page.url.pathname.startsWith(`${entry.href}/`)
			)?.label ?? ''
	);

	// Preferences are read once for the signed-in user, then kept in sync if the
	// session changes without remounting the shell.
	const initialUserId = untrack(() => user?.id ?? '');
	let activeUserId = $state(initialUserId);
	let expanded = $state(initialUserId ? !readSidebarCollapsed(initialUserId) : true);
	let density = $state<Density>(initialUserId ? readDensity(initialUserId) : 'comfortable');
	let drawerOpen = $state(false);
	let drawerElement = $state<HTMLDivElement | null>(null);

	$effect(() => {
		const id = user?.id ?? '';
		if (id === activeUserId) return;
		activeUserId = id;
		expanded = id ? !readSidebarCollapsed(id) : true;
		density = id ? readDensity(id) : 'comfortable';
	});

	function toggleSidebar(): void {
		expanded = !expanded;
		if (activeUserId) writeSidebarCollapsed(activeUserId, !expanded);
	}

	function toggleDensity(): void {
		const next: Density = density === 'compact' ? 'comfortable' : 'compact';
		density = next;
		if (activeUserId) writeDensity(activeUserId, next);
	}

	function openDrawer(): void {
		drawerOpen = true;
	}

	function closeDrawer(): void {
		drawerOpen = false;
	}

	function signOut(): void {
		// ORCHESTRATOR: call authApi.logout() before clearing.
		clearSession();
		void goto(resolve('/login' as Pathname));
	}

	function focusableIn(root: HTMLElement): HTMLElement[] {
		const selector =
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
		return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
			(element) => element.getClientRects().length > 0
		);
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		if (!drawerOpen) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			closeDrawer();
			return;
		}
		if (event.key !== 'Tab') return;

		const node = drawerElement;
		if (!node) return;
		const focusable = focusableIn(node);
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (!first || !last) {
			event.preventDefault();
			node.focus();
			return;
		}

		const active = document.activeElement;
		const inside = active instanceof Node && node.contains(active);
		if (!inside) {
			event.preventDefault();
			(event.shiftKey ? last : first).focus();
			return;
		}
		if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	// Scroll lock, initial focus and focus return for the mobile drawer.
	$effect(() => {
		if (!drawerOpen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		let cancelled = false;

		void tick().then(() => {
			if (cancelled) return;
			const node = drawerElement;
			if (!node) return;
			// The backdrop close button comes first; the panel is the real target.
			const focusable = focusableIn(node);
			(focusable[1] ?? focusable[0])?.focus();
		});

		return () => {
			cancelled = true;
			document.body.style.overflow = previousOverflow;
			const trigger = document.querySelector<HTMLElement>('header [aria-label="Open navigation"]');
			trigger?.focus();
		};
	});
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<a class="skip-link" href="#main-content">Skip to content</a>

<div class={cn('flex min-h-dvh bg-canvas text-ink', className)} data-density={density}>
	<div
		class={cn(
			'sticky top-0 hidden h-dvh shrink-0 border-e border-hairline bg-canvas-grouped md:block md:w-sidebar-collapsed',
			expanded ? 'lg:w-sidebar' : 'lg:w-sidebar-collapsed'
		)}
	>
		<div class="hidden h-full lg:block">
			<SidebarNav {sections} collapsed={!expanded} onToggleCollapse={toggleSidebar} />
		</div>
		<div class="h-full lg:hidden">
			<SidebarNav {sections} collapsed={true} />
		</div>
	</div>

	<div class="flex min-w-0 flex-1 flex-col">
		<TopBar
			onOpenDrawer={openDrawer}
			onToggleSidebar={toggleSidebar}
			collapsed={!expanded}
			title={pageTitle}
			onSignOut={signOut}
			onToggleDensity={toggleDensity}
			{density}
		/>

		<main id="main-content" tabindex="-1" class="page-container w-full flex-1 py-6 lg:py-8">
			{@render children()}
		</main>
	</div>
</div>

{#if drawerOpen}
	<div
		class="fixed inset-0 z-40 md:hidden"
		role="dialog"
		aria-modal="true"
		aria-label="Navigation"
		bind:this={drawerElement}
		tabindex="-1"
	>
		<button
			type="button"
			class="absolute inset-0 bg-ink/40"
			aria-label="Close navigation"
			onclick={closeDrawer}
		></button>
		<div
			class="drawer-panel relative flex h-full w-sidebar max-w-full flex-col border-e border-hairline bg-canvas-grouped shadow-e4"
		>
			<SidebarNav {sections} collapsed={false} onNavigate={closeDrawer} />
		</div>
	</div>
{/if}

<style>
	[data-density='compact'] {
		--shell-row: var(--layout-row-compact);
	}

	[data-density='comfortable'] {
		--shell-row: var(--layout-row-comfortable);
	}

	.drawer-panel {
		animation: drawer-enter var(--motion-standard) var(--ease-enter);
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

	@media (prefers-reduced-motion: reduce) {
		.drawer-panel {
			animation: none;
		}
	}
</style>
