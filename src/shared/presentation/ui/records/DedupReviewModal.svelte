<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import Badge from '../feedback/Badge.svelte';
	import Button from '../button/Button.svelte';
	import Dialog from '../overlay/Dialog.svelte';
	import Textarea from '../input/Textarea.svelte';
	import { diffFields } from './dedup-diff';

	interface FieldView {
		label: string;
		value: string;
	}

	interface HeldRecord {
		id: string;
		caption: string;
		state: string;
		createdAt: string;
		fields: FieldView[];
	}

	interface CandidateRecord {
		id: string;
		caption: string;
		createdAt: string;
		matchReasons: string[];
		fields: FieldView[];
	}

	type Decision = 'link_to_existing' | 'confirm_distinct';

	interface Props {
		open?: boolean;
		held: HeldRecord;
		candidates: CandidateRecord[];
		busy?: boolean;
		error?: string | null;
		onreview: (input: {
			decision: Decision;
			targetId: string | null;
			reviewNote: string;
		}) => void | Promise<void>;
	}

	let {
		open = $bindable(false),
		held,
		candidates,
		busy = false,
		error = null,
		onreview
	}: Props = $props();

	const uid = $props.id();

	let selectedCandidateId = $state<string | null>(null);
	let decision = $state<Decision | ''>('');
	let note = $state('');
	let noteError = $state<string | null>(null);
	let formError = $state<string | null>(null);
	let submitting = $state(false);

	const isBusy = $derived(busy || submitting);
	const shownError = $derived(error ?? formError);

	const selectedCandidate = $derived(
		candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null
	);
	const comparison = $derived(
		selectedCandidate ? diffFields(held.fields, selectedCandidate.fields) : []
	);
	const differentCount = $derived(comparison.filter((field) => field.different).length);

	let wasOpen = false;
	let previousHeldId = $state<string | null>(null);

	/** A new held record must never inherit the previous record's decision. */
	$effect(() => {
		const closing = wasOpen && !open;
		const switched = previousHeldId !== null && previousHeldId !== held.id;

		if (closing || switched) {
			selectedCandidateId = null;
			decision = '';
			note = '';
			noteError = null;
			formError = null;
		}

		wasOpen = open;
		previousHeldId = held.id;
	});

	function humaniseState(value: string): string {
		const words = value.replace(/[._-]+/g, ' ').trim();
		if (words === '') return value;
		return words.charAt(0).toUpperCase() + words.slice(1);
	}

	const dateFormat = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'Europe/London'
	});

	function formatDate(value: string): string {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
	}

	function selectCandidate(id: string): void {
		selectedCandidateId = id;
		formError = null;
	}

	function selectDecision(next: Decision): void {
		decision = next;
		formError = null;
		noteError = null;
	}

	async function submit(): Promise<void> {
		if (isBusy) return;

		formError = null;
		noteError = null;

		const chosen = decision;
		if (chosen === '') {
			formError = 'Choose how to review this duplicate.';
			return;
		}

		let targetId: string | null = null;
		if (chosen === 'link_to_existing') {
			if (selectedCandidateId === null) {
				formError = 'Select the record to link to.';
				return;
			}
			targetId = selectedCandidateId;
		}

		const reviewNote = note.trim();
		if (chosen === 'confirm_distinct' && reviewNote === '') {
			noteError = 'Enter a note explaining why these records are different.';
			return;
		}

		submitting = true;
		try {
			await onreview({ decision: chosen, targetId, reviewNote });
		} catch {
			formError = 'We could not save this review. Try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog
	bind:open
	title="Review possible duplicate"
	description="Compare the held record with a possible match, then link it or confirm it is different."
	size="lg"
>
	<div class="flex flex-col gap-6">
		<div class="flex flex-col gap-2">
			<div class="flex flex-wrap items-center gap-2">
				<h3 class="text-title-3 text-ink">{held.caption}</h3>
				<Badge label={humaniseState(held.state)} tone="danger" />
			</div>
			<p class="text-footnote text-ink-secondary">
				Held <time datetime={held.createdAt}>{formatDate(held.createdAt)}</time>
			</p>
		</div>

		<fieldset class="flex min-w-0 flex-col gap-2 border-0 p-0">
			<legend class="p-0 text-subheadline text-ink">Choose the matching record</legend>

			{#if candidates.length === 0}
				<p class="rounded-md bg-canvas-grouped p-4 text-callout text-ink-secondary">
					No possible matches are available. Confirm this record is different.
				</p>
			{:else}
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each candidates as candidate (candidate.id)}
						<li>
							<label
								class={cn(
									'flex cursor-pointer items-start gap-3 rounded-md border p-3',
									selectedCandidateId === candidate.id
										? 'border-brand bg-brand-soft'
										: 'border-hairline bg-canvas hover:bg-canvas-grouped',
									isBusy && 'cursor-not-allowed'
								)}
							>
								<span class="relative mt-1 inline-flex size-5 shrink-0 items-center justify-center">
									<input
										type="radio"
										name={`${uid}-candidate`}
										value={candidate.id}
										checked={selectedCandidateId === candidate.id}
										disabled={isBusy}
										onchange={() => selectCandidate(candidate.id)}
										class="peer size-5 appearance-none rounded-full border border-hairline-strong bg-canvas checked:border-brand disabled:cursor-not-allowed disabled:opacity-60"
									/>
									<span
										class="pointer-events-none absolute size-2 rounded-full bg-brand opacity-0 peer-checked:opacity-100"
									></span>
								</span>

								<span class="flex min-w-0 flex-col gap-1">
									<span class="text-callout break-words text-ink">{candidate.caption}</span>
									<span class="text-footnote text-ink-secondary">
										Created
										<time datetime={candidate.createdAt}>{formatDate(candidate.createdAt)}</time>
									</span>
									{#if candidate.matchReasons.length > 0}
										<span class="flex flex-wrap gap-1">
											{#each candidate.matchReasons as reason (reason)}
												<Badge label={reason} tone="neutral" />
											{/each}
										</span>
									{/if}
								</span>
							</label>
						</li>
					{/each}
				</ul>
			{/if}
		</fieldset>

		{#if selectedCandidate}
			<div class="flex flex-col gap-2">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<h3 class="text-subheadline text-ink">Field comparison</h3>
					<p class="text-footnote text-ink-secondary">
						{differentCount}
						{differentCount === 1 ? 'field differs' : 'fields differ'}
					</p>
				</div>

				<div class="overflow-x-auto rounded-md border border-hairline">
					<table class="w-full border-collapse text-left">
						<caption class="sr-only">
							Field comparison between the held record and {selectedCandidate.caption}
						</caption>
						<thead class="bg-canvas-grouped">
							<tr>
								<th scope="col" class="px-3 py-2 text-footnote font-normal text-ink-secondary">
									Field
								</th>
								<th scope="col" class="px-3 py-2 text-footnote font-normal text-ink-secondary">
									Held record
								</th>
								<th scope="col" class="px-3 py-2 text-footnote font-normal text-ink-secondary">
									Selected candidate
								</th>
							</tr>
						</thead>
						<tbody>
							{#each comparison as field, index (index)}
								<tr class="border-t border-hairline align-top">
									<th scope="row" class="px-3 py-2 text-footnote font-normal text-ink-secondary">
										<span class="flex flex-wrap items-center gap-2">
											{field.label}
											{#if field.different}
												<Badge label="Different" tone="warning" />
											{/if}
										</span>
									</th>
									<td class="px-3 py-2 text-callout break-words text-ink">
										{field.heldValue === '' ? '—' : field.heldValue}
									</td>
									<td class="px-3 py-2 text-callout break-words text-ink">
										{field.candidateValue === '' ? '—' : field.candidateValue}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else if candidates.length > 0}
			<p class="rounded-md bg-canvas-grouped p-4 text-callout text-ink-secondary">
				Select a candidate above to compare the fields.
			</p>
		{/if}

		<fieldset class="flex min-w-0 flex-col gap-2 border-0 p-0">
			<legend class="p-0 text-subheadline text-ink">Decision</legend>

			<label
				class={cn(
					'flex min-h-target items-start gap-3 py-2',
					candidates.length === 0 || isBusy ? 'cursor-not-allowed' : 'cursor-pointer'
				)}
			>
				<span class="relative mt-1 inline-flex size-5 shrink-0 items-center justify-center">
					<input
						type="radio"
						name={`${uid}-decision`}
						value="link_to_existing"
						checked={decision === 'link_to_existing'}
						disabled={candidates.length === 0 || isBusy}
						onchange={() => selectDecision('link_to_existing')}
						class="peer size-5 appearance-none rounded-full border border-hairline-strong bg-canvas checked:border-brand disabled:cursor-not-allowed disabled:opacity-60"
					/>
					<span
						class="pointer-events-none absolute size-2 rounded-full bg-brand opacity-0 peer-checked:opacity-100"
					></span>
				</span>
				<span class="flex flex-col gap-1">
					<span
						class={cn('text-callout', candidates.length === 0 ? 'text-ink-disabled' : 'text-ink')}
					>
						Link to the existing record
					</span>
					<span class="text-footnote text-ink-secondary">
						Use the selected record instead of creating a new one.
					</span>
				</span>
			</label>

			{#if candidates.length === 0}
				<p class="text-footnote text-ink-secondary">Select a candidate to link to.</p>
			{/if}

			<label
				class={cn(
					'flex min-h-target items-start gap-3 py-2',
					isBusy ? 'cursor-not-allowed' : 'cursor-pointer'
				)}
			>
				<span class="relative mt-1 inline-flex size-5 shrink-0 items-center justify-center">
					<input
						type="radio"
						name={`${uid}-decision`}
						value="confirm_distinct"
						checked={decision === 'confirm_distinct'}
						disabled={isBusy}
						onchange={() => selectDecision('confirm_distinct')}
						class="peer size-5 appearance-none rounded-full border border-hairline-strong bg-canvas checked:border-brand disabled:cursor-not-allowed disabled:opacity-60"
					/>
					<span
						class="pointer-events-none absolute size-2 rounded-full bg-brand opacity-0 peer-checked:opacity-100"
					></span>
				</span>
				<span class="flex flex-col gap-1">
					<span class="text-callout text-ink">Confirm these are different records</span>
					<span class="text-footnote text-ink-secondary">
						Keep both records and release the held record.
					</span>
				</span>
			</label>
		</fieldset>

		<Textarea
			label="Review note"
			bind:value={note}
			hint={decision === 'confirm_distinct'
				? 'Required. Explain why these records are different.'
				: 'Recorded in the audit trail.'}
			error={noteError ?? undefined}
			required={decision === 'confirm_distinct'}
			disabled={isBusy}
		/>

		{#if shownError}
			<p class="flex items-start gap-2 text-callout text-critical-ink" role="alert">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{shownError}</span>
			</p>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="secondary" onclick={() => (open = false)} disabled={isBusy}>Cancel</Button>
		<Button
			variant={decision === 'confirm_distinct' ? 'destructive' : 'primary'}
			onclick={() => void submit()}
			loading={isBusy}
			loadingLabel="Saving…"
		>
			{decision === 'confirm_distinct'
				? 'Confirm distinct'
				: decision === 'link_to_existing'
					? 'Link to existing'
					: 'Submit review'}
		</Button>
	{/snippet}
</Dialog>
