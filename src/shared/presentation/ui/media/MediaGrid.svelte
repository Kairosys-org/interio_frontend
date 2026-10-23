<script lang="ts">
	import { ImageOff, Images } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import EmptyState from '../feedback/EmptyState.svelte';
	import Lightbox from './Lightbox.svelte';
	import { canRenderPreview, mediaAlt, mediaStateLabel, type MediaItem } from './types';

	/**
	 * Survey media grid (DESIGN §8.2, phase-2 §6).
	 *
	 * Tiles are 4:3, lazy-loaded and labelled. A metadata-only record (the
	 * normal case in the mock) shows a labelled placeholder — never a stock
	 * photo or a broken image. Clicking a tile opens the shared `Lightbox`
	 * unless the page passes its own `onselect`.
	 */
	interface Props {
		items: MediaItem[];
		/** Fixed column count from `md` up; the grid is 2-up on phones. */
		columns?: 2 | 3 | 4;
		onselect?: (item: MediaItem, index: number) => void;
		/** Set false when the page owns the viewer. */
		lightbox?: boolean;
		emptyTitle?: string;
		emptyDescription?: string;
		class?: string;
	}

	let {
		items,
		columns = 3,
		onselect,
		lightbox = true,
		emptyTitle = 'No media yet.',
		emptyDescription = 'Capture a photo or upload a plan to see it here.',
		class: className
	}: Props = $props();

	let viewerOpen = $state(false);
	let activeIndex = $state(0);

	const columnClass = $derived(
		columns === 2 ? 'md:grid-cols-2' : columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'
	);

	function select(item: MediaItem, index: number): void {
		if (onselect) {
			onselect(item, index);
			return;
		}
		if (!lightbox) return;
		activeIndex = index;
		viewerOpen = true;
	}
</script>

{#if items.length === 0}
	<EmptyState title={emptyTitle} description={emptyDescription}>
		{#snippet icon()}
			<Images size={24} strokeWidth={1.75} aria-hidden="true" />
		{/snippet}
	</EmptyState>
{:else}
	<ul class={cn('grid grid-cols-2 gap-3', columnClass, className)}>
		{#each items as item, index (item.id)}
			<li class="min-w-0">
				<button
					type="button"
					onclick={() => select(item, index)}
					class="group flex w-full touch-manipulation flex-col gap-2 rounded-lg text-start"
					aria-label={`Open ${item.caption?.trim() || item.fileName}`}
				>
					<span
						class="media-thumb relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-hairline bg-canvas-nested"
					>
						{#if canRenderPreview(item.previewUrl) && item.mimeType.startsWith('image/')}
							<img
								src={item.previewUrl}
								alt={mediaAlt(item)}
								loading="lazy"
								class="size-full object-cover"
							/>
						{:else}
							<span class="flex flex-col items-center gap-1 p-3 text-center">
								<ImageOff
									size={24}
									strokeWidth={1.5}
									aria-hidden="true"
									class="text-ink-tertiary"
								/>
								<span class="text-caption text-ink-secondary">No preview</span>
							</span>
						{/if}
					</span>

					<span class="flex min-w-0 flex-col gap-1">
						<span class="line-clamp-2 text-footnote text-ink">
							{item.caption?.trim() || item.fileName}
						</span>
						<span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
							{#if item.ownerLabel}
								<span class="text-ink-tertiary">{item.ownerLabel}</span>
							{/if}
							{#if item.uploadState}
								<span
									class={cn(
										item.uploadState === 'failed' ? 'text-critical-ink' : 'text-ink-secondary'
									)}
								>
									{mediaStateLabel(item.uploadState)}
								</span>
							{/if}
						</span>
					</span>
				</button>
			</li>
		{/each}
	</ul>

	{#if lightbox && !onselect}
		<Lightbox bind:open={viewerOpen} bind:index={activeIndex} {items} />
	{/if}
{/if}

<style>
	.media-thumb {
		aspect-ratio: 4 / 3;
	}
</style>
