<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { formatCount } from '$shared/lib/format';
	import { formatFileSize } from '../import-display';

	/**
	 * Step 1 of the import wizard: choose the CSV file (spec Part 10 §26).
	 * Reading and parsing belong to the page and `domain/csv.ts`; this control
	 * only reports the chosen file and shows what was read from it.
	 */
	interface Props {
		fileName: string;
		fileSize: number | null;
		columnCount: number;
		rowCount: number;
		error: string | null;
		reading?: boolean;
		onfile: (file: File) => void;
	}

	let {
		fileName,
		fileSize,
		columnCount,
		rowCount,
		error,
		reading = false,
		onfile
	}: Props = $props();

	const inputId = $props.id();
	const hintId = `${inputId}-hint`;
	const errorId = `${inputId}-error`;

	function handleChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		onfile(file);
		// Clear the native value so choosing the same file again re-runs the read.
		input.value = '';
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-2">
		<label for={inputId} class="text-subheadline text-ink">
			CSV file<span class="text-footnote text-ink-tertiary"> (required)</span>
		</label>

		<input
			id={inputId}
			type="file"
			accept=".csv,text/csv"
			onchange={handleChange}
			aria-describedby={error ? `${hintId} ${errorId}` : hintId}
			aria-invalid={error ? 'true' : undefined}
			class="min-h-target w-full cursor-pointer rounded-md border border-hairline-strong bg-canvas p-2 text-callout text-ink file:me-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-canvas-grouped file:px-4 file:py-2 file:text-subheadline file:text-ink hover:file:bg-canvas-nested"
		/>

		<p id={hintId} class="text-footnote text-ink-secondary">
			UTF-8 CSV with a heading row, separated by commas. Excel and TSV files are not supported yet.
		</p>

		{#if error}
			<p id={errorId} role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{error}</span>
			</p>
		{/if}
	</div>

	{#if reading}
		<p role="status" aria-live="polite" class="text-callout text-ink-secondary">
			Reading the file…
		</p>
	{/if}

	{#if fileName}
		<div class="flex flex-col gap-1 rounded-md border border-hairline bg-canvas-grouped p-4">
			<p class="text-callout break-words text-ink">{fileName}</p>
			<p class="text-footnote text-ink-secondary tabular-nums">
				{formatFileSize(fileSize)}{#if rowCount > 0}
					· {formatCount(rowCount)}
					{rowCount === 1 ? 'row' : 'rows'}
					· {formatCount(columnCount)}
					{columnCount === 1 ? 'column' : 'columns'}
				{/if}
			</p>
		</div>
	{/if}
</div>
