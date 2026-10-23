<script lang="ts">
	import { page } from '$app/state';
	import MobileLoginPage from '$modules/auth/presentation/pages/MobileLoginPage.svelte';

	const redirectTo = $derived(page.url.searchParams.get('redirect') ?? '/m/projects');
</script>

<MobileLoginPage {redirectTo} />
