<script lang="ts">
	import { cn } from '$lib/utils';

	/**
	 * Read-only access notes on the property record (DESIGN §10.2 Detail hub).
	 *
	 * Notes are typed as free text, so line breaks are meaningful to the
	 * surveyor: they are preserved with `white-space: pre-line` instead of
	 * collapsing into one paragraph. No editing control lives here.
	 */
	interface Props {
		value: string | null;
		class?: string;
	}

	let { value, class: className }: Props = $props();

	const notes = $derived(value?.trim() ?? '');
</script>

{#if notes === ''}
	<p class={cn('text-callout text-ink-secondary', className)}>No access notes yet.</p>
{:else}
	<p class={cn('text-callout break-words whitespace-pre-line text-ink', className)}>{notes}</p>
{/if}
