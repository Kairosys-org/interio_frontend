<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { Button, Dialog, DimensionField, Input, Select, Textarea } from '$shared/presentation/ui';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { SurveyUtility, SurveyWall, UtilityType } from '$modules/surveys/domain/types';
	import { UTILITY_TYPES } from '$modules/surveys/domain/types';
	import { utilityFormSchema } from '$modules/surveys/domain/validations';
	import { fieldErrorsFrom } from '$modules/surveys/presentation/field-errors';
	import { UTILITY_TYPE_LABELS } from '$modules/surveys/presentation/survey-labels';

	/** Utility point capture (Part 9 §8). */
	interface Props {
		open?: boolean;
		roomId: string;
		walls: SurveyWall[];
		utility?: SurveyUtility | null;
		oncreated?: (utility: SurveyUtility) => void;
		onupdated?: (utility: SurveyUtility) => void;
		onclose: () => void;
	}

	let {
		open = $bindable(false),
		roomId,
		walls,
		utility = null,
		oncreated,
		onupdated,
		onclose
	}: Props = $props();

	const editing = $derived(utility !== null);
	const TYPE_OPTIONS = UTILITY_TYPES.map((type) => ({
		value: type,
		label: UTILITY_TYPE_LABELS[type]
	}));
	const WALL_OPTIONS = $derived([
		{ value: '', label: 'No wall recorded' },
		...walls.map((wall) => ({ value: wall.id, label: wall.caption }))
	]);

	let utilityType = $state<UtilityType>('water');
	let locationDesc = $state('');
	let offset = $state('');
	let height = $state('');
	let notes = $state('');
	let wallId = $state('');
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
		if (utility) {
			utilityType = utility.utilityType;
			locationDesc = utility.locationDesc;
			offset = utility.positionOffsetMm === null ? '' : String(utility.positionOffsetMm);
			height = utility.heightFromFloorMm === null ? '' : String(utility.heightFromFloorMm);
			notes = utility.notes ?? '';
			wallId = utility.surveyWallId ?? '';
		} else {
			utilityType = 'water';
			locationDesc = '';
			offset = '';
			height = '';
			notes = '';
			wallId = '';
		}
	});

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const parsed = utilityFormSchema.safeParse({
			utilityType,
			locationDesc,
			positionOffsetMm: offset,
			heightFromFloorMm: height,
			notes,
			surveyWallId: wallId
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			if (utility) {
				const updated = await surveysApi.updateUtility(utility.id, parsed.data);
				open = false;
				onupdated?.(updated);
			} else {
				const created = await surveysApi.createUtility(roomId, parsed.data);
				open = false;
				oncreated?.(created);
			}
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this utility. Try again.';
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
		form="utility-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save utility' : 'Add utility'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit utility' : 'Add utility'}
	description="Sockets, radiators, pipework — anything the design must route around."
	{footer}
	onclose={() => {
		serverError = '';
	}}
>
	<form
		id="utility-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit utility' : 'Add utility'}
	>
		<Select
			label="Utility type"
			required
			value={utilityType}
			options={TYPE_OPTIONS}
			error={errors.utilityType}
			disabled={submitting}
			onchange={(event) =>
				(utilityType = (event.currentTarget as HTMLSelectElement).value as UtilityType)}
		/>
		<Input
			label="Location"
			required
			bind:value={locationDesc}
			maxlength={200}
			placeholder="Left of the sink, 400 mm from the corner"
			error={errors.locationDesc}
			disabled={submitting}
		/>
		<DimensionField
			label="Height from floor"
			bind:value={height}
			min={0}
			max={5000}
			error={errors.heightFromFloorMm}
			disabled={submitting}
		/>
		<DimensionField
			label="Offset along the wall"
			bind:value={offset}
			min={0}
			error={errors.positionOffsetMm}
			disabled={submitting}
		/>
		<Select
			label="Wall"
			value={wallId}
			options={WALL_OPTIONS}
			error={errors.surveyWallId}
			disabled={submitting}
			onchange={(event) => (wallId = (event.currentTarget as HTMLSelectElement).value)}
		/>
		<Textarea
			label="Notes"
			bind:value={notes}
			rows={2}
			maxlength={2000}
			error={errors.notes}
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
