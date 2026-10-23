<script lang="ts">
	import type { AssignableSurveyor } from '../../domain/types';
	import { Button, Checkbox, Skeleton } from '$shared/presentation/ui';

	/**
	 * Step 4 — assign at least one surveyor (S1). The pool is loaded by the page
	 * because the same list feeds the review step; this component owns only the
	 * selection UI and the blocking message when the tenant has no project to
	 * derive the pool from.
	 */
	interface Props {
		surveyors: AssignableSurveyor[];
		selectedIds: string[];
		loading: boolean;
		error?: string | null;
		blockedReason?: string | null;
		ontoggle: (id: string, checked: boolean) => void;
		onretry: () => void;
		selectionError?: string | null;
	}

	let {
		surveyors,
		selectedIds,
		loading,
		error = null,
		blockedReason = null,
		ontoggle,
		onretry,
		selectionError = null
	}: Props = $props();

	const selectedCount = $derived(surveyors.filter((row) => selectedIds.includes(row.id)).length);
</script>

<div class="flex flex-col gap-4">
	{#if blockedReason}
		<div class="flex flex-col gap-3 rounded-md border border-caution bg-caution-soft p-4">
			<h3 class="text-title-3 text-caution-ink">Surveyors are not available yet.</h3>
			<p role="status" class="text-callout text-caution-ink">{blockedReason}</p>
			<p class="text-footnote text-caution-ink">
				A project needs at least one surveyor before it can be created. This is a workspace setup
				gap, not something you can fix on this step.
			</p>
		</div>
	{:else if error}
		<div class="flex flex-col gap-3 rounded-md border border-critical bg-critical-soft p-4">
			<p role="alert" class="text-callout text-critical-ink">{error}</p>
			<Button variant="secondary" onclick={onretry}>Try again</Button>
		</div>
	{:else if loading}
		<div class="flex flex-col gap-2" role="status" aria-live="polite">
			<span class="sr-only">Loading surveyors</span>
			<Skeleton />
			<Skeleton />
			<Skeleton />
		</div>
	{:else if surveyors.length === 0}
		<div class="rounded-md border border-hairline bg-canvas-grouped p-4">
			<h3 class="text-title-3 text-ink">No surveyors in this workspace.</h3>
			<p class="text-callout text-ink-secondary">
				Invite someone with the Surveyor role, then come back to assign them.
			</p>
		</div>
	{:else}
		<p class="text-callout text-ink-secondary" role="status" aria-live="polite">
			{selectedCount}
			{selectedCount === 1 ? 'surveyor selected' : 'surveyors selected'}
		</p>

		<fieldset class="flex min-w-0 flex-col gap-1 border-0 p-0">
			<legend class="pb-2 text-subheadline text-ink">Assign surveyors (required)</legend>

			{#each surveyors as surveyor (surveyor.id)}
				<Checkbox
					label={surveyor.displayName}
					description={surveyor.email}
					checked={selectedIds.includes(surveyor.id)}
					onchange={(event) =>
						ontoggle(surveyor.id, (event.currentTarget as HTMLInputElement).checked)}
				/>
			{/each}
		</fieldset>

		{#if selectionError}
			<p role="alert" class="text-footnote text-critical-ink">{selectionError}</p>
		{/if}

		<p class="text-footnote text-ink-secondary">
			Only people holding the Surveyor role appear here. You can change assignments later from the
			project hub.
		</p>
	{/if}
</div>
