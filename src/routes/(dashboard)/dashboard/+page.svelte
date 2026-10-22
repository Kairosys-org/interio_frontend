<script lang="ts">
	import { Rows3 } from '@lucide/svelte';
	import { EmptyState } from '$shared/presentation/ui';
</script>

<svelte:head>
	<title>Dashboard · Interio</title>
</svelte:head>

<div class="max-w-content-reading">
	<header class="mb-8">
		<h1 class="text-large-title text-ink">Dashboard</h1>
		<p class="mt-2 text-body text-ink-secondary">
			Your workspace overview appears here as each phase ships.
		</p>
	</header>

	<div role="status">
		<EmptyState
			title="Nothing to show yet"
			description="The first dashboard widgets arrive in phase 1. Until then, the sidebar lists the areas your role can reach."
		>
			{#snippet icon()}
				<Rows3 size={24} aria-hidden="true" />
			{/snippet}
		</EmptyState>
	</div>
</div>
