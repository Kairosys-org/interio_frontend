<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import type { Snippet } from 'svelte';
	import { sessionStore } from '$shared/application/session';
	import { PLATFORM_PERMISSIONS, hasPermission } from '$shared/domain/permissions';
	import { ForbiddenPage, Skeleton } from '$shared/presentation/ui';
	import PlatformShell from '$modules/platform-tenants/presentation/components/PlatformShell.svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	const user = $derived($sessionStore.user);
	const initializing = $derived($sessionStore.initializing);

	/**
	 * Platform claim plus the tenant-view scope. A tenant session never reaches
	 * the console chrome, let alone tenant data: this is the route-layer 403 and
	 * the mock/API guard denies the request independently (spec S41, R4).
	 */
	const canViewPlatform = $derived(
		user?.platform === true &&
			hasPermission(user.permissions, PLATFORM_PERMISSIONS.PLATFORM_TENANT_VIEW)
	);

	$effect(() => {
		if (initializing) return;
		if (user) return;
		void goto(resolve(`/login?redirect=${encodeURIComponent(page.url.pathname)}` as Pathname), {
			replaceState: true
		});
	});
</script>

{#if initializing}
	<div class="page-container flex min-h-dvh items-center justify-center" aria-busy="true">
		<div class="w-full max-w-content-reading">
			<Skeleton lines={4} />
		</div>
	</div>
{:else if !user}
	<!-- Redirecting to sign in. -->
{:else if !canViewPlatform}
	<ForbiddenPage variant="forbidden" />
{:else}
	<PlatformShell>{@render children()}</PlatformShell>
{/if}
