<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { Button, Dialog, Select, Textarea } from '$shared/presentation/ui';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { NoteCategory, SurveyNote, SurveyRoomTree } from '$modules/surveys/domain/types';
	import { NOTE_CATEGORIES } from '$modules/surveys/domain/types';
	import { noteFormSchema } from '$modules/surveys/domain/validations';
	import { fieldErrorsFrom } from '$modules/surveys/presentation/field-errors';
	import { NOTE_CATEGORY_LABELS } from '$modules/surveys/presentation/survey-labels';

	/**
	 * Append-only note (Part 9 §11).
	 *
	 * A note is never silently edited: revising creates a new revision on the
	 * server, which keeps the site record honest.
	 */
	interface Props {
		open?: boolean;
		surveyId: string;
		rooms: SurveyRoomTree[];
		defaultRoomId?: string | null;
		oncreated?: (note: SurveyNote) => void;
		onclose: () => void;
	}

	let {
		open = $bindable(false),
		surveyId,
		rooms,
		defaultRoomId = null,
		oncreated,
		onclose
	}: Props = $props();

	const CATEGORY_OPTIONS = NOTE_CATEGORIES.map((category) => ({
		value: category,
		label: NOTE_CATEGORY_LABELS[category]
	}));
	const ROOM_OPTIONS = $derived([
		{ value: '', label: 'Survey-level note' },
		...rooms.map((tree) => ({ value: tree.room.id, label: tree.room.caption }))
	]);

	let category = $state<NoteCategory>('observation');
	let roomId = $state('');
	let body = $state('');
	let errors = $state<Record<string, string>>({});
	let serverError = $state('');
	let submitting = $state(false);
	let wasOpen = false;

	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;
		errors = {};
		serverError = '';
		category = 'observation';
		roomId = defaultRoomId ?? '';
		body = '';
	});

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const parsed = noteFormSchema.safeParse({
			surveyRoomId: roomId,
			category,
			body
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			const created = await surveysApi.createNote(surveyId, {
				surveyRoomId: parsed.data.surveyRoomId ?? null,
				category: parsed.data.category,
				body: parsed.data.body
			});
			open = false;
			oncreated?.(created);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this note. Try again.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

{#snippet footer()}
	<Button variant="secondary" onclick={onclose} disabled={submitting}>Cancel</Button>
	<Button
		variant="primary"
		type="submit"
		form="note-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		Add note
	</Button>
{/snippet}

<Dialog
	bind:open
	title="Add note"
	description="Notes are appended to the survey record and never overwritten."
	{footer}
	onclose={() => {
		serverError = '';
	}}
>
	<form
		id="note-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label="Add note"
	>
		<Select
			label="Note for"
			value={roomId}
			options={ROOM_OPTIONS}
			hint="Leave it on the survey when it is not about one room."
			error={errors.surveyRoomId}
			disabled={submitting}
			onchange={(event) => (roomId = (event.currentTarget as HTMLSelectElement).value)}
		/>
		<Select
			label="Category"
			required
			value={category}
			options={CATEGORY_OPTIONS}
			error={errors.category}
			disabled={submitting}
			onchange={(event) =>
				(category = (event.currentTarget as HTMLSelectElement).value as NoteCategory)}
		/>
		<Textarea
			label="Note"
			required
			bind:value={body}
			rows={5}
			maxlength={20000}
			placeholder="The customer wants the sink under the window, but the radiator is there."
			error={errors.body}
			disabled={submitting}
		/>

		{#if serverError}
			<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{serverError}</span>
			</p>
		{/if}
	</form>
</Dialog>
