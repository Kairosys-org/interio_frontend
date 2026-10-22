<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import IconButton from '../button/IconButton.svelte';

	/**
	 * Bottom sheet on phones, side panel on desktop (DESIGN §9.3).
	 *
	 * Native `<dialog>` supplies the modal behaviour, background inerting and
	 * return focus. The explicit Tab trap, Escape handling and scroll lock live
	 * here for deterministic keyboard behaviour.
	 */
	interface Props {
		open?: boolean;
		title: string;
		description?: string;
		footer?: Snippet;
		side?: 'bottom' | 'end';
		onclose?: () => void;
		children: Snippet;
		class?: string;
	}

	let {
		open = $bindable(false),
		title,
		description,
		footer,
		side = 'bottom',
		onclose,
		children,
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
	class={cn('sheet-shell material', side === 'bottom' ? 'sheet-bottom' : 'sheet-end', className)}
	aria-labelledby={titleId}
	aria-describedby={description ? descriptionId : undefined}
	onkeydown={handleKeydown}
	oncancel={handleCancel}
	onclose={handleNativeClose}
	onclick={handleBackdropClick}
>
	<div class="sheet-layout flex min-h-0 flex-col">
		<header class="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
			<div class="flex min-w-0 flex-col gap-1">
				<h2 id={titleId} class="text-title-3 text-ink">{title}</h2>
				{#if description}
					<p id={descriptionId} class="text-callout text-ink-secondary">{description}</p>
				{/if}
			</div>
			<IconButton label="Close" onclick={requestClose} class="-me-2 -mt-2 shrink-0">
				{#snippet icon()}
					<X size={20} aria-hidden="true" />
				{/snippet}
			</IconButton>
		</header>

		<div class="sheet-content min-h-0 overflow-y-auto px-6 pb-6 text-body text-ink">
			{@render children()}
		</div>

		{#if footer}
			<footer
				class="flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-6 py-4"
			>
				{@render footer()}
			</footer>
		{/if}
	</div>
</dialog>

<style>
	/*
	 * Documented exception (DESIGN §9.3): sheet widths are component-scoped
	 * custom properties, never arbitrary utilities.
	 */
	.sheet-shell {
		--sheet-width: 28rem;
		--sheet-panel-width: 44rem;

		padding: 0;
		overflow: hidden;
		border: 0;
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-4);
	}

	.sheet-layout {
		max-height: inherit;
	}

	.sheet-shell::backdrop {
		background: color-mix(in oklab, var(--color-text-primary) 32%, transparent);
	}

	/* Phones: anchored to the bottom edge, full width, top corners only. */
	.sheet-bottom {
		inset-block-start: auto;
		inset-block-end: 0;
		margin: 0 auto;
		width: 100%;
		max-width: 100%;
		max-height: calc(100dvh - var(--spacing-8));
		border-start-start-radius: var(--radius-xl);
		border-start-end-radius: var(--radius-xl);
		border-end-start-radius: 0;
		border-end-end-radius: 0;
	}

	.sheet-bottom .sheet-layout {
		padding-block-end: env(safe-area-inset-bottom);
	}

	/* Desktop: the bottom sheet becomes a centred, bottom-anchored panel. */
	@media (min-width: 64rem) {
		.sheet-bottom {
			max-width: var(--sheet-panel-width);
			margin-block-end: var(--spacing-6);
			border-end-start-radius: var(--radius-xl);
			border-end-end-radius: var(--radius-xl);
		}
	}

	/* Desktop side panel; full width on phones. */
	.sheet-end {
		inset-block: 0;
		inset-inline-start: auto;
		inset-inline-end: 0;
		margin: 0;
		width: min(var(--sheet-width), 100dvw);
		height: 100dvh;
		max-height: 100dvh;
		border-start-start-radius: var(--radius-xl);
		border-end-start-radius: var(--radius-xl);
	}

	.sheet-end .sheet-layout {
		height: 100%;
		padding-block-end: env(safe-area-inset-bottom);
	}

	@media (prefers-reduced-motion: no-preference) {
		.sheet-bottom[open] {
			animation: sheet-up var(--motion-overlay) var(--ease-enter);
		}

		.sheet-end[open] {
			animation: sheet-in var(--motion-overlay) var(--ease-enter);
		}

		.sheet-shell[open]::backdrop {
			animation: sheet-backdrop-enter var(--motion-standard) var(--ease-standard);
		}

		@keyframes sheet-up {
			from {
				opacity: 0;
				transform: translateY(100%);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}

		@keyframes sheet-in {
			from {
				opacity: 0;
				transform: translateX(100%);
			}
			to {
				opacity: 1;
				transform: translateX(0);
			}
		}

		@keyframes sheet-backdrop-enter {
			from {
				opacity: 0;
			}
			to {
				opacity: 1;
			}
		}
	}
</style>
