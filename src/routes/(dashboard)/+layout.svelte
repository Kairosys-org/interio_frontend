<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { sessionStore } from '$shared/application/session';
	import { hasPermission } from '$shared/domain/permissions';
	import { permissionForRoute } from '$shared/domain/routePermissions';
	import { AppShell, ForbiddenPage, Skeleton } from '$shared/presentation/ui';

	let { children }: { children: Snippet } = $props();

	const user = $derived($sessionStore.user);
	const initializing = $derived($sessionStore.initializing);
	const expired = $derived($sessionStore.sessionExpired);
	const required = $derived(permissionForRoute(page.url.pathname));
	const allowed = $derived(!required || (user ? hasPermission(user.permissions, required) : false));

	let expiryNotified = false;

	// A refresh failure clears the session and lands here; say why once before
	// the redirect to sign-in (Phase 0 §3, sessionExpired).
	$effect(() => {
		if (!expired || expiryNotified) return;
		expiryNotified = true;
		toast('Session expired', {
			id: 'session-expired',
			description: 'Sign in again to continue.'
		});
	});

	// Never paint the shell for a session that no longer exists. `ssr` is off,
	// but `goto` still waits for initialisation to finish.
	$effect(() => {
		if (initializing || user) return;
		const target = resolve(
			`/login?redirect=${encodeURIComponent(page.url.pathname + page.url.search)}` as Pathname
		);
		void goto(target, { replaceState: true });
	});
</script>

{#if initializing}
	<div class="flex min-h-dvh items-center justify-center bg-canvas" aria-busy="true">
		<div class="page-container w-full max-w-content-reading" aria-hidden="true">
			<Skeleton variant="block" class="h-8 w-48" />
			<Skeleton lines={3} class="mt-4" />
		</div>
		<p class="sr-only" role="status">Loading your workspace</p>
	</div>
{:else if !user}
	<div class="min-h-dvh bg-canvas" aria-busy="true"></div>
{:else if !allowed}
	<div class="min-h-dvh bg-canvas">
		<ForbiddenPage variant="forbidden" />
	</div>
{:else}
	<AppShell>
		{#key page.url.pathname}
			<div class="route-fade">{@render children()}</div>
		{/key}
	</AppShell>
{/if}

<style>
	/* Route changes fade only: no slide, no scale (DESIGN §7.2). */
	.route-fade {
		animation: route-fade var(--motion-page) var(--ease-standard);
	}

	@keyframes route-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.route-fade {
			animation: none;
		}
	}
</style>
