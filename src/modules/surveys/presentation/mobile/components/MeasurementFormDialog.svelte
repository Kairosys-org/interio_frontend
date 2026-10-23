<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { Button, Dialog, DimensionField, Input, Select } from '$shared/presentation/ui';
	import { surveysApi } from '$modules/surveys/data/api';
	import type {
		MeasurementSource,
		MeasurementTargetType,
		SurveyMeasurement,
		SurveyRoomTree
	} from '$modules/surveys/domain/types';
	import {
		MEASUREMENT_SOURCES,
		MEASUREMENT_TARGET_TYPES,
		isCriticalDimensionKind
	} from '$modules/surveys/domain/types';
	import { measurementFormSchema } from '$modules/surveys/domain/validations';
	import { fieldErrorsFrom } from '$modules/surveys/presentation/field-errors';
	import {
		MEASUREMENT_SOURCE_LABELS,
		MEASUREMENT_TARGET_LABELS
	} from '$modules/surveys/presentation/survey-labels';

	/**
	 * Measurement capture — the core mobile screen (Part 9 §10).
	 *
	 * Room is mandatory. The critical flag follows the target kind through the
	 * server's own predicate, so the surveyor sees "this feeds G8" before
	 * saving. The source explains where the number came from; LiDAR and
	 * imported files require a device note, exactly like the server.
	 */
	interface Props {
		open?: boolean;
		surveyId: string;
		rooms: SurveyRoomTree[];
		measurement?: SurveyMeasurement | null;
		defaultRoomId?: string | null;
		oncreated?: (measurement: SurveyMeasurement) => void;
		onupdated?: (measurement: SurveyMeasurement) => void;
		onclose: () => void;
	}

	let {
		open = $bindable(false),
		surveyId,
		rooms,
		measurement = null,
		defaultRoomId = null,
		oncreated,
		onupdated,
		onclose
	}: Props = $props();

	const editing = $derived(measurement !== null);

	const TARGET_OPTIONS = MEASUREMENT_TARGET_TYPES.map((target) => ({
		value: target,
		label: MEASUREMENT_TARGET_LABELS[target]
	}));
	const SOURCE_OPTIONS = MEASUREMENT_SOURCES.map((source) => ({
		value: source,
		label: MEASUREMENT_SOURCE_LABELS[source]
	}));
	const ROOM_OPTIONS = $derived(
		rooms.map((tree) => ({ value: tree.room.id, label: tree.room.caption }))
	);

	let roomId = $state('');
	let targetType = $state<MeasurementTargetType>('ceiling_height');
	let targetCaption = $state('');
	let value = $state('');
	let source = $state<MeasurementSource>('laser');
	let deviceInfo = $state('');
	let wallId = $state('');
	let openingId = $state('');
	let errors = $state<Record<string, string>>({});
	let serverError = $state('');
	let submitting = $state(false);
	let wasOpen = false;

	const critical = $derived(isCriticalDimensionKind(targetType));
	const deviceRequired = $derived(source === 'lidar' || source === 'imported_file');

	const activeRoom = $derived(rooms.find((tree) => tree.room.id === roomId) ?? null);
	const wallOptions = $derived([
		{ value: '', label: 'No wall' },
		...(activeRoom?.walls.map((wall) => ({ value: wall.id, label: wall.caption })) ?? [])
	]);
	const openingOptions = $derived([
		{ value: '', label: 'No opening' },
		...(activeRoom?.openings.map((opening) => ({
			value: opening.id,
			label: opening.caption?.trim() || 'Opening'
		})) ?? [])
	]);

	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;
		errors = {};
		serverError = '';
		if (measurement) {
			roomId = measurement.surveyRoomId;
			targetType = measurement.targetType;
			targetCaption = measurement.targetCaption ?? '';
			value = String(measurement.valueMm);
			source = measurement.source;
			deviceInfo = measurement.deviceInfo ?? '';
			wallId = measurement.surveyWallId ?? '';
			openingId = measurement.surveyOpeningId ?? '';
		} else {
			roomId = defaultRoomId ?? rooms[0]?.room.id ?? '';
			targetType = 'ceiling_height';
			targetCaption = '';
			value = '';
			source = 'laser';
			deviceInfo = '';
			wallId = '';
			openingId = '';
		}
	});

	$effect(() => {
		// Choosing a different room invalidates the wall/opening context.
		if (!roomId) return;
		if (!activeRoom) return;
		if (wallId && !activeRoom.walls.some((wall) => wall.id === wallId)) wallId = '';
		if (openingId && !activeRoom.openings.some((opening) => opening.id === openingId))
			openingId = '';
	});

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const parsed = measurementFormSchema.safeParse({
			surveyRoomId: roomId,
			targetType,
			targetCaption,
			valueMm: value,
			source,
			deviceInfo,
			surveyWallId: wallId,
			surveyOpeningId: openingId
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			if (measurement) {
				const updated = await surveysApi.updateMeasurement(measurement.id, {
					targetType: parsed.data.targetType,
					targetCaption: parsed.data.targetCaption ?? null,
					valueMm: parsed.data.valueMm,
					source: parsed.data.source,
					deviceInfo: parsed.data.deviceInfo ?? null
				});
				open = false;
				onupdated?.(updated);
			} else {
				const created = await surveysApi.createMeasurement(surveyId, {
					surveyRoomId: parsed.data.surveyRoomId,
					targetType: parsed.data.targetType,
					targetCaption: parsed.data.targetCaption ?? null,
					valueMm: parsed.data.valueMm,
					source: parsed.data.source,
					deviceInfo: parsed.data.deviceInfo ?? null,
					surveyWallId: parsed.data.surveyWallId ?? null,
					surveyOpeningId: parsed.data.surveyOpeningId ?? null
				});
				open = false;
				oncreated?.(created);
			}
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this measurement. Try again.';
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
		form="measurement-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save reading' : 'Save reading'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit measurement' : 'Capture measurement'}
	description="Record the value, where it came from and the context it belongs to."
	{footer}
	onclose={() => {
		serverError = '';
	}}
>
	<form
		id="measurement-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit measurement' : 'Capture measurement'}
	>
		<Select
			label="Room"
			required
			value={roomId}
			options={ROOM_OPTIONS}
			placeholder={ROOM_OPTIONS.length === 0 ? 'Add a room first' : 'Choose a room'}
			error={errors.surveyRoomId}
			disabled={submitting || editing}
			onchange={(event) => (roomId = (event.currentTarget as HTMLSelectElement).value)}
		/>

		<Select
			label="What was measured"
			required
			value={targetType}
			options={TARGET_OPTIONS}
			error={errors.targetType}
			disabled={submitting}
			onchange={(event) =>
				(targetType = (event.currentTarget as HTMLSelectElement).value as MeasurementTargetType)}
		/>

		{#if targetType === 'other'}
			<Input
				label="Custom name"
				required
				bind:value={targetCaption}
				maxlength={200}
				placeholder="Worktop height"
				error={errors.targetCaption}
				disabled={submitting}
			/>
		{/if}

		<DimensionField
			label="Reading"
			required
			bind:value
			min={1}
			max={30000}
			{critical}
			hint={critical
				? 'Manufacturing-critical: this value must be verified before the survey can be verified.'
				: 'Standard reading; it does not block verification.'}
			error={errors.valueMm}
			disabled={submitting}
		/>

		<Select
			label="Source"
			required
			value={source}
			options={SOURCE_OPTIONS}
			hint={deviceRequired
				? 'LiDAR and imported files need a device note.'
				: 'Laser and manual readings do not need a device note.'}
			error={errors.source}
			disabled={submitting}
			onchange={(event) =>
				(source = (event.currentTarget as HTMLSelectElement).value as MeasurementSource)}
		/>

		<Input
			label="Device or file"
			bind:value={deviceInfo}
			maxlength={200}
			placeholder="Leica DISTO D2"
			hint={deviceRequired ? 'Required for this source.' : 'Optional.'}
			error={errors.deviceInfo}
			disabled={submitting}
		/>

		<Select
			label="Wall"
			value={wallId}
			options={wallOptions}
			disabled={submitting || !activeRoom}
			onchange={(event) => (wallId = (event.currentTarget as HTMLSelectElement).value)}
		/>
		<Select
			label="Opening"
			value={openingId}
			options={openingOptions}
			disabled={submitting || !activeRoom}
			onchange={(event) => (openingId = (event.currentTarget as HTMLSelectElement).value)}
		/>

		{#if serverError}
			<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{serverError}</span>
			</p>
		{/if}
	</form>
</Dialog>
