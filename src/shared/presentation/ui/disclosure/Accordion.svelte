<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface AccordionItem {
		id: string;
		title: string;
		description?: string;
	}

	interface Props {
		items: AccordionItem[];
		children: Snippet<[string]>;
		/** Allow several panels open at once. Default: one at a time. */
		multiple?: boolean;
		class?: string;
	}

	let { items, children, multiple = false, class: className }: Props = $props();

	const baseId = $props.id();

	let openIds = $state<string[]>([]);

	function isOpen(itemId: string): boolean {
		return openIds.includes(itemId);
	}

	function toggle(itemId: string): void {
		if (isOpen(itemId)) {
			openIds = openIds.filter((openId) => openId !== itemId);
			return;
		}
		openIds = multiple ? [...openIds, itemId] : [itemId];
	}
</script>

<div class={cn('border-t border-hairline', className)}>
	{#each items as item, index (item.id)}
		<div class="border-b border-hairline">
			<h3 class="m-0">
				<button
					type="button"
					id={`${baseId}-header-${index}`}
					aria-expanded={isOpen(item.id)}
					aria-controls={`${baseId}-panel-${index}`}
					onclick={() => toggle(item.id)}
					class="flex min-h-target w-full items-center justify-between gap-3 rounded-sm px-1 py-2 text-start"
				>
					<span class="flex min-w-0 flex-col gap-1">
						<span class="text-callout text-ink">{item.title}</span>
						{#if item.description}
							<span class="text-footnote text-ink-secondary">{item.description}</span>
						{/if}
					</span>
					<ChevronDown
						size={20}
						strokeWidth={1.75}
						aria-hidden="true"
						class={cn(
							'accordion-chevron shrink-0 text-ink-secondary',
							isOpen(item.id) && 'accordion-chevron-open'
						)}
					/>
				</button>
			</h3>

			<div
				id={`${baseId}-panel-${index}`}
				role="region"
				aria-labelledby={`${baseId}-header-${index}`}
				hidden={!isOpen(item.id)}
				class="px-1 pb-4 text-callout text-ink-secondary"
			>
				{@render children(item.id)}
			</div>
		</div>
	{/each}
</div>

<style>
	.accordion-chevron {
		transition: transform var(--motion-fast) var(--ease-standard);
	}

	.accordion-chevron-open {
		transform: rotate(180deg);
	}
</style>
