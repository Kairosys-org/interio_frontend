<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { formatDimension } from '$shared/lib/format';
	import { Button, Dialog, Select, Textarea } from '$shared/presentation/ui';
	import {
		VERIFICATION_METHODS,
		type SurveyMeasurement,
		type VerificationMethod
	} from '../../domain/types';
	import { measurementTargetLabel, VERIFICATION_METHOD_LABELS } from '../survey-labels';

	/**
	 * One critical-measurement verification (Part 9 §10 + G8).
	 *
	 * A method is mandatory — the server rejects a verification without one,
	 * and the note is optional context for the audit trail.
	 */
	interface Props {
		open?: boolean;
		measurement: SurveyMeasurement | null;
		/** Bulk mode: applies one method to every remaining critical row. */
		bulk?: boolean;
		count?: number;
		saving?: boolean;
		error?: string | null;
		onconfirm: (method: VerificationMethod, note: string | null) => void | Promise<void>;
	}

	let {
		open = $bindable(false),
		measurement,
		bulk = false,
		count = 0,
		saving = false,
		error = null,
		onconfirm
	}: Props = $props();

	const dialogTitle = $derived(
		bulk
			? `Verify ${count} critical ${count === 1 ? 'measurement' : 'measurements'}`
			: 'Verify critical measurement'
	);
	const dialogDescription = $derived(
		bulk
			? 'One method is recorded against every row verified in this action. Each row is still audited separately.'
			: 'Verification clears this row from gate G8. It is recorded with your name and the method.'
	);

	const METHOD_OPTIONS = VERIFICATION_METHODS.map((method) => ({
		value: method,
		label: VERIFICATION_METHOD_LABELS[method]
	}));

	let method = $state('');
	let note = $state('');
	let localError = $state<string | null>(null);
	let submitting = $state(false);
	let previousId: string | null = null;

	$effect(() => {
		const current = open ? (measurement?.id ?? (bulk ? 'bulk' : null)) : null;
		if (current === previousId) return;
		previousId = current;
		method = '';
		note = '';
		localError = null;
	});

	const busy = $derived(saving || submitting);
	const shownError = $derived(error ?? localError);

	async function submit(): Promise<void> {
		// Bulk mode has no single measurement; `onconfirm` owns the row list.
		if (busy) return;
		localError = null;

		if (method === '') {
			localError = 'Choose how this value was verified.';
			return;
		}

		submitting = true;
		try {
			await onconfirm(method as VerificationMethod, note.trim().length > 0 ? note.trim() : null);
		} catch {
			// The page owns the failure message and keeps the dialog open.
		} finally {
			submitting = false;
		}
	}
</script>

{#snippet footer()}
	<Button variant="secondary" onclick={() => (open = false)} disabled={busy}>Cancel</Button>
	<Button
		variant="primary"
		type="submit"
		form="verify-measurement-form"
		loading={busy}
		loadingLabel="Verifying…"
	>
		{bulk ? 'Verify all' : 'Verify measurement'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={dialogTitle}
	description={dialogDescription}
	{footer}
	onclose={() => {
		localError = null;
	}}
>
	<form
		id="verify-measurement-form"
		class="flex flex-col gap-4"
		onsubmit={(event) => {
			event.preventDefault();
			void submit();
		}}
		novalidate
	>
		{#if measurement}
			<div class="flex flex-col gap-1 rounded-md border border-hairline bg-canvas-grouped p-3">
				<p class="text-callout text-ink">{measurementTargetLabel(measurement)}</p>
				<p class="text-headline text-ink tabular-nums">
					{formatDimension(measurement.valueMm)}
				</p>
				<p class="text-footnote text-ink-secondary">
					{measurement.deviceInfo ?? 'No device note'} · captured
					{measurement.capturedAt.slice(0, 10)}
				</p>
			</div>
		{/if}

		<Select
			label="Verification method"
			required
			bind:value={method}
			options={METHOD_OPTIONS}
			placeholder="Choose a method"
			hint="G8 requires a recorded method for every critical value."
			error={localError ?? undefined}
			disabled={busy}
		/>

		<Textarea
			label="Note"
			bind:value={note}
			rows={3}
			maxlength={500}
			hint="Optional. Explain anything the next person should know."
			disabled={busy}
		/>

		{#if error}
			<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{shownError}</span>
			</p>
		{/if}
	</form>
</Dialog>
