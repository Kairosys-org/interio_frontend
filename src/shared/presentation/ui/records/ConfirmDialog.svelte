<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CircleAlert } from '@lucide/svelte';
	import Button from '../button/Button.svelte';
	import Dialog from '../overlay/Dialog.svelte';

	/**
	 * Two-choice confirmation for an irreversible action (DESIGN §9.3). The
	 * safe choice is the default: Cancel is the first focusable control and
	 * Escape closes the dialog.
	 */
	interface Props {
		open?: boolean;
		title: string;
		description: string;
		confirmLabel: string;
		destructive?: boolean;
		loading?: boolean;
		error?: string | null;
		onconfirm: () => void | Promise<void>;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel,
		destructive = false,
		loading = false,
		error = null,
		onconfirm,
		children
	}: Props = $props();

	let pending = $state(false);
	let localError = $state<string | null>(null);

	const busy = $derived(loading || pending);
	const shownError = $derived(error ?? localError);

	function close(): void {
		if (busy) return;
		localError = null;
		open = false;
	}

	async function handleConfirm(): Promise<void> {
		if (busy) return;
		localError = null;
		pending = true;
		try {
			await onconfirm();
			open = false;
		} catch {
			localError = 'We could not save this change. Try again.';
		} finally {
			pending = false;
		}
	}
</script>

<Dialog
	bind:open
	{title}
	{description}
	onclose={() => {
		localError = null;
	}}
>
	{#if children}
		<div class="flex flex-col gap-4">
			{@render children()}
		</div>
	{/if}

	{#if shownError}
		<p class="mt-4 flex items-start gap-2 text-callout text-critical-ink" role="alert">
			<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
			<span>{shownError}</span>
		</p>
	{/if}

	{#snippet footer()}
		<Button variant="secondary" onclick={close} disabled={busy}>Cancel</Button>
		<Button
			variant={destructive ? 'destructive' : 'primary'}
			onclick={handleConfirm}
			loading={busy}
			loadingLabel="Saving…"
		>
			{confirmLabel}
		</Button>
	{/snippet}
</Dialog>
