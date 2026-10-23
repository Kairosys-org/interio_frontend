<script lang="ts">
	import { page } from '$app/state';
	import MobileWallPage from '$modules/surveys/presentation/mobile/pages/MobileWallPage.svelte';

	const id = $derived(page.params.id ?? '');
	const roomId = $derived(page.params.rid ?? '');
	const wallId = $derived(page.params.wid ?? '');
</script>

<MobileWallPage {id} {roomId} {wallId} />
