<script lang="ts">
	import { page } from '$app/state';
	import ImportDetailPage from '$modules/imports/presentation/pages/ImportDetailPage.svelte';

	const importId = $derived(page.params.id ?? '');
</script>

<ImportDetailPage {importId} />
