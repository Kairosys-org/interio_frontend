<script lang="ts">
	import { cn } from '$lib/utils';

	/**
	 * In-page section navigation for the survey detail hub.
	 *
	 * Hash targets only, so the whole survey is reviewable without hunting
	 * through a tab strip. The row scrolls sideways on phones instead of
	 * wrapping into the page gutter.
	 */
	interface SectionLink {
		id: string;
		label: string;
		count?: number;
	}

	interface Props {
		sections: SectionLink[];
		class?: string;
	}

	let { sections, class: className }: Props = $props();
</script>

<nav
	aria-label="Survey sections"
	class={cn('-mx-4 overflow-x-auto border-y border-hairline px-4 md:mx-0 md:px-0', className)}
>
	<ul class="flex list-none items-center gap-1 p-0">
		{#each sections as section (section.id)}
			{@const link = { href: `#${section.id}` }}
			<li class="shrink-0">
				<a
					{...link}
					class="inline-flex min-h-target touch-manipulation items-center gap-2 rounded-md px-3 text-footnote whitespace-nowrap text-ink-secondary hover:bg-canvas-grouped hover:text-ink"
				>
					<span>{section.label}</span>
					{#if section.count !== undefined}
						<span class="text-ink-tertiary tabular-nums">{section.count}</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
