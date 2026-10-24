<script lang="ts">
	import { page } from '$app/state';
	import DecorDetailPage from '$modules/materials/presentation/pages/DecorDetailPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

<DecorDetailPage {id} />
