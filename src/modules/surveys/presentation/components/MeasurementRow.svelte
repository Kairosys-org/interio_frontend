<script lang="ts">
	import { formatDateTime, formatDimension } from '$shared/lib/format';
	import { Badge, Button } from '$shared/presentation/ui';
	import type { SurveyMeasurement } from '../../domain/types';
	import { measurementTargetLabel, sourceLabel, verificationMethodLabel } from '../survey-labels';
	import CriticalBadge from './CriticalBadge.svelte';

	/**
	 * One measurement in a read list (Part 9 §10): value first, then its
	 * provenance, then the critical/verification state. Not interactive on its
	 * own; the verify workstation owns the action.
	 */
	interface Props {
		measurement: SurveyMeasurement;
		roomCaption?: string | null;
		/** Offered only where the page has a verify action to give. */
		onverify?: (measurement: SurveyMeasurement) => void;
		canVerify?: boolean;
	}

	let { measurement, roomCaption = null, onverify, canVerify = false }: Props = $props();

	const verified = $derived(measurement.verifiedAt !== null);
</script>

<li
	class="flex flex-col gap-3 border-t border-hairline py-3 first:border-t-0 first:pt-0"
	data-testid="measurement-row"
>
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="flex min-w-0 flex-col gap-1">
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-callout break-words text-ink">{measurementTargetLabel(measurement)}</span>
				<CriticalBadge critical={measurement.isManufacturingCritical} {verified} />
			</div>

			<p class="text-footnote text-ink-secondary">
				{#if roomCaption}
					{roomCaption} ·
				{/if}
				{sourceLabel(measurement.source)}
				{#if measurement.deviceInfo}
					({measurement.deviceInfo})
				{/if}
				· captured {formatDateTime(measurement.capturedAt)}
			</p>

			{#if verified}
				<p class="text-footnote text-safe-ink">
					Verified with {verificationMethodLabel(measurement.verificationMethod)}
					{#if measurement.verifiedAt}
						on {formatDateTime(measurement.verifiedAt)}
					{/if}
					{#if measurement.verificationNote}
						· {measurement.verificationNote}
					{/if}
				</p>
			{:else if measurement.isManufacturingCritical}
				<p class="text-footnote text-caution-ink">
					Needs verification before this survey can be verified.
				</p>
			{/if}
		</div>

		<div class="flex shrink-0 flex-col items-end gap-2">
			<span class="text-callout text-ink tabular-nums">{formatDimension(measurement.valueMm)}</span>
			{#if canVerify && onverify && measurement.isManufacturingCritical && !verified}
				<Button variant="secondary" onclick={() => onverify(measurement)}>Verify</Button>
			{:else if measurement.isManufacturingCritical && verified}
				<Badge label="Cleared by G8" tone="success" />
			{/if}
		</div>
	</div>
</li>
