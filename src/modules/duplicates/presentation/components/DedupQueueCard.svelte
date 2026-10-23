<script lang="ts">
	import { resolve } from '$app/paths';
	import { TriangleAlert } from '@lucide/svelte';
	import type { AuditTrailRow } from '$shared/domain/audit';
	import type { DedupEntityType } from '$shared/domain/dedup';
	import { formatCount, formatDate } from '$shared/lib/format';
	import {
		AuditTrailTab,
		Badge,
		Button,
		EntityLink,
		KeyValueGrid,
		PermissionGate,
		StateChip
	} from '$shared/presentation/ui';
	import type { DedupQueueItem } from '../../domain/types';

	/**
	 * One held `pending_review` row (phase-1 §1.4): identity, state, candidate
	 * count, a short field summary and the three review actions. The page owns
	 * loading, the review modal and the audit cache; this card only renders and
	 * reports intent.
	 */
	interface Props {
		item: DedupQueueItem;
		permission: string;
		auditOpen: boolean;
		auditLoading: boolean;
		auditError: string | null;
		auditRows: AuditTrailRow[];
		onreview: (item: DedupQueueItem) => void;
		ontogglehistory: (item: DedupQueueItem) => void;
	}

	let {
		item,
		permission,
		auditOpen,
		auditLoading,
		auditError,
		auditRows,
		onreview,
		ontogglehistory
	}: Props = $props();

	const uid = $props.id();
	const headingId = `${uid}-title`;
	const historyId = `${uid}-history`;

	const ENTITY_LABELS: Readonly<Record<DedupEntityType, string>> = Object.freeze({
		customer: 'Customer',
		property: 'Property',
		project: 'Project'
	});

	/** Hrefs are resolved here because only the feature knows its own routes. */
	function recordHref(type: DedupEntityType, id: string): string {
		switch (type) {
			case 'customer':
				return resolve(`/customers/${id}`);
			case 'property':
				return resolve(`/properties/${id}`);
			case 'project':
				return resolve(`/projects/${id}`);
		}
	}

	/** 3–4 key facts; the caption is already the heading. */
	const summaryItems = $derived(
		item.held.fields
			.filter((field) => field.label !== 'Caption' && field.label !== 'Address line 1')
			.slice(0, 3)
			.map((field) => ({ label: field.label, value: field.value }))
	);

	const candidateLabel = $derived(
		item.candidates.length === 0
			? 'No possible matches'
			: `${formatCount(item.candidates.length)} possible ${item.candidates.length === 1 ? 'match' : 'matches'}`
	);
</script>

{#snippet reviewFallback()}
	<p class="text-footnote text-ink-secondary">
		You can view this record but not review it. Ask an administrator for update permission on
		{ENTITY_LABELS[item.held.entityType].toLowerCase()} records.
	</p>
{/snippet}

<article
	class="flex min-w-0 flex-col gap-4 rounded-lg border border-hairline bg-canvas p-4 md:p-5"
	aria-labelledby={headingId}
>
	<div class="flex min-w-0 flex-col gap-2">
		<div class="flex flex-wrap items-center gap-2">
			<Badge label={ENTITY_LABELS[item.held.entityType]} />
			<StateChip entity={item.held.entityType} state={item.held.state} />
		</div>

		<h2 id={headingId} class="text-title-3 break-words text-ink">{item.held.caption}</h2>

		<p class="text-footnote text-ink-secondary">
			Created
			<time datetime={item.held.createdAt}>{formatDate(item.held.createdAt)}</time>
			<span aria-hidden="true">·</span>
			<span>{candidateLabel}</span>
		</p>
	</div>

	{#if item.candidates.length === 0}
		<p class="flex items-start gap-2 text-callout text-caution-ink">
			<TriangleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
			<span>No matching record was found. Confirm this record is distinct.</span>
		</p>
	{/if}

	<KeyValueGrid items={summaryItems} columns={3} />

	<div class="flex flex-wrap items-center gap-2">
		<PermissionGate {permission} fallback={reviewFallback}>
			<Button
				variant="secondary"
				aria-label={`Review ${item.held.caption}`}
				onclick={() => onreview(item)}
			>
				Review
			</Button>
		</PermissionGate>

		<Button
			variant="tertiary"
			aria-expanded={auditOpen}
			aria-controls={historyId}
			aria-label={`History for ${item.held.caption}`}
			onclick={() => ontogglehistory(item)}
		>
			History
		</Button>

		<EntityLink
			href={recordHref(item.held.entityType, item.held.id)}
			class="inline-flex min-h-target min-w-target items-center"
		>
			Open record<span class="sr-only"> for {item.held.caption}</span>
		</EntityLink>
	</div>

	{#if auditOpen}
		<div id={historyId} class="flex min-w-0 flex-col gap-2 border-t border-hairline pt-4">
			<p class="text-subheadline text-ink">History</p>
			<AuditTrailTab
				rows={auditRows}
				loading={auditLoading}
				error={auditError}
				emptyLabel="No activity recorded for this record yet."
			/>
		</div>
	{/if}
</article>
