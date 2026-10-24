<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CircleAlert } from '@lucide/svelte';
	import Button from '../button/Button.svelte';
	import Sheet from './Sheet.svelte';

	/**
	 * Side-panel form for quick edits to a table row (DESIGN §9.3 "Sheet",
	 * phase-3 §4.2). The panel owns the form semantics and the sticky footer;
	 * the page owns the fields, validation and the save request.
	 */
	interface Props {
		open?: boolean;
		title: string;
		description?: string;
		submitLabel?: string;
		saving?: boolean;
		error?: string | null;
		onsave: () => void;
		onclose: () => void;
		children: Snippet;
		class?: string;
	}

	let {
		open = $bindable(false),
		title,
		description,
		submitLabel = 'Save changes',
		saving = false,
		error = null,
		onsave,
		onclose,
		children,
		class: className
	}: Props = $props();

	const uid = $props.id();
	const formId = `${uid}-form`;

	function handleSubmit(event: SubmitEvent): void {
		event.preventDefault();
		if (saving) return;
		onsave();
	}

	function cancel(): void {
		if (saving) return;
		open = false;
		onclose();
	}
</script>

{#snippet footer()}
	<Button variant="secondary" onclick={cancel} disabled={saving}>Cancel</Button>
	<Button variant="primary" type="submit" form={formId} loading={saving} loadingLabel="Saving…">
		{submitLabel}
	</Button>
{/snippet}

<Sheet bind:open side="end" {title} {description} {onclose} {footer} class={className}>
	<form id={formId} class="flex flex-col gap-5" onsubmit={handleSubmit} novalidate>
		{#if error}
			<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-1 shrink-0" />
				<span>{error}</span>
			</p>
		{/if}

		{@render children()}
	</form>
</Sheet>
