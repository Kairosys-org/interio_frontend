<script lang="ts">
	import { isOnline } from '$shared/application/connectivity.svelte';
	import { OfflineBanner } from '$shared/presentation/ui';
	import LoginPage from './LoginPage.svelte';

	/**
	 * `/m/login` — mobile sign-in (phase-2 §3.2).
	 *
	 * The form itself is the shared auth page so credentials, MFA and demo
	 * accounts behave identically. Two native-only abilities are called out
	 * instead of faked: biometric unlock and offline unlock of a stored
	 * session need a native shell / encrypted local session, neither of which
	 * exists in phase 2 (Q9).
	 */
	interface Props {
		redirectTo?: string | null;
	}

	let { redirectTo = '/m/projects' }: Props = $props();

	const online = $derived(isOnline());
</script>

<svelte:head>
	<title>Sign in · Interio Survey</title>
</svelte:head>

<div class="min-h-dvh bg-canvas">
	<OfflineBanner {online} />

	<div class="page-container flex min-h-dvh flex-col gap-6 py-8">
		<header class="flex flex-col gap-1">
			<p class="text-footnote text-ink-secondary">Interio Survey</p>
			<h1 class="text-title-1 text-ink">Capture on site</h1>
			<p class="text-callout text-ink-secondary">
				Sign in with your work account. Your surveys and rooms are the same ones the office sees.
			</p>
		</header>

		<LoginPage {redirectTo} />

		{#if !online}
			<p
				class="rounded-lg border border-hairline bg-canvas-grouped p-4 text-callout text-ink-secondary"
			>
				Offline unlock is not available yet. Keep this tab open while you are on site; sign-in
				itself needs a connection.
			</p>
		{/if}

		<p class="text-footnote text-ink-tertiary">
			Biometric unlock needs the native app wrapper, which is out of scope for this phase. Use your
			password and six-digit code.
		</p>
	</div>
</div>
