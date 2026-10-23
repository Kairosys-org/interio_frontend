<script lang="ts">
	import { ShieldAlert, ShieldCheck } from '@lucide/svelte';
	import { Badge } from '$shared/presentation/ui';

	/**
	 * Manufacturing-critical marker (DESIGN §9.2, Part 9 §10).
	 *
	 * The state is always spelled out: colour is a second carrier only. A
	 * verified critical row names its method through `MeasurementRow`, so this
	 * chip only has to answer "does G8 include this row?".
	 */
	interface Props {
		critical: boolean;
		verified?: boolean;
	}

	let { critical, verified = false }: Props = $props();
</script>

{#if critical}
	<span class="inline-flex items-center gap-1">
		{#if verified}
			<ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true" class="text-safe-ink" />
		{:else}
			<ShieldAlert size={14} strokeWidth={1.75} aria-hidden="true" class="text-caution-ink" />
		{/if}
		<Badge
			label={verified ? 'Critical · verified' : 'Critical · unverified'}
			tone={verified ? 'success' : 'warning'}
		/>
	</span>
{:else}
	<Badge label="Standard" tone="neutral" />
{/if}
