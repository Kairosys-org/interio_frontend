<script lang="ts">
	import { page } from '$app/state';
	import { ForbiddenPage } from '$shared/presentation/ui';

	type ErrorVariant = 'forbidden' | 'not-found' | 'offline' | 'error';

	const variant = $derived<ErrorVariant>(
		page.status === 404
			? 'not-found'
			: page.status === 403
				? 'forbidden'
				: page.status === 0
					? 'offline'
					: 'error'
	);

	const description = $derived(
		typeof page.error?.message === 'string' && page.error.message.length > 0
			? page.error.message
			: undefined
	);

	const requestId = $derived(readRequestId(page.error));

	const heading = $derived(
		variant === 'not-found'
			? 'Page not found'
			: variant === 'forbidden'
				? 'Access denied'
				: variant === 'offline'
					? 'You are offline'
					: 'Something went wrong'
	);

	function readRequestId(error: unknown): string | undefined {
		if (!error || typeof error !== 'object') return undefined;
		const value = (error as { requestId?: unknown }).requestId;
		return typeof value === 'string' && value.length > 0 ? value : undefined;
	}
</script>

<svelte:head>
	<title>{heading} · Interio</title>
</svelte:head>

<div class="min-h-dvh bg-canvas">
	<ForbiddenPage {variant} {description} {requestId} backHref="/dashboard" />
</div>
