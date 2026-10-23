<script lang="ts">
	import { CircleAlert, CircleCheck } from '@lucide/svelte';
	import { Select } from '$shared/presentation/ui';
	import { IMPORT_FIELDS } from '../../domain/csv';
	import type { ImportKind } from '../../domain/types';
	import { requiredFieldsMapped } from '../../domain/validations';

	/**
	 * Step 3 of the import wizard: one select per canonical field, listing the
	 * file's headings (spec Part 10 §26). Suggestion comes from the domain's
	 * `suggestColumnMap`; this component only edits the map and explains what
	 * is still missing.
	 */
	interface Props {
		kind: ImportKind;
		headers: string[];
		columnMap: Record<string, string>;
		onchange: (columnMap: Record<string, string>) => void;
	}

	let { kind, headers, columnMap, onchange }: Props = $props();

	const fields = $derived(IMPORT_FIELDS[kind]);
	/** Duplicate headings cannot both be mapped, so only the first is offered. */
	const uniqueHeaders = $derived(Array.from(new Set(headers)));
	const duplicateCount = $derived(headers.length - uniqueHeaders.length);
	const missingRequired = $derived(requiredFieldsMapped(kind, columnMap));

	const headerOptions = $derived([
		{ value: '', label: 'Not mapped' },
		...uniqueHeaders.map((header) => ({ value: header, label: header }))
	]);

	function mappedHeader(fieldKey: string): string {
		return Object.entries(columnMap).find(([, key]) => key === fieldKey)?.[0] ?? '';
	}

	/**
	 * A field can only come from one column and a column can only feed one
	 * field: moving a heading here releases it from its previous field.
	 */
	function updateField(fieldKey: string, header: string): void {
		const next: Record<string, string> = {};

		for (const [source, key] of Object.entries(columnMap)) {
			if (key === fieldKey) continue;
			if (header.length > 0 && source === header) continue;
			next[source] = key;
		}

		if (header.length > 0) next[header] = fieldKey;
		onchange(next);
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<h3 class="text-title-3 text-ink">Match the file columns</h3>
		<p class="text-callout text-ink-secondary">
			Choose which heading feeds each field. We have pre-selected the headings we recognised.
		</p>
	</div>

	{#if duplicateCount > 0}
		<p class="rounded-md bg-canvas-grouped p-3 text-footnote text-ink-secondary">
			This file has {duplicateCount}
			{duplicateCount === 1 ? 'repeated heading' : 'repeated headings'}. Only the first column with
			each heading is used.
		</p>
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		{#each fields as field (field.key)}
			<Select
				label={field.label}
				required={field.required}
				value={mappedHeader(field.key)}
				options={headerOptions}
				onchange={(event) =>
					updateField(field.key, (event.currentTarget as HTMLSelectElement).value)}
			/>
		{/each}
	</div>

	{#if missingRequired.length > 0}
		<p
			role="status"
			aria-live="polite"
			class="flex items-start gap-2 rounded-md border border-caution bg-caution-soft p-3 text-callout text-caution-ink"
		>
			<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
			<span>Map the required fields to continue: {missingRequired.join(', ')}.</span>
		</p>
	{:else}
		<p
			role="status"
			aria-live="polite"
			class="flex items-start gap-2 rounded-md border border-hairline bg-canvas-grouped p-3 text-callout text-ink-secondary"
		>
			<CircleCheck
				size={20}
				strokeWidth={1.75}
				aria-hidden="true"
				class="mt-0.5 shrink-0 text-safe-ink"
			/>
			<span>Every required field is mapped.</span>
		</p>
	{/if}
</div>
