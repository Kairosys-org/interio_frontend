<script lang="ts">
	import { page } from '$app/state';
	import LoginPage from '$modules/auth/presentation/pages/LoginPage.svelte';

	const redirectTo = $derived(page.url.searchParams.get('redirect'));
</script>

<svelte:head>
	<title>Sign in · Interio</title>
</svelte:head>

<LoginPage {redirectTo} />
