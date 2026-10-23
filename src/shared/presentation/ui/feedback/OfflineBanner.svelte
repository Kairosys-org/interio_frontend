<script lang="ts">
	import { CloudOff } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	/**
	 * Persistent offline notice (DESIGN §13.4, spec Part 9 §13).
	 *
	 * Copy is fixed by DESIGN: "You are offline. Changes are saved on this
	 * device and will sync when you reconnect." The queued count is optional
	 * and announced politely. Render it at the top of the mobile shell so it is
	 * impossible to miss.
	 */
	interface Props {
		online: boolean;
		queued?: number;
		class?: string;
	}

	let { online, queued = 0, class: className }: Props = $props();
</script>

{#if !online}
	<div
		role="status"
		aria-live="polite"
		data-testid="offline-banner"
		class={cn(
			'flex items-start gap-2 border-b border-hairline bg-caution-soft px-4 py-3 text-caution-ink',
			className
		)}
	>
		<CloudOff size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
		<div class="flex min-w-0 flex-col gap-1">
			<p class="text-footnote">
				You are offline. Changes are saved on this device and will sync when you reconnect.
			</p>
			{#if queued > 0}
				<p class="text-caption">
					{queued}
					{queued === 1 ? 'change is' : 'changes are'} waiting to sync.
				</p>
			{/if}
		</div>
	</div>
{/if}
