<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { Button, Dialog, DimensionField, Input, Select, Textarea } from '$shared/presentation/ui';
	import { surveysApi } from '$modules/surveys/data/api';
	import type {
		OpeningType,
		SurveyOpening,
		SurveyWall,
		SwingDirection
	} from '$modules/surveys/domain/types';
	import { OPENING_TYPES, SWING_DIRECTIONS } from '$modules/surveys/domain/types';
	import { openingFormSchema } from '$modules/surveys/domain/validations';
	import { requiresSill, requiresSwing } from '$modules/surveys/domain/rules';
	import { fieldErrorsFrom } from '$modules/surveys/presentation/field-errors';
	import { OPENING_TYPE_LABELS } from '$modules/surveys/presentation/survey-labels';

	/**
	 * Opening capture (Part 9 §7).
	 *
	 * Window ⇒ sill height, door ⇒ swing direction (the same predicates the
	 * server uses). Choosing no wall leaves the opening `unattached`, which the
	 * room page keeps visible until it is linked.
	 */
	interface Props {
		open?: boolean;
		roomId: string;
		walls: SurveyWall[];
		opening?: SurveyOpening | null;
		defaultWallId?: string | null;
		oncreated?: (opening: SurveyOpening) => void;
		onupdated?: (opening: SurveyOpening) => void;
		onclose: () => void;
	}

	let {
		open = $bindable(false),
		roomId,
		walls,
		opening = null,
		defaultWallId = null,
		oncreated,
		onupdated,
		onclose
	}: Props = $props();

	const editing = $derived(opening !== null);

	const TYPE_OPTIONS = OPENING_TYPES.map((type) => ({
		value: type,
		label: OPENING_TYPE_LABELS[type]
	}));
	const SWING_OPTIONS = SWING_DIRECTIONS.map((direction) => ({
		value: direction,
		label:
			direction === 'none' ? 'No swing' : direction.charAt(0).toUpperCase() + direction.slice(1)
	}));
	const WALL_OPTIONS = $derived([
		{ value: '', label: 'Not linked to a wall yet' },
		...walls.map((wall) => ({ value: wall.id, label: wall.caption }))
	]);

	let openingType = $state<OpeningType>('window');
	let caption = $state('');
	let width = $state('');
	let height = $state('');
	let sill = $state('');
	let swing = $state<SwingDirection>('none');
	let reveal = $state('');
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
		if (opening) {
			openingType = opening.openingType;
			caption = opening.caption ?? '';
			width = String(opening.widthMm);
			height = String(opening.heightMm);
			sill = opening.sillHeightMm === null ? '' : String(opening.sillHeightMm);
			swing = opening.swingDirection ?? 'none';
			reveal = opening.revealDepthMm === null ? '' : String(opening.revealDepthMm);
			notes = opening.notes ?? '';
			wallId = opening.surveyWallId ?? '';
		} else {
			openingType = 'window';
			caption = '';
			width = '';
			height = '';
			sill = '';
			swing = 'none';
			reveal = '';
			notes = '';
			wallId = defaultWallId ?? '';
		}
	});

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const parsed = openingFormSchema.safeParse({
			openingType,
			caption,
			widthMm: width,
			heightMm: height,
			sillHeightMm: sill,
			swingDirection: requiresSwing(openingType) ? (swing === 'none' ? '' : swing) : swing,
			revealDepthMm: reveal,
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
			if (opening) {
				const updated = await surveysApi.updateOpening(opening.id, parsed.data);
				open = false;
				onupdated?.(updated);
			} else {
				const created = await surveysApi.createOpening(roomId, parsed.data);
				open = false;
				oncreated?.(created);
			}
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this opening. Try again.';
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
		form="opening-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save opening' : 'Add opening'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit opening' : 'Add opening'}
	description="Record the type, size and the wall it is cut into."
	{footer}
	onclose={() => {
		serverError = '';
	}}
>
	<form
		id="opening-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit opening' : 'Add opening'}
	>
		<Select
			label="Opening type"
			required
			value={openingType}
			options={TYPE_OPTIONS}
			error={errors.openingType}
			disabled={submitting}
			onchange={(event) =>
				(openingType = (event.currentTarget as HTMLSelectElement).value as OpeningType)}
		/>

		<Input
			label="Caption"
			bind:value={caption}
			maxlength={200}
			placeholder="Front window"
			hint="Optional. The type is enough when there is only one."
			error={errors.caption}
			disabled={submitting}
		/>

		<DimensionField
			label="Width"
			required
			bind:value={width}
			min={1}
			max={10000}
			error={errors.widthMm}
			disabled={submitting}
		/>
		<DimensionField
			label="Height"
			required
			bind:value={height}
			min={1}
			max={10000}
			error={errors.heightMm}
			disabled={submitting}
		/>

		{#if requiresSill(openingType)}
			<DimensionField
				label="Sill height"
				required
				bind:value={sill}
				min={0}
				max={5000}
				hint="Windows always record a sill height."
				error={errors.sillHeightMm}
				disabled={submitting}
			/>
		{/if}

		{#if requiresSwing(openingType)}
			<Select
				label="Swing direction"
				required
				value={swing}
				options={SWING_OPTIONS}
				hint="Doors always record how they swing."
				error={errors.swingDirection}
				disabled={submitting}
				onchange={(event) =>
					(swing = (event.currentTarget as HTMLSelectElement).value as SwingDirection)}
			/>
		{/if}

		<DimensionField
			label="Reveal depth"
			bind:value={reveal}
			min={1}
			max={1000}
			error={errors.revealDepthMm}
			disabled={submitting}
		/>

		<Select
			label="Wall"
			value={wallId}
			options={WALL_OPTIONS}
			hint="Leaving this empty marks the opening as unattached."
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
