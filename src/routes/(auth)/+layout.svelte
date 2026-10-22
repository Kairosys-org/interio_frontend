<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { sessionStore } from '$shared/application/session';

	let { children }: { children: Snippet } = $props();

	// Authenticated users never see the auth pages: keep the redirect reactive
	// so a sign-in that happens elsewhere cannot leave this shell on screen.
	$effect(() => {
		const state = $sessionStore;
		if (!state.initializing && state.user) {
			void goto(state.user.platform ? resolve('/platform/tenants') : resolve('/dashboard'), {
				replaceState: true
			});
		}
	});
</script>

<a class="skip-link" href="#main-content">Skip to content</a>

<div class="flex min-h-dvh flex-col bg-canvas-grouped">
	<header class="page-container flex justify-center pt-8">
		<a
			href={resolve('/login')}
			class="wordmark inline-flex min-h-target items-center text-headline text-ink">Interio</a
		>
	</header>

	<main
		id="main-content"
		class="page-container flex w-full flex-1 items-center justify-center py-8"
	>
		{@render children()}
	</main>
</div>

<style>
	/* DESIGN §2.3: the wordmark is plain text with a hint of tracking. */
	.wordmark {
		letter-spacing: 0.01em;
	}
</style>
