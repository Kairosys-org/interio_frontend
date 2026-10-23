<script lang="ts">
	import { CircleCheck, CloudOff, RefreshCw, TriangleAlert, UploadCloud } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	/**
	 * Mobile sync state (DESIGN §9.2, spec Part 9 §13).
	 *
	 * Icon + count + label on every state; the count changes inside a polite
	 * live region. When `href` is set the whole chip is the tap target that
	 * opens `/m/sync`; otherwise it is a static readout.
	 */
	interface Props {
		online: boolean;
		queued?: number;
		conflicts?: number;
		/** Uploads currently in flight, shown while the queue is draining. */
		uploading?: number;
		href?: string;
		class?: string;
	}

	let {
		online,
		queued = 0,
		conflicts = 0,
		uploading = 0,
		href,
		class: className
	}: Props = $props();

	type Tone = 'safe' | 'caution' | 'critical' | 'neutral';

	const state = $derived.by(() => {
		if (!online) {
			return {
				tone: 'caution' as Tone,
				label: queued > 0 ? `Offline · ${queued} queued` : 'Offline',
				Icon: CloudOff
			};
		}
		if (conflicts > 0) {
			return {
				tone: 'critical' as Tone,
				label: `${conflicts} ${conflicts === 1 ? 'conflict' : 'conflicts'}`,
				Icon: TriangleAlert
			};
		}
		if (uploading > 0) {
			return {
				tone: 'neutral' as Tone,
				label: `Syncing · ${uploading} uploading`,
				Icon: RefreshCw
			};
		}
		if (queued > 0) {
			return {
				tone: 'caution' as Tone,
				label: `${queued} queued`,
				Icon: UploadCloud
			};
		}
		return { tone: 'safe' as Tone, label: 'Synced', Icon: CircleCheck };
	});

	const TONE_CLASSES: Record<Tone, string> = {
		safe: 'bg-safe-soft text-safe-ink',
		caution: 'bg-caution-soft text-caution-ink',
		critical: 'bg-critical-soft text-critical-ink',
		neutral: 'bg-chip-neutral text-chip-neutral-ink'
	};

	const Icon = $derived(state.Icon);
	const linkAttributes = $derived({ href: href ?? '' });
</script>

{#snippet content()}
	<Icon
		size={16}
		strokeWidth={1.75}
		aria-hidden="true"
		class={cn(state.tone === 'neutral' && state.label.startsWith('Syncing') && 'sync-spin')}
	/>
	<span aria-live="polite">{state.label}</span>
{/snippet}

{#if href}
	<a
		{...linkAttributes}
		class={cn(
			'inline-flex min-h-target touch-manipulation items-center gap-2 rounded-full px-3 text-caption',
			TONE_CLASSES[state.tone],
			className
		)}
		data-testid="sync-status-chip"
	>
		{@render content()}
	</a>
{:else}
	<span
		class={cn(
			'inline-flex min-h-target items-center gap-2 rounded-full px-3 text-caption',
			TONE_CLASSES[state.tone],
			className
		)}
		data-testid="sync-status-chip"
	>
		{@render content()}
	</span>
{/if}

<style>
	@media (prefers-reduced-motion: no-preference) {
		.sync-spin {
			animation: sync-spin calc(var(--motion-page) * 2) linear infinite;
		}

		@keyframes sync-spin {
			to {
				transform: rotate(1turn);
			}
		}
	}
</style>
