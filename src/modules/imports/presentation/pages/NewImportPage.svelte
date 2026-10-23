<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { Breadcrumb, Button, PageHeader, PermissionGate, Stepper } from '$shared/presentation/ui';
	import { importsApi } from '../../data/api';
	import {
		CsvParseError,
		IMPORT_FIELDS,
		parseCsv,
		rowsToRecords,
		suggestColumnMap
	} from '../../domain/csv';
	import type { ParsedImportRow } from '../../domain/csv';
	import type { ImportKind } from '../../domain/types';
	import { importStageSchema, requiredFieldsMapped } from '../../domain/validations';
	import type { ImportPreviewState } from '../import-display';
	import ColumnMapper from '../components/ColumnMapper.svelte';
	import ImportFileStep from '../components/ImportFileStep.svelte';
	import ImportKindChoice from '../components/ImportKindChoice.svelte';
	import ImportReviewStep from '../components/ImportReviewStep.svelte';
	import PreviewTable from '../components/PreviewTable.svelte';

	/**
	 * `/imports/new` wizard (DESIGN §10.2 Wizard, phase-1 §3): upload → kind →
	 * map columns → preview → stage. One decision per step, Back keeps every
	 * answer, and nothing is created until the batch is committed later.
	 */
	const steps = [
		{ id: 'upload', label: 'Upload', description: 'Choose the CSV file.' },
		{ id: 'kind', label: 'Kind', description: 'What the file contains.' },
		{ id: 'map', label: 'Map columns', description: 'Match headings to fields.' },
		{ id: 'preview', label: 'Preview', description: 'Check every row.' },
		{ id: 'stage', label: 'Stage', description: 'Review and stage the batch.' }
	];

	const STAGE_STEP = steps.length - 1;

	let step = $state(0);
	let maxStep = $state(0);

	let fileName = $state('');
	let fileSize = $state<number | null>(null);
	let csvText = $state('');
	let headers = $state<string[]>([]);
	let rows = $state<string[][]>([]);
	let reading = $state(false);
	let uploadError = $state<string | null>(null);

	let kind = $state<ImportKind | null>(null);
	let columnMap = $state<Record<string, string>>({});

	let previewStatus = $state<ImportPreviewState['status']>('loading');
	let previewRows = $state<ParsedImportRow[]>([]);

	let submitting = $state(false);
	let submitError = $state<string | null>(null);

	const currentStep = $derived(steps[step]);
	const importsHref = resolve('/imports');

	const records = $derived(rowsToRecords(headers, rows));

	const missingRequired = $derived(kind === null ? [] : requiredFieldsMapped(kind, columnMap));

	const requiredLabels = $derived(
		kind === null
			? []
			: IMPORT_FIELDS[kind].filter((field) => field.required).map((field) => field.label)
	);

	const previewCounts = $derived({
		ready: previewRows.filter((row) => row.validation === 'ready').length,
		review: previewRows.filter((row) => row.validation === 'needs_review').length,
		rejected: previewRows.filter((row) => row.validation === 'rejected').length
	});

	/** Why Continue is unavailable, in the user's words (DESIGN §9.1.6). */
	const blockedReason = $derived.by(() => {
		if (step === 0) {
			if (uploadError) return uploadError;
			if (csvText.length === 0) return 'Choose a CSV file to continue.';
			return null;
		}

		if (step === 1) return kind === null ? 'Choose what you are importing.' : null;

		if (step === 2) {
			return missingRequired.length > 0
				? `Map the required fields to continue: ${missingRequired.join(', ')}.`
				: null;
		}

		if (step === 3) {
			if (previewStatus === 'loading') return 'Checking the rows against existing records.';
			if (previewStatus === 'error')
				return 'We could not check this file. Try again before continuing.';
			if (previewStatus !== 'ready') return 'Check the file before continuing.';
			return null;
		}

		return null;
	});

	function resetDownstream(): void {
		previewRows = [];
		previewStatus = 'loading';
		submitError = null;
		if (maxStep > 2) maxStep = 2;
	}

	/** A new file starts the wizard again: nothing downstream survives it. */
	function resetForFile(): void {
		csvText = '';
		headers = [];
		rows = [];
		kind = null;
		columnMap = {};
		previewRows = [];
		previewStatus = 'loading';
		submitError = null;
		step = 0;
		maxStep = 0;
	}

	async function handleFile(file: File): Promise<void> {
		uploadError = null;
		reading = true;

		const name = file.name;
		fileName = name;
		fileSize = file.size;

		try {
			if (!name.toLowerCase().endsWith('.csv')) {
				resetForFile();
				fileName = name;
				fileSize = file.size;
				uploadError = 'Choose a CSV file. Excel and other formats are not supported yet.';
				return;
			}

			if (file.size === 0) {
				resetForFile();
				fileName = name;
				fileSize = 0;
				uploadError =
					'That file is empty. Choose a CSV file with a heading row and at least one data row.';
				return;
			}

			const text = await file.text();

			if (text.trim().length === 0) {
				resetForFile();
				fileName = name;
				fileSize = file.size;
				uploadError =
					'That file is empty. Choose a CSV file with a heading row and at least one data row.';
				return;
			}

			const parsed = parseCsv(text);

			resetForFile();
			fileName = name;
			fileSize = file.size;
			csvText = text;
			headers = parsed.headers;
			rows = parsed.rows;
		} catch (caught) {
			resetForFile();
			fileName = name;
			fileSize = file.size;
			uploadError =
				caught instanceof CsvParseError
					? caught.message
					: 'We could not read that file. Check it is a UTF-8 CSV and try again.';
		} finally {
			reading = false;
		}
	}

	function handleKind(next: ImportKind): void {
		if (kind === next) return;
		kind = next;
		// Suggestions depend on the kind, so the map starts again from the headers.
		columnMap = suggestColumnMap(next, headers);
		resetDownstream();
	}

	function handleColumnMap(next: Record<string, string>): void {
		columnMap = next;
		resetDownstream();
	}

	function handlePreview(state: ImportPreviewState): void {
		previewStatus = state.status;
		previewRows = state.rows;
	}

	function handleContinue(): void {
		submitError = null;
		if (blockedReason !== null) return;

		if (step < STAGE_STEP) {
			step += 1;
			maxStep = Math.max(maxStep, step);
			return;
		}

		void stage();
	}

	function handleBack(): void {
		submitError = null;
		if (step === 0) {
			void goto(importsHref);
			return;
		}
		step -= 1;
	}

	function handleJump(index: number): void {
		if (index > maxStep || index === step) return;
		submitError = null;
		step = index;
	}

	async function stage(): Promise<void> {
		if (submitting) return;
		submitError = null;

		if (kind === null) {
			submitError = 'Choose what you are importing.';
			return;
		}

		if (missingRequired.length > 0) {
			submitError = `Map the required fields: ${missingRequired.join(', ')}.`;
			return;
		}

		const checked = importStageSchema.safeParse({
			kind,
			fileName,
			columnMap,
			rows: rows.length
		});

		if (!checked.success) {
			submitError =
				checked.error.issues[0]?.message ?? 'Check the file and column mapping, then try again.';
			return;
		}

		submitting = true;
		try {
			const batch = await importsApi.create({
				kind: checked.data.kind,
				fileName: checked.data.fileName,
				csvText,
				columnMap: checked.data.columnMap
			});
			toast.success('Import staged.');
			await goto(resolve(`/imports/${batch.id}` as Pathname));
		} catch (caught) {
			submitError = isApiError(caught)
				? caught.message
				: 'We could not stage this import. Try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>New import · Interio</title>
</svelte:head>

<Breadcrumb
	items={[{ label: 'Imports', href: importsHref }, { label: 'New import' }]}
	class="pb-4"
/>

<PageHeader
	title="New import"
	description="Upload a CSV file, say what it contains, map its columns and check every row before staging."
/>

<div class="mt-8 flex max-w-content-form flex-col gap-6">
	<Stepper {steps} current={step} onstep={handleJump} />

	<section aria-labelledby="wizard-step-heading" class="flex flex-col gap-4">
		<div class="flex flex-col gap-1">
			<p class="text-footnote text-ink-secondary">Step {step + 1} of {steps.length}</p>
			<h2 id="wizard-step-heading" class="text-title-2 text-ink">{currentStep.label}</h2>
			<p class="text-callout text-ink-secondary">{currentStep.description}</p>
		</div>

		{#if step === 0}
			<ImportFileStep
				{fileName}
				{fileSize}
				columnCount={headers.length}
				rowCount={rows.length}
				error={uploadError}
				{reading}
				onfile={(file) => void handleFile(file)}
			/>
		{:else if step === 1}
			<ImportKindChoice value={kind} onchange={handleKind} />
		{:else if step === 2 && kind}
			<ColumnMapper {kind} {headers} {columnMap} onchange={handleColumnMap} />
		{:else if step === 3 && kind}
			<PreviewTable {kind} {records} {columnMap} onstate={handlePreview} />
		{:else if step === 4 && kind}
			<ImportReviewStep
				{fileName}
				{fileSize}
				{kind}
				columnCount={headers.length}
				rowCount={rows.length}
				{requiredLabels}
				counts={previewCounts}
			/>
		{:else}
			<p class="text-callout text-ink-secondary">
				Choose a file and what you are importing to continue.
			</p>
		{/if}
	</section>

	{#if submitError}
		<p
			role="alert"
			class="rounded-md border border-critical bg-critical-soft p-4 text-callout text-critical-ink"
		>
			{submitError}
		</p>
	{/if}

	<div
		class="form-actions flex flex-col-reverse gap-3 border-t border-hairline bg-canvas pt-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<Button variant="secondary" onclick={handleBack}>
			{step === 0 ? 'Cancel' : 'Back'}
		</Button>

		<div class="flex flex-col gap-2 sm:items-end">
			{#if step === STAGE_STEP}
				<PermissionGate permission={PERMISSIONS.IMPORT_CREATE}>
					{#snippet fallback()}
						<p class="text-footnote text-ink-tertiary">
							You need permission to create imports. Ask a workspace owner.
						</p>
					{/snippet}
					<Button
						variant="primary"
						loading={submitting}
						loadingLabel="Staging…"
						disabled={blockedReason !== null}
						onclick={handleContinue}
					>
						Stage import
					</Button>
				</PermissionGate>
			{:else}
				<Button variant="primary" disabled={blockedReason !== null} onclick={handleContinue}>
					Continue
				</Button>
			{/if}

			{#if blockedReason}
				<p class="text-footnote text-ink-tertiary">{blockedReason}</p>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Mobile: the action bar stays above the safe area (DESIGN §10.2). */
	.form-actions {
		position: sticky;
		bottom: 0;
		padding-block-end: env(safe-area-inset-bottom);
	}

	@media (width >= 40rem) {
		.form-actions {
			position: static;
		}
	}
</style>
