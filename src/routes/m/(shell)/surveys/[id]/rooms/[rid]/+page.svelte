<script lang="ts">
	import { page } from '$app/state';
	import MobileRoomPage from '$modules/surveys/presentation/mobile/pages/MobileRoomPage.svelte';

	const id = $derived(page.params.id ?? '');
	const roomId = $derived(page.params.rid ?? '');
</script>

<MobileRoomPage {id} {roomId} />
