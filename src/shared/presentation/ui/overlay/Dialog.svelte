<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import IconButton from '../button/IconButton.svelte';

	/**
	 * Short, focused task on top of the current page (DESIGN §9.3).
	 *
	 * Built on the native `<dialog>` element so the browser owns the modal
	 * backdrop, background inerting and return focus. We add an explicit Tab
	 * trap and body scroll lock on top, and mirror the open state to the
	 * `open` prop.
	 */
	interface Props {
		open?: boolean;
		title: string;
		description?: string;
		footer?: Snippet;
		size?: 'md' | 'lg';
		onclose?: () => void;
		children: Snippet;
		class?: string;
	}

	let {
		open = $bindable(false),
		title,
		description,
		footer,
		size = 'md',
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

	// Sync the prop with the native dialog's modal state.
	$effect(() => {
		const dialog = dialogEl;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	// Lock page scroll while the dialog is open; restore the previous value.
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
		// Escape is handled explicitly so the prop stays in sync.
		event.preventDefault();
		requestClose();
	}

	function handleNativeClose(): void {
		// Fires when the effect calls `close()` or the browser closes the dialog.
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
	class={cn('dialog-shell material', size === 'lg' && 'dialog-lg', className)}
	aria-labelledby={titleId}
	aria-describedby={description ? descriptionId : undefined}
	onkeydown={handleKeydown}
	oncancel={handleCancel}
	onclose={handleNativeClose}
	onclick={handleBackdropClick}
>
	<div class="dialog-layout flex flex-col">
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

		<div class="dialog-content min-h-0 overflow-y-auto px-6 pb-6 text-body text-ink">
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
	/* Documented exception (DESIGN §9.3): dialog widths live as local custom properties. */
	.dialog-shell {
		--dialog-width: 32rem;

		width: min(var(--dialog-width), calc(100dvw - var(--spacing-4) - var(--spacing-4)));
		max-height: calc(100dvh - var(--spacing-6) - var(--spacing-6));
		margin: auto;
		padding: 0;
		overflow: hidden;
		border: 0;
		border-radius: var(--radius-xl);
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-3);
	}

	.dialog-lg {
		--dialog-width: 44rem;
	}

	.dialog-layout {
		max-height: inherit;
	}

	.dialog-shell::backdrop {
		background: color-mix(in oklab, var(--color-text-primary) 32%, transparent);
	}

	@media (prefers-reduced-motion: no-preference) {
		.dialog-shell[open] {
			animation: dialog-enter var(--motion-standard) var(--ease-enter);
		}

		.dialog-shell[open]::backdrop {
			animation: dialog-backdrop-enter var(--motion-standard) var(--ease-standard);
		}

		@keyframes dialog-enter {
			from {
				opacity: 0;
				transform: scale(0.98);
			}
			to {
				opacity: 1;
				transform: scale(1);
			}
		}

		@keyframes dialog-backdrop-enter {
			from {
				opacity: 0;
			}
			to {
				opacity: 1;
			}
		}
	}
</style>
