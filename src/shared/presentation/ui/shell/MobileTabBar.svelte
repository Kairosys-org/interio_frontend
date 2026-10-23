<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ClipboardList, FolderKanban, RefreshCw, UserRound } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	/**
	 * Mobile survey shell navigation (DESIGN §11, spec Part 11 §5).
	 *
	 * Exactly four tabs — Projects, Surveys, Sync, Account — and nothing from
	 * the commercial, workshop or admin areas. Every item is a 44 px target;
	 * the bar respects the device safe area.
	 */
	interface Props {
		/** Changes waiting to sync, shown on the Sync tab. */
		pending?: number;
		class?: string;
	}

	let { pending = 0, class: className }: Props = $props();

	const TABS = [
		{ href: '/m/projects', label: 'Projects', Icon: FolderKanban },
		{ href: '/m/surveys', label: 'Surveys', Icon: ClipboardList },
		{ href: '/m/sync', label: 'Sync', Icon: RefreshCw },
		{ href: '/m/account', label: 'Account', Icon: UserRound }
	] as const;

	const pathname = $derived(page.url.pathname);

	function isActive(href: string): boolean {
		return pathname === href || pathname.startsWith(`${href}/`);
	}
</script>

<nav
	aria-label="Mobile survey"
	class={cn(
		'mobile-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas',
		className
	)}
>
	<ul class="flex items-stretch justify-around">
		{#each TABS as tab (tab.href)}
			{@const active = isActive(tab.href)}
			<li class="flex-1">
				<a
					href={resolve(tab.href as '/m/projects')}
					aria-current={active ? 'page' : undefined}
					class={cn(
						'flex min-h-target touch-manipulation flex-col items-center justify-center gap-1 px-2 py-2 text-caption',
						active ? 'bg-brand-soft text-brand' : 'text-ink-secondary'
					)}
				>
					<span class="relative">
						<tab.Icon size={20} strokeWidth={active ? 2 : 1.75} aria-hidden="true" />
						{#if tab.href === '/m/sync' && pending > 0}
							<span
								class="absolute -end-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-caution px-1 text-caption text-on-brand tabular-nums"
							>
								{pending}
								<span class="sr-only">
									{pending === 1 ? 'change' : 'changes'} waiting to sync
								</span>
							</span>
						{/if}
					</span>
					<span>{tab.label}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.mobile-tabbar {
		padding-block-end: env(safe-area-inset-bottom);
	}
</style>
