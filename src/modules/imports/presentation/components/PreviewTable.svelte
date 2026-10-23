<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { customersApi } from '$modules/customers/data/api';
	import { projectsApi } from '$modules/projects/data/api';
	import { propertiesApi } from '$modules/properties/data/api';
	import { formatCount } from '$shared/lib/format';
	import { stateLabel } from '$shared/lib/status';
	import { Badge, Button, DataTable } from '$shared/presentation/ui';
	import { validateImportRows } from '../../domain/csv';
	import type { ImportMatchContext, ParsedImportRow } from '../../domain/csv';
	import type { ImportKind } from '../../domain/types';
	import type { ImportPreviewState } from '../import-display';
	import { rowValues } from '../import-display';

	/**
	 * Step 4 of the import wizard: validates the parsed rows against the
	 * tenant's live records with the same domain function the mock server uses
	 * on stage, so the preview cannot drift from what staging will store.
	 *
	 * The match context is capped at the first 100 records per kind (the list
	 * endpoints' maximum page size); a larger tenant can therefore see a row
	 * move to `needs_review` at commit time. Reported as a known limitation.
	 */
	interface Props {
		kind: ImportKind;
		records: Array<Record<string, string>>;
		columnMap: Record<string, string>;
		onstate: (state: ImportPreviewState) => void;
	}

	let { kind, records, columnMap, onstate }: Props = $props();

	const CONTEXT_PAGE_SIZE = 100;
	const PREVIEW_ROW_LIMIT = 20;

	interface TableColumn {
		key: string;
		label: string;
		align?: 'start' | 'end';
	}

	const columns: TableColumn[] = [
		{ key: 'rowNo', label: 'Row', align: 'end' },
		{ key: 'record', label: 'Record' },
		{ key: 'result', label: 'Result' },
		{ key: 'detail', label: 'Detail' }
	];

	let loading = $state(true);
	let error = $state<string | null>(null);
	let parsed = $state<ParsedImportRow[]>([]);
	let attempt = $state(0);
	let requestSequence = 0;

	const counts = $derived.by(() => ({
		ready: parsed.filter((row) => row.validation === 'ready').length,
		review: parsed.filter((row) => row.validation === 'needs_review').length,
		rejected: parsed.filter((row) => row.validation === 'rejected').length
	}));

	const previewRows = $derived(parsed.slice(0, PREVIEW_ROW_LIMIT));

	const summary = $derived(
		`${formatCount(counts.ready)} ready, ${formatCount(counts.review)} need review, ${formatCount(counts.rejected)} rejected.`
	);

	function resultTone(value: string): 'info' | 'success' | 'warning' | 'danger' {
		if (value === 'ready') return 'info';
		if (value === 'imported') return 'success';
		if (value === 'needs_review') return 'warning';
		return 'danger';
	}

	function detailText(row: ParsedImportRow): string {
		if (row.error) return row.error;
		if (row.validation === 'needs_review') return 'Matches an existing record.';
		return '\u2014';
	}

	/**
	 * The match context excludes archived and cancelled records, exactly as the
	 * mock server does when it validates a staged batch.
	 */
	async function buildContext(): Promise<ImportMatchContext> {
		const [customerPage, propertyPage, projectPage] = await Promise.all([
			customersApi.list({ pageSize: CONTEXT_PAGE_SIZE }),
			propertiesApi.list({ pageSize: CONTEXT_PAGE_SIZE }),
			projectsApi.list({ pageSize: CONTEXT_PAGE_SIZE })
		]);

		return {
			customers: customerPage.items
				.filter((row) => row.state !== 'archived' && row.state !== 'cancelled')
				.map((row) => ({
					id: row.id,
					caption: row.caption,
					email: row.email,
					phone: row.phone,
					postcode: row.postcode
				})),
			properties: propertyPage.items
				.filter((row) => row.state !== 'archived')
				.map((row) => ({
					id: row.id,
					addressLine1: row.addressLine1,
					town: row.town,
					postcode: row.postcode
				})),
			projects: projectPage.items
				.filter((row) => row.state !== 'archived' && row.state !== 'cancelled')
				.map((row) => ({
					id: row.id,
					propertyId: row.propertyId,
					projectType: row.projectType,
					caption: row.caption
				}))
		};
	}

	async function run(
		currentKind: ImportKind,
		currentMap: Record<string, string>,
		currentRecords: Array<Record<string, string>>
	): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;
		onstate({ status: 'loading', rows: [], error: null });

		try {
			const context = await buildContext();
			if (sequence !== requestSequence) return;

			const next = validateImportRows(currentKind, currentRecords, currentMap, context);
			parsed = next;
			onstate({ status: 'ready', rows: next, error: null });
		} catch (caught) {
			if (sequence !== requestSequence) return;
			parsed = [];
			const message = isApiError(caught)
				? caught.message
				: 'We could not check this file against existing records. Try again.';
			error = message;
			onstate({ status: 'error', rows: [], error: message });
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	$effect(() => {
		const currentKind = kind;
		const currentMap = columnMap;
		const currentRecords = records;
		void attempt;
		void run(currentKind, currentMap, currentRecords);
	});
</script>

<div class="flex flex-col gap-6">
	{#if loading}
		<div class="flex flex-col gap-3" role="status" aria-live="polite">
			<span class="sr-only">Checking rows against existing records.</span>
			<div class="h-20 rounded-md bg-canvas-nested"></div>
			<div class="h-40 rounded-md bg-canvas-nested"></div>
		</div>
	{:else if error}
		<div class="flex flex-col items-start gap-3 rounded-lg border border-hairline bg-canvas p-4">
			<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{error}</span>
			</p>
			<Button variant="secondary" onclick={() => (attempt += 1)}>Try again</Button>
		</div>
	{:else}
		<dl class="grid grid-cols-1 gap-3 sm:grid-cols-3">
			<div class="flex flex-col gap-1 rounded-md border border-hairline bg-canvas p-4">
				<dt class="text-footnote text-ink-secondary">Ready to create</dt>
				<dd class="text-title-2 text-ink tabular-nums">{formatCount(counts.ready)}</dd>
			</div>
			<div class="flex flex-col gap-1 rounded-md border border-hairline bg-canvas p-4">
				<dt class="text-footnote text-ink-secondary">Needs review</dt>
				<dd class="text-title-2 text-caution-ink tabular-nums">{formatCount(counts.review)}</dd>
			</div>
			<div class="flex flex-col gap-1 rounded-md border border-hairline bg-canvas p-4">
				<dt class="text-footnote text-ink-secondary">Rejected</dt>
				<dd class="text-title-2 text-critical-ink tabular-nums">{formatCount(counts.rejected)}</dd>
			</div>
		</dl>

		<p class="sr-only" role="status" aria-live="polite">{summary}</p>

		<div class="flex flex-col gap-3">
			<p class="text-callout text-ink-secondary">
				{#if parsed.length > PREVIEW_ROW_LIMIT}
					Showing the first {PREVIEW_ROW_LIMIT} of {formatCount(parsed.length)} rows. Every row is checked,
					not just the ones shown here.
				{:else}
					Every row in the file is checked. Nothing has been created yet.
				{/if}
			</p>

			<DataTable
				caption="Import preview"
				{columns}
				rows={previewRows}
				rowKey={(row) => String(row.rowNo)}
				density="compact"
			>
				{#snippet cell({ row, column }: { row: ParsedImportRow; column: TableColumn })}
					{#if column.key === 'rowNo'}
						<span class="tabular-nums">{row.rowNo}</span>
					{:else if column.key === 'record'}
						{@const values = rowValues(kind, row.payload)}
						<div class="flex min-w-0 flex-col gap-0.5">
							<span class="break-words text-ink">{values.primary}</span>
							{#if values.secondary}
								<span class="text-footnote break-words text-ink-tertiary">{values.secondary}</span>
							{/if}
						</div>
					{:else if column.key === 'result'}
						<Badge label={stateLabel(row.validation)} tone={resultTone(row.validation)} />
					{:else if column.key === 'detail'}
						<span
							class={row.error ? 'break-words text-critical-ink' : 'break-words text-ink-secondary'}
						>
							{detailText(row)}
						</span>
					{/if}
				{/snippet}
			</DataTable>
		</div>
	{/if}
</div>
