<script lang="ts">
	import { page } from '$app/state';
	import SupplierDetailPage from '$modules/materials/presentation/pages/SupplierDetailPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<SupplierDetailPage {id} />
