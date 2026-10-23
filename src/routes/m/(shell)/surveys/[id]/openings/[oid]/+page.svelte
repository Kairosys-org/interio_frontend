<script lang="ts">
	import { page } from '$app/state';
	import MobileOpeningPage from '$modules/surveys/presentation/mobile/pages/MobileOpeningPage.svelte';

	const id = $derived(page.params.id ?? '');
	const openingId = $derived(page.params.oid ?? '');
</script>

<MobileOpeningPage {id} {openingId} />
