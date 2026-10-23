<script lang="ts">
	import { ChevronLeft, ChevronRight, FileText, ImageOff, X } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import { formatFileSize } from '$shared/lib/format';
	import IconButton from '../button/IconButton.svelte';
	import { canRenderPreview, mediaAlt, mediaStateLabel, type MediaItem } from './types';

	/**
	 * Full-screen media viewer (DESIGN §8.2).
	 *
	 * A native modal `<dialog>` supplies backdrop, inerting and return focus.
	 * Arrow keys move between files; the count and the file name are always
	 * text, and a non-renderable mock URL shows a labelled placeholder instead
	 * of a broken image.
	 */
	interface Props {
		open?: boolean;
		items: MediaItem[];
		index?: number;
		onclose?: () => void;
		class?: string;
	}

	let {
		open = $bindable(false),
		items,
		index = $bindable(0),
		onclose,
		class: className
	}: Props = $props();

	const uid = $props.id();
	const titleId = `${uid}-title`;
	const descriptionId = `${uid}-description`;

	const FOCUSABLE_SELECTOR = [
		'a[href]',
		'button:not([disabled])',
		'input:not([disabled])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'[tabindex]:not([tabindex="-1"])'
	].join(',');

	let dialogEl = $state<HTMLDialogElement | null>(null);

	const current = $derived(items[index] ?? null);
	const hasPrevious = $derived(index > 0);
	const hasNext = $derived(index < items.length - 1);
	// Absolute storage URL: not an app route, so it is handed over as a group
	// rather than resolved with `$app/paths`.
	const openAttributes = $derived({
		href: current?.previewUrl ?? '',
		target: '_blank',
		rel: 'noreferrer'
	});

	$effect(() => {
		const dialog = dialogEl;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	$effect(() => {
		if (!open) return;
		const { body } = document;
		const previousOverflow = body.style.overflow;
		body.style.overflow = 'hidden';
		return () => {
			body.style.overflow = previousOverflow;
		};
	});

	$effect(() => {
		if (index < 0) index = 0;
		else if (index > items.length - 1) index = Math.max(0, items.length - 1);
	});

	function requestClose(): void {
		if (!open) return;
		open = false;
		onclose?.();
	}

	function handleCancel(event: Event): void {
		event.preventDefault();
		requestClose();
	}

	function handleNativeClose(): void {
		open = false;
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === dialogEl) requestClose();
	}

	function previous(): void {
		if (hasPrevious) index -= 1;
	}

	function next(): void {
		if (hasNext) index += 1;
	}

	function getFocusable(): HTMLElement[] {
		const dialog = dialogEl;
		if (!dialog) return [];
		return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			requestClose();
			return;
		}
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			previous();
			return;
		}
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			next();
			return;
		}
		if (event.key !== 'Tab') return;

		const focusable = getFocusable();
		const dialog = dialogEl;
		if (!dialog) return;

		if (focusable.length === 0) {
			event.preventDefault();
			dialog.focus();
			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (!first || !last) return;
		const active = document.activeElement;

		if (event.shiftKey) {
			if (active === first || !dialog.contains(active)) {
				event.preventDefault();
				last.focus();
			}
			return;
		}

		if (active === last || !dialog.contains(active)) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<dialog
	bind:this={dialogEl}
	class={cn('lightbox-shell material-solid', className)}
	aria-labelledby={titleId}
	aria-describedby={current?.caption ? descriptionId : undefined}
	onkeydown={handleKeydown}
	oncancel={handleCancel}
	onclose={handleNativeClose}
	onclick={handleBackdropClick}
>
	{#if current}
		<div class="lightbox-layout flex min-h-0 flex-col">
			<header class="flex items-start justify-between gap-4 px-4 pt-4 pb-2">
				<div class="flex min-w-0 flex-col gap-1">
					<h2 id={titleId} class="truncate text-title-3 text-ink">{current.fileName}</h2>
					<p class="text-footnote text-ink-secondary">
						{index + 1} of {items.length}
						{#if current.ownerLabel}
							· {current.ownerLabel}
						{/if}
					</p>
				</div>
				<IconButton label="Close" onclick={requestClose} class="-me-1 -mt-1 shrink-0">
					{#snippet icon()}
						<X size={20} aria-hidden="true" />
					{/snippet}
				</IconButton>
			</header>

			<div class="flex min-h-0 flex-1 items-center justify-center px-4">
				{#if canRenderPreview(current.previewUrl) && current.mimeType.startsWith('image/')}
					<img
						src={current.previewUrl}
						alt={mediaAlt(current)}
						class="lightbox-media max-w-full rounded-md object-contain"
					/>
				{:else if canRenderPreview(current.previewUrl)}
					<div class="flex flex-col items-center gap-3 p-8 text-center">
						<FileText size={40} strokeWidth={1.5} aria-hidden="true" class="text-ink-tertiary" />
						<p class="text-callout text-ink">This file opens in the storage viewer, not inline.</p>
						<a {...openAttributes} class="text-callout text-brand underline">
							Open {current.fileName} in a new tab
						</a>
					</div>
				{:else}
					<div
						class="flex w-full flex-col items-center gap-3 rounded-lg border border-hairline bg-canvas-nested p-8 text-center"
					>
						<ImageOff size={40} strokeWidth={1.5} aria-hidden="true" class="text-ink-tertiary" />
						<p class="text-callout text-ink">Preview unavailable</p>
						<p class="max-w-content-reading text-footnote text-ink-secondary">
							This demo record stores file metadata only, so there is no image to show. The signed
							link opens in the storage client in production.
						</p>
					</div>
				{/if}
			</div>

			<div class="flex flex-col gap-3 px-4 pb-4">
				{#if current.caption}
					<p id={descriptionId} class="text-callout text-ink">{current.caption}</p>
				{/if}
				<p class="text-footnote text-ink-secondary">
					{current.kind}
					· {current.mimeType}
					{#if current.sizeBytes !== undefined}
						· {formatFileSize(current.sizeBytes)}
					{/if}
					{#if current.uploadState}
						· {mediaStateLabel(current.uploadState)}
					{/if}
				</p>

				<div class="flex items-center justify-between gap-2">
					<IconButton label="Previous file" disabled={!hasPrevious} onclick={previous}>
						{#snippet icon()}
							<ChevronLeft size={20} aria-hidden="true" />
						{/snippet}
					</IconButton>
					<IconButton label="Next file" disabled={!hasNext} onclick={next}>
						{#snippet icon()}
							<ChevronRight size={20} aria-hidden="true" />
						{/snippet}
					</IconButton>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex flex-col gap-4 p-6">
			<p class="text-body text-ink">There are no files to show.</p>
			<IconButton label="Close" onclick={requestClose}>
				{#snippet icon()}
					<X size={20} aria-hidden="true" />
				{/snippet}
			</IconButton>
		</div>
	{/if}
</dialog>

<style>
	.lightbox-shell {
		width: min(64rem, calc(100dvw - var(--spacing-4) - var(--spacing-4)));
		max-height: calc(100dvh - var(--spacing-4) - var(--spacing-4));
		margin: auto;
		padding: 0;
		overflow: hidden;
		border: 0;
		border-radius: var(--radius-xl);
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-4);
	}

	.lightbox-shell::backdrop {
		background: color-mix(in oklab, var(--color-text-primary) 64%, transparent);
	}

	.lightbox-layout {
		max-height: inherit;
	}

	.lightbox-media {
		max-height: min(66dvh, 40rem);
	}

	@media (prefers-reduced-motion: no-preference) {
		.lightbox-shell[open] {
			animation: lightbox-enter var(--motion-standard) var(--ease-enter);
		}

		.lightbox-shell[open]::backdrop {
			animation: lightbox-backdrop-enter var(--motion-standard) var(--ease-standard);
		}

		@keyframes lightbox-enter {
			from {
				opacity: 0;
				transform: scale(0.98);
			}
			to {
				opacity: 1;
				transform: scale(1);
			}
		}

		@keyframes lightbox-backdrop-enter {
			from {
				opacity: 0;
			}
			to {
				opacity: 1;
			}
		}
	}
</style>
