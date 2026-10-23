<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CircleAlert } from '@lucide/svelte';

	/**
	 * Visible label, hint and error wrapper for a custom control (DESIGN §9.3).
	 * The control itself is passed as children; the caller wires
	 * `aria-describedby` to `${forId}-hint` / `${forId}-error` because only the
	 * caller knows the control's id.
	 */
	interface Props {
		label: string;
		forId: string;
		hint?: string;
		error?: string | null;
		required?: boolean;
		children: Snippet;
	}

	let { label, forId, hint, error, required = false, children }: Props = $props();

	const hintId = $derived(`${forId}-hint`);
	const errorId = $derived(`${forId}-error`);
</script>

<div class="flex flex-col gap-2">
	<label for={forId} class="text-subheadline text-ink">
		{label}{#if required}<span class="text-footnote text-ink-tertiary"> (required)</span>{/if}
	</label>

	{@render children()}

	{#if hint && !error}
		<p id={hintId} class="text-footnote text-ink-secondary">{hint}</p>
	{/if}

	{#if error}
		<p id={errorId} role="alert" class="flex items-start gap-1 text-footnote text-critical-ink">
			<CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" class="mt-1 shrink-0" />
			<span>{error}</span>
		</p>
	{/if}
</div>
