<script lang="ts">
	import { page } from '$app/state';
	import MobileRoomsPage from '$modules/surveys/presentation/mobile/pages/MobileRoomsPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<MobileRoomsPage {id} />
