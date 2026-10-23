<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import { IMPORT_KINDS } from '$shared/domain/record-states';
	import type { ImportKind } from '../../domain/types';
	import { IMPORT_KIND_DESCRIPTIONS, IMPORT_KIND_LABELS } from '../import-display';

	/**
	 * Step 2 of the import wizard: one-of-three radio cards, one decision per
	 * step (DESIGN §10.2 Wizard, §9.3 Radio). Selection is carried by the radio,
	 * a check icon and the border together, never by colour alone.
	 */
	interface Props {
		value: ImportKind | null;
		onchange: (kind: ImportKind) => void;
	}

	let { value, onchange }: Props = $props();

	const groupName = $props.id();
</script>

<fieldset class="flex min-w-0 flex-col gap-3 border-0 p-0">
	<legend class="p-0 text-subheadline text-ink">What are you importing?</legend>

	<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
		{#each IMPORT_KINDS as kind (kind)}
			{@const selected = value === kind}
			<label
				class={cn(
					'relative flex min-h-target cursor-pointer items-start gap-3 rounded-md border p-4 focus-within:outline-2 focus-within:outline-offset-2',
					selected
						? 'border-brand bg-brand-soft'
						: 'border-hairline bg-canvas hover:bg-canvas-grouped'
				)}
			>
				<span class="relative mt-1 inline-flex size-5 shrink-0 items-center justify-center">
					<input
						type="radio"
						name={groupName}
						value={kind}
						checked={selected}
						onchange={() => onchange(kind)}
						class="peer size-5 cursor-pointer appearance-none rounded-full border border-hairline-strong bg-canvas checked:border-brand"
					/>
					<span
						class="pointer-events-none absolute size-2 rounded-full bg-brand opacity-0 peer-checked:opacity-100"
					></span>
				</span>

				<span class="flex min-w-0 flex-col gap-1">
					<span class="flex items-center gap-2 text-callout text-ink">
						{IMPORT_KIND_LABELS[kind]}
						{#if selected}
							<Check size={16} strokeWidth={2} aria-hidden="true" class="text-safe-ink" />
						{/if}
					</span>
					<span class="text-footnote text-ink-secondary">{IMPORT_KIND_DESCRIPTIONS[kind]}</span>
				</span>
			</label>
		{/each}
	</div>
</fieldset>
