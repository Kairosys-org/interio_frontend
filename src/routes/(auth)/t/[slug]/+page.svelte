<script lang="ts">
	import { page } from '$app/state';
	import WorkspaceChooserPage from '$modules/auth/presentation/pages/WorkspaceChooserPage.svelte';

	const slug = $derived(page.params.slug ?? '');
</script>

<svelte:head>
	<title>Choose a workspace · Interio</title>
</svelte:head>

<WorkspaceChooserPage {slug} />
