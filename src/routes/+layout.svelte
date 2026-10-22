<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { applyTenantBranding } from '$shared/application/branding';
	import { session, sessionStore } from '$shared/application/session';
	import { Toaster } from '$shared/presentation/ui';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		// ORCHESTRATOR: pass authApi.me as the loader once the auth module lands.
		void session.init();
	});

	// Tenant branding is applied on the document root before the authenticated
	// shell paints, so no default-brass flash escapes (DESIGN §2.4, §14.4).
	$effect(() => {
		applyTenantBranding($sessionStore.user?.tenant ?? null);
	});
</script>

<svelte:head>
	<title>Interio</title>
</svelte:head>

<ModeWatcher defaultMode="system" />
<Toaster />

<div class="min-h-dvh bg-canvas text-ink">
	{@render children()}
</div>
