<script lang="ts">
	import { page } from '$app/state';
	import SurveyVerifyPage from '$modules/surveys/presentation/pages/SurveyVerifyPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<SurveyVerifyPage {id} />
