<script lang="ts">
	import { page } from '$app/state';
	import TenantDetailPage from '$modules/platform-tenants/presentation/pages/TenantDetailPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<svelte:head>
	<title>Tenant · Interio Platform</title>
</svelte:head>

<TenantDetailPage {id} />
