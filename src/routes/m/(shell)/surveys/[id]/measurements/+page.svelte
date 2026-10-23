<script lang="ts">
	import { page } from '$app/state';
	import MobileMeasurementsPage from '$modules/surveys/presentation/mobile/pages/MobileMeasurementsPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<MobileMeasurementsPage {id} />
