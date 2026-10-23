<script lang="ts">
	import { page } from '$app/state';
	import SurveyDetailPage from '$modules/surveys/presentation/pages/SurveyDetailPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<SurveyDetailPage {id} />
