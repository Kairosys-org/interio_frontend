<script lang="ts">
	import { page } from '$app/state';
	import MobileVerifyPage from '$modules/surveys/presentation/mobile/pages/MobileVerifyPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<MobileVerifyPage {id} />
