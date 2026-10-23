<script lang="ts">
	import { page } from '$app/state';
	import PropertyDetailPage from '$modules/properties/presentation/pages/PropertyDetailPage.svelte';

	const propertyId = $derived(page.params.id ?? '');
</script>

<PropertyDetailPage {propertyId} />
