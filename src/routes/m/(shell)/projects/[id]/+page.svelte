<script lang="ts">
	import { page } from '$app/state';
	import MobileProjectPage from '$modules/surveys/presentation/mobile/pages/MobileProjectPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<MobileProjectPage {id} />
