<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import {
		Button,
		Checkbox,
		Dialog,
		DimensionField,
		Input,
		Select,
		Textarea
	} from '$shared/presentation/ui';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { ObstacleType, SurveyObstacle } from '$modules/surveys/domain/types';
	import { OBSTACLE_TYPES } from '$modules/surveys/domain/types';
	import { obstacleFormSchema } from '$modules/surveys/domain/validations';
	import { fieldErrorsFrom } from '$modules/surveys/presentation/field-errors';
	import { OBSTACLE_TYPE_LABELS } from '$modules/surveys/presentation/survey-labels';

	/** Obstacle capture (Part 9 §9), including the positioning warning. */
	interface Props {
		open?: boolean;
		roomId: string;
		obstacle?: SurveyObstacle | null;
		oncreated?: (obstacle: SurveyObstacle) => void;
		onupdated?: (obstacle: SurveyObstacle) => void;
		onclose: () => void;
	}

	let {
		open = $bindable(false),
		roomId,
		obstacle = null,
		oncreated,
		onupdated,
		onclose
	}: Props = $props();

	const editing = $derived(obstacle !== null);
	const TYPE_OPTIONS = OBSTACLE_TYPES.map((type) => ({
		value: type,
		label: OBSTACLE_TYPE_LABELS[type]
	}));

	let obstacleType = $state<ObstacleType>('pipe');
	let description = $state('');
	let width = $state('');
	let height = $state('');
	let depth = $state('');
	let blocksPositioning = $state(false);
	let positionDesc = $state('');
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
		if (obstacle) {
			obstacleType = obstacle.obstacleType;
			description = obstacle.description;
			width = obstacle.widthMm === null ? '' : String(obstacle.widthMm);
			height = obstacle.heightMm === null ? '' : String(obstacle.heightMm);
			depth = obstacle.depthMm === null ? '' : String(obstacle.depthMm);
			blocksPositioning = obstacle.blocksPositioning;
			positionDesc = obstacle.positionDesc ?? '';
		} else {
			obstacleType = 'pipe';
			description = '';
			width = '';
			height = '';
			depth = '';
			blocksPositioning = false;
			positionDesc = '';
		}
	});

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const parsed = obstacleFormSchema.safeParse({
			obstacleType,
			description,
			widthMm: width,
			heightMm: height,
			depthMm: depth,
			blocksPositioning,
			positionDesc
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			if (obstacle) {
				const updated = await surveysApi.updateObstacle(obstacle.id, parsed.data);
				open = false;
				onupdated?.(updated);
			} else {
				const created = await surveysApi.createObstacle(roomId, parsed.data);
				open = false;
				oncreated?.(created);
			}
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this obstacle. Try again.';
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
		form="obstacle-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save obstacle' : 'Add obstacle'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit obstacle' : 'Add obstacle'}
	description="Anything fixed in the room that limits the design."
	{footer}
	onclose={() => {
		serverError = '';
	}}
>
	<form
		id="obstacle-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit obstacle' : 'Add obstacle'}
	>
		<Select
			label="Obstacle type"
			required
			value={obstacleType}
			options={TYPE_OPTIONS}
			error={errors.obstacleType}
			disabled={submitting}
			onchange={(event) =>
				(obstacleType = (event.currentTarget as HTMLSelectElement).value as ObstacleType)}
		/>
		<Input
			label="Description"
			required
			bind:value={description}
			maxlength={500}
			placeholder="Cast-iron radiator under the window"
			error={errors.description}
			disabled={submitting}
		/>
		<DimensionField
			label="Width"
			bind:value={width}
			min={1}
			max={10000}
			error={errors.widthMm}
			disabled={submitting}
		/>
		<DimensionField
			label="Height"
			bind:value={height}
			min={1}
			max={10000}
			error={errors.heightMm}
			disabled={submitting}
		/>
		<DimensionField
			label="Depth"
			bind:value={depth}
			min={1}
			max={10000}
			error={errors.depthMm}
			disabled={submitting}
		/>
		<Checkbox
			label="Limits positioning"
			bind:checked={blocksPositioning}
			description="Tick when the design cannot ignore this obstacle."
			disabled={submitting}
		/>
		<Textarea
			label="Position note"
			bind:value={positionDesc}
			rows={2}
			maxlength={2000}
			error={errors.positionDesc}
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
