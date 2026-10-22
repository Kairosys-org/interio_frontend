<script lang="ts">
	import { page } from '$app/state';
	import InvitePage from '$modules/auth/presentation/pages/InvitePage.svelte';

	const token = $derived(page.params.token ?? '');
</script>

<svelte:head>
	<title>Accept invitation · Interio</title>
</svelte:head>

<InvitePage {token} />
