<script lang="ts">
	import { formatCount } from '$shared/lib/format';
	import { KeyValueGrid } from '$shared/presentation/ui';
	import type { ImportKind } from '../../domain/types';
	import { formatFileSize, IMPORT_KIND_LABELS } from '../import-display';

	/**
	 * Step 5 of the import wizard: the last look before staging. Staging only
	 * stores the file and its checked rows; records are created on commit.
	 */
	interface Props {
		fileName: string;
		fileSize: number | null;
		kind: ImportKind;
		columnCount: number;
		rowCount: number;
		requiredLabels: string[];
		counts: { ready: number; review: number; rejected: number };
	}

	let { fileName, fileSize, kind, columnCount, rowCount, requiredLabels, counts }: Props = $props();

	const items = $derived([
		{ label: 'File', value: fileName },
		{ label: 'Size', value: formatFileSize(fileSize) },
		{ label: 'Kind', value: IMPORT_KIND_LABELS[kind] },
		{ label: 'Columns', value: formatCount(columnCount) },
		{ label: 'Rows', value: formatCount(rowCount) },
		{
			label: 'Required fields mapped',
			value: requiredLabels.length > 0 ? requiredLabels.join(', ') : null
		}
	]);
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-4">
		<h3 class="text-title-3 text-ink">Review this batch</h3>
		<KeyValueGrid {items} columns={2} />
	</div>

	<dl class="grid grid-cols-1 gap-3 sm:grid-cols-3">
		<div class="flex flex-col gap-1 rounded-md border border-hairline bg-canvas p-4">
			<dt class="text-footnote text-ink-secondary">Ready to create</dt>
			<dd class="text-title-2 text-ink tabular-nums">{formatCount(counts.ready)}</dd>
		</div>
		<div class="flex flex-col gap-1 rounded-md border border-hairline bg-canvas p-4">
			<dt class="text-footnote text-ink-secondary">Held for review</dt>
			<dd class="text-title-2 text-caution-ink tabular-nums">{formatCount(counts.review)}</dd>
		</div>
		<div class="flex flex-col gap-1 rounded-md border border-hairline bg-canvas p-4">
			<dt class="text-footnote text-ink-secondary">Rejected</dt>
			<dd class="text-title-2 text-critical-ink tabular-nums">{formatCount(counts.rejected)}</dd>
		</div>
	</dl>

	<p class="rounded-md bg-canvas-grouped p-4 text-callout text-ink-secondary">
		Staging keeps every row exactly as it was checked. No customers, properties or projects are
		created until you commit this batch on its detail page, where you can review the rows first.
	</p>
</div>
