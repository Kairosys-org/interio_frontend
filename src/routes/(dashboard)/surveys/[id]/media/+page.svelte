<script lang="ts">
	import { page } from '$app/state';
	import SurveyMediaPage from '$modules/surveys/presentation/pages/SurveyMediaPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<SurveyMediaPage {id} />
