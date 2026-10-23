<script lang="ts">
	import { page } from '$app/state';
	import MobileMediaPage from '$modules/surveys/presentation/mobile/pages/MobileMediaPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<MobileMediaPage {id} />
