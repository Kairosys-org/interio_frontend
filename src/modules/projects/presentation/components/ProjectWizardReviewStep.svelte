<script lang="ts">
	import { Pencil } from '@lucide/svelte';
	import { PROJECT_TYPE_LABELS, type ProjectType } from '$shared/domain/record-states';
	import { Button } from '$shared/presentation/ui';
	import type { CustomerChoice, PropertyChoice } from '../wizard-types';

	/**
	 * Step 5 — review every decision before the single create call. Each row
	 * links back to the step that owns it; going back never clears state.
	 */
	interface Props {
		customer: CustomerChoice | null;
		property: PropertyChoice | null;
		caption: string;
		projectType: ProjectType;
		surveyors: string[];
		onjump: (step: number) => void;
	}

	let { customer, property, caption, projectType, surveyors, onjump }: Props = $props();

	interface ReviewRow {
		label: string;
		value: string;
		step: number;
		empty: boolean;
	}

	const rows = $derived<ReviewRow[]>([
		{
			label: 'Customer',
			value: customer?.caption ?? 'Not chosen',
			step: 0,
			empty: customer === null
		},
		{
			label: 'Property',
			value: property?.label ?? 'Not chosen',
			step: 1,
			empty: property === null
		},
		{
			label: 'Project caption',
			value: caption.trim().length > 0 ? caption : 'Not entered',
			step: 2,
			empty: caption.trim().length === 0
		},
		{
			label: 'Project type',
			value: PROJECT_TYPE_LABELS[projectType],
			step: 2,
			empty: false
		},
		{
			label: 'Surveyors',
			value: surveyors.length > 0 ? surveyors.join(', ') : 'None assigned',
			step: 3,
			empty: surveyors.length === 0
		}
	]);
</script>

<div class="flex flex-col gap-4">
	<dl class="flex list-none flex-col gap-0 p-0">
		{#each rows as row (row.label)}
			<div
				class="flex flex-col gap-2 border-b border-hairline py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
			>
				<div class="flex min-w-0 flex-col gap-1">
					<dt class="text-footnote text-ink-secondary">{row.label}</dt>
					<dd
						class={row.empty
							? 'text-callout text-ink-tertiary'
							: 'text-callout break-words text-ink'}
					>
						{row.value}
					</dd>
				</div>

				<Button variant="tertiary" onclick={() => onjump(row.step)} class="self-start sm:shrink-0">
					{#snippet icon()}
						<Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
					{/snippet}
					Change
				</Button>
			</div>
		{/each}
	</dl>

	<div class="rounded-md border border-hairline bg-canvas-grouped p-4">
		<p class="text-callout text-ink">The project starts as Active.</p>
		<p class="text-footnote text-ink-secondary">
			Creating checks for a possible duplicate first. If one is found, nothing is merged
			automatically — you review the match before the project becomes available.
		</p>
	</div>
</div>
