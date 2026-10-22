<script lang="ts">
	import {
		Bell,
		ChevronDown,
		Laptop,
		LogOut,
		Menu as MenuIcon,
		Moon,
		PanelLeft,
		PanelLeftClose,
		Rows3,
		Sun
	} from '@lucide/svelte';
	import { setMode, userPrefersMode } from 'mode-watcher';
	import { resolve } from '$app/paths';
	import { tenantDisplayName } from '$shared/application/branding';
	import { sessionStore } from '$shared/application/session';
	import { Avatar, IconButton, Input, Menu } from '$shared/presentation/ui';
	import { cn } from '$lib/utils';
	import type { Density } from './shell-preferences';

	interface Props {
		onOpenDrawer: () => void;
		onToggleSidebar?: () => void;
		collapsed?: boolean;
		title?: string;
		onSignOut: () => void;
		onToggleDensity: () => void;
		/** Current density, so the account menu can name the persisted value. */
		density?: Density;
		class?: string;
	}

	let {
		onOpenDrawer,
		onToggleSidebar,
		collapsed = false,
		title,
		onSignOut,
		onToggleDensity,
		density = 'comfortable',
		class: className
	}: Props = $props();

	const brandName = $derived(tenantDisplayName($sessionStore.user?.tenant ?? null));
	const userName = $derived($sessionStore.user?.displayName ?? 'Account');
	const themePreference = $derived(userPrefersMode.current);

	const notificationItems = [{ label: 'No notifications yet', onSelect: () => {}, disabled: true }];

	const themeItems = $derived([
		{ label: 'Light', icon: Sun, onSelect: () => setMode('light') },
		{ label: 'Dark', icon: Moon, onSelect: () => setMode('dark') },
		{ label: 'System', icon: Laptop, onSelect: () => setMode('system') }
	]);

	// Profile and Security screens ship in a later phase; until then the menu
	// offers only the preferences the shell can actually honour.
	const accountItems = $derived([
		{ label: `Density: ${density}`, icon: Rows3, onSelect: onToggleDensity },
		{ label: 'Sign out', icon: LogOut, onSelect: onSignOut, danger: true }
	]);
</script>

<header
	class={cn('material sticky top-0 z-30 h-topbar border-b border-hairline', className)}
	aria-label="Top bar"
>
	<div class="flex h-full items-center gap-2 px-4 sm:px-6 lg:px-8">
		<div class="flex min-w-0 items-center gap-2">
			<div class="md:hidden">
				<IconButton label="Open navigation" variant="ghost" onclick={onOpenDrawer}>
					{#snippet icon()}
						<MenuIcon size={20} aria-hidden="true" />
					{/snippet}
				</IconButton>
			</div>

			{#if onToggleSidebar}
				<div class="hidden lg:block">
					<IconButton
						label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
						variant="ghost"
						aria-expanded={!collapsed}
						onclick={onToggleSidebar}
					>
						{#snippet icon()}
							{#if collapsed}
								<PanelLeft size={20} aria-hidden="true" />
							{:else}
								<PanelLeftClose size={20} aria-hidden="true" />
							{/if}
						{/snippet}
					</IconButton>
				</div>
			{/if}

			<div class="min-w-0">
				<a
					href={resolve('/dashboard')}
					aria-label="{brandName} — home"
					class="flex min-h-target items-center rounded-sm text-headline tracking-tight text-ink"
				>
					<span class="block min-w-0 truncate">{brandName}</span>
				</a>
				{#if title}
					<span class="block truncate text-subheadline text-ink-secondary lg:hidden">
						{title}
					</span>
				{/if}
			</div>
		</div>

		<div
			class="hidden min-w-0 flex-1 justify-center md:flex"
			title="Search becomes available with the first data pages"
		>
			<div class="w-full max-w-content-form">
				<Input
					label="Search"
					placeholder="Search"
					type="search"
					disabled
					autocomplete="off"
					enterkeyhint="search"
					class="[&>label]:sr-only"
				/>
			</div>
			<p class="sr-only">Search becomes available with the first data pages</p>
		</div>

		<div class="ms-auto flex shrink-0 items-center gap-2">
			<Menu label="Notifications" align="end" items={notificationItems}>
				{#snippet trigger()}
					<Bell size={20} aria-hidden="true" />
				{/snippet}
			</Menu>

			<Menu label="Theme" align="end" items={themeItems}>
				{#snippet trigger()}
					{#if themePreference === 'light'}
						<Sun size={20} aria-hidden="true" />
					{:else if themePreference === 'dark'}
						<Moon size={20} aria-hidden="true" />
					{:else}
						<Laptop size={20} aria-hidden="true" />
					{/if}
				{/snippet}
			</Menu>

			<Menu label="Account" align="end" items={accountItems}>
				{#snippet trigger()}
					<span class="flex min-w-0 items-center gap-2">
						<Avatar name={userName} size="sm" />
						<span class="hidden min-w-0 truncate text-subheadline text-ink xl:inline">
							{userName}
						</span>
						<ChevronDown size={16} aria-hidden="true" class="hidden shrink-0 xl:block" />
					</span>
				{/snippet}
			</Menu>
		</div>
	</div>
</header>
