<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	/** Inline link to another record's caption (architecture §5). */
	interface Props {
		href: string;
		children: Snippet;
		class?: string;
	}

	let { href, children, class: className }: Props = $props();

	/**
	 * Hrefs arrive already resolved by the caller (`resolve()` from
	 * `$app/paths`); a primitive cannot know route ids, so the link attributes
	 * are handed to the anchor as a group instead of re-resolving them here.
	 */
	const linkAttributes = $derived({ href });
</script>

<a
	{...linkAttributes}
	class={cn(
		'inline-flex min-h-target items-center rounded-sm break-words text-brand underline underline-offset-2 hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2',
		className
	)}
>
	{@render children()}
</a>
