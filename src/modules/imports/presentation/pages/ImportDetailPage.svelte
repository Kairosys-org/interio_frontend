<script lang="ts">
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import type { AuditTrailRow } from '$shared/domain/audit';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { isUuid } from '$shared/domain/uuid';
	import { formatCount, formatDateTime } from '$shared/lib/format';
	import { stateLabel } from '$shared/lib/status';
	import {
		AuditTrailTab,
		Breadcrumb,
		Button,
		ConfirmDialog,
		DetailSection,
		EmptyState,
		KeyValueGrid,
		PageHeader,
		PermissionGate,
		Skeleton,
		StateChip
	} from '$shared/presentation/ui';
	import { importsApi } from '../../data/api';
	import type { ImportBatch, ImportRowPage } from '../../domain/types';
	import { IMPORT_KIND_LABELS } from '../import-display';
	import RowOutcomesTable from '../components/RowOutcomesTable.svelte';

	/**
	 * `/imports/[id]` detail (phase-1 §3): header with state and counts, per-row
	 * outcomes, commit behind a counted confirmation, and the audit trail.
	 * Committed and cancelled batches are read-only.
	 */
	interface Props {
		importId: string;
	}

	let { importId }: Props = $props();

	const ROW_PAGE_SIZE = 20;

	let batch = $state<ImportBatch | null>(null);
	let initialRows = $state<ImportRowPage | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let requestSequence = 0;

	let auditRows = $state<AuditTrailRow[]>([]);
	let auditLoading = $state(false);
	let auditError = $state<string | null>(null);
	let auditSequence = 0;

	let commitOpen = $state(false);
	let committing = $state(false);
	let commitError = $state<string | null>(null);
	let commitAnnouncement = $state('');
	let reloadToken = $state(0);

	const validId = $derived(isUuid(importId));
	const importsHref = resolve('/imports');

	const breadcrumb = $derived([
		{ label: 'Imports', href: importsHref },
		{ label: batch?.fileName ?? 'Import' }
	]);

	const detailItems = $derived.by((): Array<{ label: string; value: string | null }> => {
		if (!batch) return [];
		return [
			{ label: 'Kind', value: IMPORT_KIND_LABELS[batch.kind] },
			{ label: 'Status', value: stateLabel(batch.status) },
			{ label: 'Rows', value: formatCount(batch.totalRows) },
			{
				label: batch.status === 'staged' ? 'Ready to create' : 'Created',
				value: formatCount(batch.status === 'staged' ? batch.readyRows : batch.importedRows)
			},
			{ label: 'Held for review', value: formatCount(batch.reviewRows) },
			{ label: 'Rejected', value: formatCount(batch.rejectedRows) },
			{ label: 'Mapped columns', value: formatCount(Object.keys(batch.columnMap).length) },
			{ label: 'Created', value: formatDateTime(batch.createdAt) },
			{ label: 'Committed', value: batch.committedAt ? formatDateTime(batch.committedAt) : null }
		];
	});

	const commitDescription = $derived.by(() => {
		const create = batch?.readyRows ?? 0;
		const hold = batch?.reviewRows ?? 0;
		const skip = batch?.rejectedRows ?? 0;
		return `Create ${plural(create, 'record')}, hold ${plural(hold, 'row')} for review, skip ${plural(
			skip,
			'rejected row',
			'rejected rows'
		)}. This cannot be undone.`;
	});

	function plural(value: number, singular: string, pluralWord = `${singular}s`): string {
		return `${formatCount(value)} ${value === 1 ? singular : pluralWord}`;
	}

	$effect(() => {
		const id = importId;

		if (!isUuid(id)) {
			requestSequence += 1;
			loading = false;
			batch = null;
			initialRows = null;
			notFound = true;
			error = null;
			return;
		}

		void load(id);
	});

	async function load(id: string): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;
		notFound = false;

		try {
			const [batchResult, rowsResult] = await Promise.all([
				importsApi.get(id),
				importsApi.rows(id, { page: 1, pageSize: ROW_PAGE_SIZE, result: 'all' })
			]);
			if (sequence !== requestSequence) return;

			batch = batchResult;
			initialRows = rowsResult;
			void loadAudit(id);
		} catch (caught) {
			if (sequence !== requestSequence) return;
			batch = null;
			initialRows = null;
			if (isApiError(caught) && caught.isNotFound()) {
				notFound = true;
			} else {
				error = isApiError(caught) ? caught.message : 'We could not load this import. Try again.';
			}
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	async function loadAudit(id: string): Promise<void> {
		const sequence = ++auditSequence;
		auditLoading = true;
		auditError = null;

		try {
			const rows = await importsApi.audit(id);
			if (sequence !== auditSequence) return;
			auditRows = rows;
		} catch (caught) {
			if (sequence !== auditSequence) return;
			auditRows = [];
			auditError = isApiError(caught)
				? caught.message
				: 'We could not load the activity trail. Try again.';
		} finally {
			if (sequence === auditSequence) auditLoading = false;
		}
	}

	async function commit(): Promise<void> {
		if (committing) return;
		committing = true;
		commitError = null;

		try {
			const result = await importsApi.commit(importId);
			batch = result.batch;
			reloadToken += 1;

			const summary = `${plural(result.created, 'record')} created, ${plural(
				result.held,
				'row'
			)} held for review, ${plural(result.rejected, 'row')} rejected.`;
			commitAnnouncement = `Import committed. ${summary}`;
			toast.success('Import committed.', { description: summary });
			void loadAudit(importId);
		} catch (caught) {
			commitError = isApiError(caught)
				? caught.message
				: 'We could not commit this import. Try again.';
			throw caught;
		} finally {
			committing = false;
		}
	}

	function openCommit(): void {
		commitError = null;
		commitOpen = true;
	}

	function retry(): void {
		void load(importId);
	}

	function retryAudit(): void {
		void loadAudit(importId);
	}
</script>

<svelte:head>
	<title>{batch ? `${batch.fileName} · Interio` : 'Import · Interio'}</title>
</svelte:head>

{#if !validId}
	<h1 class="sr-only">Import not found</h1>
	<EmptyState
		title="Import not found."
		description="This batch does not exist or is no longer available."
	>
		{#snippet action()}
			<a
				href={importsHref}
				class="inline-flex min-h-target min-w-target items-center justify-center rounded-md bg-brand px-4 text-subheadline text-on-brand hover:bg-brand-hover"
			>
				Back to imports
			</a>
		{/snippet}
	</EmptyState>
{:else if loading}
	<div class="flex flex-col gap-6" aria-busy="true" aria-label="Loading import">
		<h1 class="sr-only">Loading import</h1>
		<Skeleton lines={1} class="max-w-content-reading" />
		<Skeleton variant="block" />
		<Skeleton variant="block" />
	</div>
{:else if notFound}
	<h1 class="sr-only">Import not found</h1>
	<EmptyState
		title="Import not found."
		description="This batch does not exist or is no longer available."
	>
		{#snippet action()}
			<a
				href={importsHref}
				class="inline-flex min-h-target min-w-target items-center justify-center rounded-md bg-brand px-4 text-subheadline text-on-brand hover:bg-brand-hover"
			>
				Back to imports
			</a>
		{/snippet}
	</EmptyState>
{:else if error || !batch}
	<h1 class="sr-only">Import</h1>
	<EmptyState title="We could not load this import." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={retry}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else if batch}
	{@const loadedBatch = batch}
	<Breadcrumb items={breadcrumb} class="pb-4" />

	<PageHeader
		title={loadedBatch.fileName}
		description={`${IMPORT_KIND_LABELS[loadedBatch.kind]} import · ${formatCount(loadedBatch.totalRows)} rows`}
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<StateChip entity="import_batch" state={loadedBatch.status} />

				{#if loadedBatch.status === 'staged'}
					<PermissionGate permission={PERMISSIONS.IMPORT_CREATE}>
						<Button variant="primary" onclick={openCommit}>Commit import</Button>
					</PermissionGate>
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<div class="mt-8 flex flex-col gap-4">
		{#if loadedBatch.status !== 'staged'}
			<p
				class="rounded-lg border border-hairline bg-canvas-grouped p-4 text-callout text-ink-secondary"
			>
				{loadedBatch.status === 'committed'
					? 'This batch is committed and read-only. The records it created are listed below.'
					: 'This batch was cancelled and is read-only. No records were created.'}
			</p>
		{/if}

		{#if commitAnnouncement}
			<p class="sr-only" role="status" aria-live="polite">{commitAnnouncement}</p>
		{/if}

		<DetailSection
			title="Summary"
			description="What this batch contains and what has happened to it."
		>
			<KeyValueGrid items={detailItems} columns={2} />
		</DetailSection>

		<DetailSection
			title="Rows"
			description="Every row in the file, with the result the server recorded."
		>
			<RowOutcomesTable
				batchId={loadedBatch.id}
				status={loadedBatch.status}
				kind={loadedBatch.kind}
				initial={initialRows}
				{reloadToken}
			/>
		</DetailSection>

		<DetailSection title="Activity">
			<AuditTrailTab
				rows={auditRows}
				loading={auditLoading}
				error={auditError}
				emptyLabel="No import activity yet."
			/>
			{#if auditError}
				<div class="pt-2">
					<Button variant="secondary" onclick={retryAudit}>Try again</Button>
				</div>
			{/if}
		</DetailSection>
	</div>

	<ConfirmDialog
		bind:open={commitOpen}
		title="Commit this import?"
		description={commitDescription}
		confirmLabel="Commit import"
		loading={committing}
		error={commitError}
		onconfirm={commit}
	/>
{/if}
