<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { Button, Dialog, DimensionField, Input, Select, Textarea } from '$shared/presentation/ui';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { RoomType, SurveyRoom } from '$modules/surveys/domain/types';
	import { ROOM_TYPES } from '$modules/surveys/domain/types';
	import { roomFormSchema } from '$modules/surveys/domain/validations';
	import { fieldErrorsFrom } from '$modules/surveys/presentation/field-errors';
	import { ROOM_TYPE_LABELS } from '$modules/surveys/presentation/survey-labels';

	/**
	 * Room capture / edit (Part 9 §5).
	 *
	 * Dimensions are optional at creation: a surveyor standing in the doorway
	 * can name the room first and measure it in the room panel. An empty field
	 * stays null, never zero.
	 */
	interface Props {
		open?: boolean;
		surveyId: string;
		room?: SurveyRoom | null;
		oncreated?: (room: SurveyRoom) => void;
		onupdated?: (room: SurveyRoom) => void;
		onclose: () => void;
	}

	let {
		open = $bindable(false),
		surveyId,
		room = null,
		oncreated,
		onupdated,
		onclose
	}: Props = $props();

	const editing = $derived(room !== null);

	const ROOM_OPTIONS = ROOM_TYPES.map((type) => ({ value: type, label: ROOM_TYPE_LABELS[type] }));

	let caption = $state('');
	let roomType = $state<RoomType>('kitchen');
	let ceiling = $state('');
	let length = $state('');
	let width = $state('');
	let shapeNotes = $state('');
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
		if (room) {
			caption = room.caption;
			roomType = room.roomType;
			ceiling = room.ceilingHeightMm === null ? '' : String(room.ceilingHeightMm);
			length = room.roomLengthMm === null ? '' : String(room.roomLengthMm);
			width = room.roomWidthMm === null ? '' : String(room.roomWidthMm);
			shapeNotes = room.shapeNotes ?? '';
		} else {
			caption = '';
			roomType = 'kitchen';
			ceiling = '';
			length = '';
			width = '';
			shapeNotes = '';
		}
	});

	function toNumber(value: string): number | null {
		if (value.trim() === '') return null;
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : null;
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const parsed = roomFormSchema.safeParse({
			caption,
			roomType,
			ceilingHeightMm: ceiling,
			roomLengthMm: length,
			roomWidthMm: width,
			shapeNotes
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		const values = parsed.data;
		submitting = true;
		try {
			if (room) {
				const updated = await surveysApi.updateRoom(room.id, {
					caption: values.caption,
					roomType: values.roomType,
					ceilingHeightMm: values.ceilingHeightMm ?? null,
					roomLengthMm: values.roomLengthMm ?? null,
					roomWidthMm: values.roomWidthMm ?? null,
					shapeNotes: values.shapeNotes ?? null
				});
				open = false;
				onupdated?.(updated);
			} else {
				const created = await surveysApi.createRoom(surveyId, {
					caption: values.caption,
					roomType: values.roomType,
					shapeNotes: values.shapeNotes ?? null
				});
				// Dimensions are a separate, explicit write so an empty field is
				// never sent as zero.
				const withDimensions = await surveysApi.updateRoom(created.id, {
					ceilingHeightMm: toNumber(ceiling),
					roomLengthMm: toNumber(length),
					roomWidthMm: toNumber(width)
				});
				open = false;
				oncreated?.(withDimensions);
			}
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this room. Try again.';
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
		form="room-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save room' : 'Add room'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit room' : 'Add room'}
	description="Name the room, then capture its dimensions."
	{footer}
	onclose={() => {
		serverError = '';
	}}
>
	<form
		id="room-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit room' : 'Add room'}
	>
		<Input
			label="Room caption"
			required
			bind:value={caption}
			maxlength={200}
			placeholder="Kitchen"
			error={errors.caption}
			disabled={submitting}
		/>

		<Select
			label="Room type"
			required
			value={roomType}
			options={ROOM_OPTIONS}
			error={errors.roomType}
			disabled={submitting}
			onchange={(event) =>
				(roomType = (event.currentTarget as HTMLSelectElement).value as RoomType)}
		/>

		<DimensionField
			label="Ceiling height"
			bind:value={ceiling}
			min={500}
			max={10000}
			error={errors.ceilingHeightMm}
			disabled={submitting}
		/>
		<DimensionField
			label="Room length"
			bind:value={length}
			min={1}
			max={30000}
			error={errors.roomLengthMm}
			disabled={submitting}
		/>
		<DimensionField
			label="Room width"
			bind:value={width}
			min={1}
			max={30000}
			error={errors.roomWidthMm}
			disabled={submitting}
		/>

		<Textarea
			label="Shape notes"
			bind:value={shapeNotes}
			rows={2}
			maxlength={2000}
			hint="Optional. Alcoves, sloping ceilings, anything a drawing would show."
			error={errors.shapeNotes}
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
