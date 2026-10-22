<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { authApi } from '$modules/auth/data/api';
	import { applyTenantBranding } from '$shared/application/branding';
	import { session, sessionStore } from '$shared/application/session';
	import { Toaster } from '$shared/presentation/ui';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		// The session store stays free of feature knowledge: the auth facade is
		// injected here, so a stored token is exchanged for `/auth/me` on reload.
		void session.init(() => authApi.me());
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
