<script lang="ts">
	import { page } from '$app/state';
	import MobileSubmitPage from '$modules/surveys/presentation/mobile/pages/MobileSubmitPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<MobileSubmitPage {id} />
