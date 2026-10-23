<script lang="ts">
	import { page } from '$app/state';
	import ProjectDetailPage from '$modules/projects/presentation/pages/ProjectDetailPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<ProjectDetailPage {id} />
