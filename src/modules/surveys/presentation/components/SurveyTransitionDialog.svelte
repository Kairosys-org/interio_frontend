<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { Button, Dialog, Textarea } from '$shared/presentation/ui';
	import type { SurveyAction } from '../../domain/types';

	/**
	 * One survey transition confirmation (Part 4 §2).
	 *
	 * Reject and reopen require a reason, exactly like the server; every other
	 * action still confirms because it changes who can edit the survey next.
	 */
	interface Props {
		open?: boolean;
		action: SurveyAction | null;
		surveyCaption?: string;
		saving?: boolean;
		error?: string | null;
		onconfirm: (reason: string) => void | Promise<void>;
	}

	let {
		open = $bindable(false),
		action,
		surveyCaption = 'this survey',
		saving = false,
		error = null,
		onconfirm
	}: Props = $props();

	const MAX_REASON = 500;

	const COPY: Readonly<
		Record<SurveyAction, { title: string; description: string; confirm: string }>
	> = Object.freeze({
		start: {
			title: 'Start capturing?',
			description: 'The survey moves to In progress so rooms and measurements can be captured.',
			confirm: 'Start capture'
		},
		submit: {
			title: 'Submit this survey?',
			description:
				'The surveyor cannot edit the survey while it is submitted. A production manager can reject or verify it.',
			confirm: 'Submit survey'
		},
		verify: {
			title: 'Verify this survey?',
			description:
				'Verification is final until a production manager reopens the survey. Every critical measurement must be verified first.',
			confirm: 'Verify survey'
		},
		reject: {
			title: 'Reject this survey?',
			description:
				'The survey returns to the surveyor as rejected. The reason is recorded and shown to them.',
			confirm: 'Reject survey'
		},
		reopen: {
			title: 'Reopen this survey?',
			description:
				'Every measurement verification is cleared and the survey must be verified again. The reason is recorded.',
			confirm: 'Reopen survey'
		},
		cancel: {
			title: 'Cancel this survey?',
			description: 'The survey stays on record but no work can continue on it. Nothing is deleted.',
			confirm: 'Cancel survey'
		},
		resume: {
			title: 'Resume capturing?',
			description: 'The rejected survey returns to In progress so the surveyor can fix it.',
			confirm: 'Resume capture'
		}
	});

	const copy = $derived(action ? COPY[action] : null);
	const reasonRequired = $derived(action === 'reject' || action === 'reopen');

	let reason = $state('');
	let localError = $state<string | null>(null);
	let submitting = $state(false);
	let previousAction: SurveyAction | null = null;

	$effect(() => {
		const current = open ? action : null;
		if (current === previousAction) return;
		previousAction = current;
		reason = '';
		localError = null;
	});

	const busy = $derived(saving || submitting);
	const shownError = $derived(error ?? localError);

	async function submit(): Promise<void> {
		if (busy || action === null) return;
		localError = null;

		const trimmed = reason.trim();
		if (reasonRequired) {
			if (trimmed.length === 0) {
				localError =
					action === 'reject'
						? 'Add a reason for rejecting this survey.'
						: 'Add a reason for reopening this survey.';
				return;
			}
			if (trimmed.length > MAX_REASON) {
				localError = `Keep the reason to ${MAX_REASON} characters or fewer.`;
				return;
			}
		}

		submitting = true;
		try {
			await onconfirm(trimmed);
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
		variant={action === 'reject' || action === 'cancel' ? 'destructive' : 'primary'}
		type="submit"
		form="survey-transition-form"
		loading={busy}
		loadingLabel="Saving…"
	>
		{copy?.confirm ?? 'Continue'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={copy?.title ?? 'Change survey status'}
	description={copy?.description}
	{footer}
	onclose={() => {
		localError = null;
	}}
>
	<form
		id="survey-transition-form"
		class="flex flex-col gap-4"
		onsubmit={(event) => {
			event.preventDefault();
			void submit();
		}}
		novalidate
	>
		<p class="text-callout text-ink-secondary">
			This applies to <span class="text-ink">{surveyCaption}</span>.
		</p>

		{#if reasonRequired}
			<Textarea
				label="Reason"
				required
				bind:value={reason}
				rows={4}
				maxlength={MAX_REASON}
				hint="This reason appears in the survey's activity trail."
				error={shownError ?? undefined}
				oninput={() => (localError = null)}
			/>
		{:else if shownError}
			<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{shownError}</span>
			</p>
		{/if}
	</form>
</Dialog>
