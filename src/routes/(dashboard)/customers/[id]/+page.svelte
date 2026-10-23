<script lang="ts">
	import { page } from '$app/state';
	import CustomerDetailPage from '$modules/customers/presentation/pages/CustomerDetailPage.svelte';

	const customerId = $derived(page.params.id ?? '');
</script>

<CustomerDetailPage {customerId} />
