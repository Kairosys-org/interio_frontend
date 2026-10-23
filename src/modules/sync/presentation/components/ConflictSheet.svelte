<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { Button, Dialog } from '$shared/presentation/ui';
	import type {
		ResolveConflictInput,
		SyncEntity,
		SyncOp,
		SyncOperation
	} from '$modules/sync/domain/types';
	import { formatDateTime } from '$shared/lib/format';

	/**
	 * Conflict resolution (phase-2 §6, Q10).
	 *
	 * The server value always wins unless the user explicitly re-applies their
	 * own field values. Both sides are shown field by field, with the same
	 * labels used everywhere else, and nothing is merged silently.
	 */
	interface Props {
		open?: boolean;
		operation: SyncOperation | null;
		saving?: boolean;
		error?: string | null;
		onresolve: (input: ResolveConflictInput) => void | Promise<void>;
	}

	let {
		open = $bindable(false),
		operation,
		saving = false,
		error = null,
		onresolve
	}: Props = $props();

	const ENTITY_LABELS: Readonly<Record<SyncEntity, string>> = Object.freeze({
		survey: 'Survey',
		room: 'Room',
		wall: 'Wall',
		opening: 'Opening',
		utility: 'Utility',
		obstacle: 'Obstacle',
		measurement: 'Measurement',
		note: 'Note',
		asset: 'Evidence file'
	});

	const OP_LABELS: Readonly<Record<SyncOp, string>> = Object.freeze({
		create: 'New record',
		update: 'Edit',
		transition: 'Status change',
		verify: 'Verification',
		revision: 'Note revision',
		asset_state: 'Upload state'
	});

	const FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
		valueMm: 'Reading (mm)',
		caption: 'Caption',
		surveyRoomId: 'Room',
		surveyWallId: 'Wall',
		surveyOpeningId: 'Opening',
		targetType: 'Measurement kind',
		targetCaption: 'Custom name',
		source: 'Source',
		deviceInfo: 'Device or file',
		uploadState: 'Upload state',
		status: 'Status',
		body: 'Note',
		category: 'Category',
		roomType: 'Room type',
		ceilingHeightMm: 'Ceiling height (mm)',
		roomLengthMm: 'Length (mm)',
		roomWidthMm: 'Width (mm)',
		lengthMm: 'Length (mm)',
		heightMm: 'Height (mm)',
		widthMm: 'Width (mm)',
		openingType: 'Opening type',
		sillHeightMm: 'Sill height (mm)',
		swingDirection: 'Swing',
		rejectedReason: 'Rejection reason'
	});

	const conflict = $derived(operation?.conflict ?? null);
	const fields = $derived(conflict?.fields ?? []);

	function fieldLabel(field: string): string {
		return (
			FIELD_LABELS[field] ?? field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
		);
	}

	function displayValue(value: unknown): string {
		if (value === null || value === undefined || value === '') return 'Not set';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		if (typeof value === 'number') return String(value);
		if (typeof value === 'string') return value;
		return JSON.stringify(value);
	}

	const description = $derived(
		operation
			? `${ENTITY_LABELS[operation.entity]} · ${OP_LABELS[operation.op]} from ${formatDateTime(operation.createdAt)}`
			: 'This record changed on the server.'
	);
</script>

{#snippet footer()}
	<Button variant="secondary" onclick={() => (open = false)} disabled={saving}>Close</Button>
	<Button
		variant="primary"
		onclick={() => onresolve({ decision: 'reapply_local' })}
		loading={saving}
		loadingLabel="Re-applying…"
	>
		Re-apply my change
	</Button>
{/snippet}

<Dialog
	bind:open
	title="This record changed on the server"
	{description}
	{footer}
	onclose={() => {
		/* The page owns the error and keeps the sheet honest on reopen. */
	}}
>
	{#if conflict}
		<div class="flex flex-col gap-4">
			<p
				class="flex items-start gap-2 rounded-lg border border-caution bg-caution-soft p-3 text-footnote text-caution-ink"
			>
				<CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>
					The server version is kept. Nothing is merged silently; re-apply only if your values are
					still right.
				</span>
			</p>

			<table class="w-full border-collapse text-left">
				<caption class="sr-only">Server and local values for this record</caption>
				<thead>
					<tr>
						<th scope="col" class="border-b border-hairline pb-2 text-footnote text-ink-secondary">
							Field
						</th>
						<th scope="col" class="border-b border-hairline pb-2 text-footnote text-ink-secondary">
							Server (kept)
						</th>
						<th scope="col" class="border-b border-hairline pb-2 text-footnote text-ink-secondary">
							My change
						</th>
					</tr>
				</thead>
				<tbody>
					{#each fields as field (field)}
						<tr>
							<th
								scope="row"
								class="border-b border-hairline py-2 text-footnote break-words text-ink"
							>
								{fieldLabel(field)}
							</th>
							<td
								class="border-b border-hairline py-2 text-callout break-words text-ink tabular-nums"
							>
								{displayValue(conflict.server[field])}
							</td>
							<td
								class="border-b border-hairline py-2 text-callout break-words text-ink-secondary tabular-nums"
							>
								{displayValue(conflict.local[field])}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<p class="text-footnote text-ink-secondary">
				Server version recorded {formatDateTime(conflict.serverUpdatedAt)}.
			</p>

			{#if error}
				<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
					<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
					<span>{error}</span>
				</p>
			{/if}

			<Button
				variant="secondary"
				fullWidth
				disabled={saving}
				onclick={() => onresolve({ decision: 'accept_server' })}
			>
				Keep the server version
			</Button>
		</div>
	{:else}
		<p role="status" class="text-callout text-ink-secondary">
			This operation no longer has a conflict. Close the sheet and refresh.
		</p>
	{/if}
</Dialog>
