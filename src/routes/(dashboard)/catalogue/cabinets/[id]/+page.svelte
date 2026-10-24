<script lang="ts">
	import { page } from '$app/state';
	import CabinetDetailPage from '$modules/catalogue/presentation/pages/CabinetDetailPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<CabinetDetailPage {id} />
