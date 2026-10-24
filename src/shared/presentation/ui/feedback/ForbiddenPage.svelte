<script lang="ts">
	import { resolvePath } from '$shared/lib/paths';
	import { Ban, CircleAlert, SearchX, WifiOff } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils';

	/**
	 * Shell-less failure page used for 403, 404, offline and unexpected errors
	 * (DESIGN §9.2). Focus moves to the single `h1` on mount so keyboard and
	 * screen-reader users land on the message.
	 */
	type Variant = 'forbidden' | 'not-found' | 'offline' | 'error';

	interface Props {
		variant: Variant;
		requestId?: string;
		title?: string;
		description?: string;
		backHref?: string;
		backLabel?: string;
		onRetry?: () => void;
		class?: string;
	}

	let {
		variant,
		requestId,
		title,
		description,
		backHref = '/dashboard',
		backLabel = 'Back to dashboard',
		onRetry,
		class: className
	}: Props = $props();

	const back = $derived(resolvePath(backHref));

	const VARIANTS: Record<
		Variant,
		{ icon: Component; title: string; description: string; retryable: boolean }
	> = {
		forbidden: {
			icon: Ban,
			title: 'You do not have access to this page.',
			description: 'Ask a workspace owner if you need access, then try again.',
			retryable: false
		},
		'not-found': {
			icon: SearchX,
			title: 'This page does not exist.',
			description: 'Check the address, or go back to your dashboard.',
			retryable: false
		},
		offline: {
			icon: WifiOff,
			title: 'You are offline.',
			description: 'Check your connection and try again. Your work is kept on this device.',
			retryable: true
		},
		error: {
			icon: CircleAlert,
			title: 'Something went wrong.',
			description: 'Try again. If it keeps happening, quote the request ID and contact support.',
			retryable: true
		}
	};

	const config = $derived(VARIANTS[variant]);
	const Icon = $derived(config.icon);
	const heading = $derived(title ?? config.title);
	const body = $derived(description ?? config.description);
	const showRetry = $derived(onRetry !== undefined && config.retryable);
	const headingId = $props.id();

	let headingEl = $state<HTMLHeadingElement | null>(null);

	$effect(() => {
		headingEl?.focus();
	});
</script>

<main
	aria-labelledby={headingId}
	class={cn(
		'flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-16 text-center',
		className
	)}
>
	<div class="mx-auto flex max-w-content-reading flex-col items-center gap-4">
		<Icon size={32} aria-hidden="true" class="text-ink-tertiary" />

		<h1
			id={headingId}
			bind:this={headingEl}
			tabindex="-1"
			class="text-large-title text-ink focus-visible:outline-none"
		>
			{heading}
		</h1>

		<p class="text-callout text-ink-secondary">{body}</p>

		{#if requestId}
			<p class="text-footnote text-ink-tertiary">
				Request ID
				<code class="font-mono text-ink-secondary select-all">{requestId}</code>
			</p>
		{/if}

		<div class="mt-4 flex flex-col items-center gap-2 sm:flex-row">
			{#if showRetry}
				<button
					type="button"
					onclick={onRetry}
					class="inline-flex min-h-target min-w-target items-center justify-center rounded-md bg-brand px-4 text-callout font-medium text-on-brand hover:bg-brand-hover"
				>
					Try again
				</button>
			{/if}

			{#if showRetry}
				<a
					href={back}
					class="inline-flex min-h-target min-w-target items-center justify-center rounded-md px-4 text-callout font-medium text-brand underline underline-offset-2"
				>
					{backLabel}
				</a>
			{:else}
				<a
					href={back}
					class="inline-flex min-h-target min-w-target items-center justify-center rounded-md bg-brand px-4 text-callout font-medium text-on-brand hover:bg-brand-hover"
				>
					{backLabel}
				</a>
			{/if}
		</div>
	</div>
</main>
