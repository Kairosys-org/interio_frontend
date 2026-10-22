<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface Crumb {
		label: string;
		href?: string;
	}

	interface Props {
		items: Crumb[];
		class?: string;
	}

	let { items, class: className }: Props = $props();
</script>

<nav aria-label="Breadcrumb" class={cn('w-full', className)}>
	<ol class="m-0 flex min-h-target list-none flex-wrap items-center gap-1 p-0">
		{#each items as item, index (index)}
			{@const isLast = index === items.length - 1}
			{@const isMiddle = index > 0 && !isLast}
			<li class={cn('items-center gap-1', isMiddle ? 'hidden sm:flex' : 'flex')}>
				{#if index > 0}
					<ChevronRight
						size={16}
						strokeWidth={1.75}
						aria-hidden="true"
						class="shrink-0 text-ink-tertiary"
					/>
				{/if}

				{#if item.href && !isLast}
					{@const linkAttributes = { href: item.href }}
					<a
						{...linkAttributes}
						class="inline-flex min-h-target items-center rounded-sm px-1 text-footnote text-brand underline-offset-2 hover:text-brand-hover hover:underline"
					>
						{item.label}
					</a>
				{:else}
					<span
						aria-current={isLast ? 'page' : undefined}
						class={cn(
							'inline-flex min-h-target items-center px-1 text-footnote',
							isLast ? 'text-ink' : 'text-ink-secondary'
						)}
					>
						{item.label}
					</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
