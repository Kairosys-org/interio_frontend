<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	import type { Snippet } from 'svelte';
	import { isOnline } from '$shared/application/connectivity.svelte';
	import { sessionStore } from '$shared/application/session';
	import { PERMISSIONS, hasPermission } from '$shared/domain/permissions';
	import {
		ForbiddenPage,
		MobileTabBar,
		OfflineBanner,
		Skeleton,
		SyncStatusChip
	} from '$shared/presentation/ui';
	import { syncApi } from '$modules/sync/data/api';
	import type { SyncPendingCounts } from '$modules/sync/domain/types';

	/**
	 * Mobile survey shell (DESIGN §11, phase-2 §3.2).
	 *
	 * Four tabs, a persistent offline banner, the sync chip in the header and
	 * the bottom bar above the safe area. The session comes from the root
	 * layout; this shell only decides whether the user may see the survey app.
	 */
	let { children }: { children: Snippet } = $props();

	const user = $derived($sessionStore.user);
	const initializing = $derived($sessionStore.initializing);
	const allowed = $derived(
		Boolean(user && hasPermission(user.permissions, PERMISSIONS.SURVEY_VIEW))
	);
	const online = $derived(isOnline());

	let counts = $state<SyncPendingCounts | null>(null);
	let countsSequence = 0;

	$effect(() => {
		if (!user || !allowed) return;
		void loadCounts();
	});

	$effect(() => {
		if (initializing) return;
		if (user) return;
		const target = resolve(
			`/m/login?redirect=${encodeURIComponent(page.url.pathname + page.url.search)}`
		);
		void goto(target, { replaceState: true });
	});

	$effect(() => {
		if (!user || !allowed) return;
		const refresh = () => void loadCounts();
		window.addEventListener('online', refresh);
		window.addEventListener('offline', refresh);
		window.addEventListener('interio:sync-changed', refresh);
		return () => {
			window.removeEventListener('online', refresh);
			window.removeEventListener('offline', refresh);
			window.removeEventListener('interio:sync-changed', refresh);
		};
	});

	async function loadCounts(): Promise<void> {
		const sequence = ++countsSequence;
		try {
			const pending = await syncApi.pending();
			if (sequence !== countsSequence) return;
			counts = pending;
		} catch {
			if (sequence !== countsSequence) return;
			counts = null;
		}
	}
</script>

<svelte:head>
	<meta name="theme-color" content="#111111" />
</svelte:head>

{#if initializing}
	<div class="flex min-h-dvh flex-col gap-4 bg-canvas p-4" aria-busy="true">
		<Skeleton variant="block" class="h-10" />
		<Skeleton lines={4} />
		<p class="sr-only" role="status">Loading the survey app</p>
	</div>
{:else if !user}
	<div class="min-h-dvh bg-canvas" aria-busy="true"></div>
{:else if !allowed}
	<div class="page-container flex min-h-dvh flex-col justify-center py-10">
		<ForbiddenPage
			variant="forbidden"
			title="Survey app unavailable."
			description="Your role does not include site capture. Use the web app to review projects."
		/>
	</div>
{:else}
	<div class="flex min-h-dvh flex-col bg-canvas">
		<OfflineBanner {online} queued={counts?.unsent ?? 0} />

		<header
			class="material sticky top-0 z-30 flex h-topbar items-center justify-between gap-3 border-b border-hairline px-4"
		>
			<a
				{...{ href: resolve('/m/projects') }}
				class="inline-flex min-h-target items-center gap-2 text-headline text-ink"
			>
				<span
					class="inline-flex size-8 items-center justify-center rounded-md bg-brand text-on-brand"
				>
					I
				</span>
				<span>Interio Survey</span>
			</a>
			<SyncStatusChip
				{online}
				queued={counts?.unsent ?? 0}
				conflicts={counts?.conflict ?? 0}
				uploading={counts?.sending ?? 0}
				href={resolve('/m/sync')}
			/>
		</header>

		<main class="page-container mobile-main w-full flex-1 pt-4">
			{#key page.url.pathname}
				<div class="route-fade">{@render children()}</div>
			{/key}
		</main>

		<MobileTabBar pending={counts?.unsent ?? 0} />
	</div>
{/if}

<style>
	/* Leave room for the fixed tab bar and its safe-area padding. */
	.mobile-main {
		padding-block-end: 6rem;
	}
</style>
