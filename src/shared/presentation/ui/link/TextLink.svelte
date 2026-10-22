<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface Props extends Omit<
		HTMLAnchorAttributes,
		'href' | 'target' | 'rel' | 'children' | 'class' | 'onclick'
	> {
		href: string;
		/** Opens in a new tab and announces it to screen readers. */
		external?: boolean;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
		class?: string;
	}

	let { href, external = false, onclick, children, class: className, ...rest }: Props = $props();

	/**
	 * Hrefs arrive already resolved by the caller (`resolve()` from `$app/paths`);
	 * a primitive cannot know route ids, so the link attributes are handed to the
	 * anchor as a group instead of re-resolving them here.
	 */
	const linkAttributes = $derived({
		href,
		target: external ? '_blank' : undefined,
		rel: external ? 'noopener noreferrer' : undefined
	});
</script>

<a
	{...rest}
	{...linkAttributes}
	{onclick}
	class={cn(
		'inline rounded-sm text-brand underline underline-offset-2 hover:text-brand-hover',
		className
	)}
>
	{@render children()}{#if external}<span class="sr-only"> (opens in a new tab)</span>{/if}
</a>
