<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { Button, Dialog, DimensionField, Input, Textarea } from '$shared/presentation/ui';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { SurveyWall } from '$modules/surveys/domain/types';
	import { wallFormSchema } from '$modules/surveys/domain/validations';
	import { fieldErrorsFrom } from '$modules/surveys/presentation/field-errors';

	/**
	 * Wall capture (Part 9 §6): caption plus the two dimensions every opening
	 * is checked against, and an optional condition note.
	 */
	interface Props {
		open?: boolean;
		roomId: string;
		wall?: SurveyWall | null;
		oncreated?: (wall: SurveyWall) => void;
		onupdated?: (wall: SurveyWall) => void;
		onclose: () => void;
	}

	let {
		open = $bindable(false),
		roomId,
		wall = null,
		oncreated,
		onupdated,
		onclose
	}: Props = $props();

	const editing = $derived(wall !== null);

	let caption = $state('');
	let length = $state('');
	let height = $state('');
	let condition = $state('');
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
		caption = wall?.caption ?? '';
		length = wall ? String(wall.lengthMm) : '';
		height = wall ? String(wall.heightMm) : '';
		condition = wall?.condition ?? '';
	});

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const parsed = wallFormSchema.safeParse({
			caption,
			lengthMm: length,
			heightMm: height,
			condition
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			if (wall) {
				const updated = await surveysApi.updateWall(wall.id, parsed.data);
				open = false;
				onupdated?.(updated);
			} else {
				const created = await surveysApi.createWall(roomId, parsed.data);
				open = false;
				oncreated?.(created);
			}
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this wall. Try again.';
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
		form="wall-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save wall' : 'Add wall'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit wall' : 'Add wall'}
	description="Every opening is checked against the wall it sits in."
	{footer}
	onclose={() => {
		serverError = '';
	}}
>
	<form
		id="wall-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit wall' : 'Add wall'}
	>
		<Input
			label="Wall caption"
			required
			bind:value={caption}
			maxlength={200}
			placeholder="Wall A"
			error={errors.caption}
			disabled={submitting}
		/>
		<DimensionField
			label="Length"
			required
			bind:value={length}
			min={1}
			max={30000}
			error={errors.lengthMm}
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
		<Textarea
			label="Condition"
			bind:value={condition}
			rows={2}
			maxlength={2000}
			hint="Optional. Cracks, damp, uneven plaster."
			error={errors.condition}
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
