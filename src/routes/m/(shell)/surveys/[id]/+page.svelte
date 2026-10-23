<script lang="ts">
	import { page } from '$app/state';
	import MobileSurveyHubPage from '$modules/surveys/presentation/mobile/pages/MobileSurveyHubPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<MobileSurveyHubPage {id} />
