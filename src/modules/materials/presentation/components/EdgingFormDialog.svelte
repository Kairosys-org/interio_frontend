<script lang="ts">
	import { isApiError } from '$network/errors';
	import { DECOR_COLOUR_FAMILIES } from '$shared/domain/record-states';
	import type { DecorColourFamily } from '$shared/domain/record-states';
	import { Button, Checkbox, Dialog, Input, Select } from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { Edging } from '../../domain/types';
	import { edgingFormSchema, fieldErrorsFrom } from '../../domain/validations';
	import { COLOUR_FAMILY_LABELS } from '../materials-display';

	/**
	 * New / edit edging dialog (phase-3 §1 materials, §3 `/materials/edging`).
	 *
	 * Edgings are master data: deactivating keeps the record and every decor
	 * link intact. There is no delete action in this phase.
	 */
	interface Props {
		open?: boolean;
		edging?: Edging | null;
		onClose: () => void;
		onSaved: (edging: Edging) => void;
	}

	let { open = $bindable(false), edging = null, onClose, onSaved }: Props = $props();

	const editing = $derived(edging !== null);

	let caption = $state('');
	let edgingCode = $state('');
	let materialType = $state('');
	let thickness = $state('1');
	let colourFamily = $state<DecorColourFamily | ''>('');
	let active = $state(true);

	let errors = $state<Record<string, string>>({});
	let serverError = $state<string | null>(null);
	let submitting = $state(false);

	const colourOptions = [
		{ value: '', label: 'No colour family' },
		...DECOR_COLOUR_FAMILIES.map((value) => ({ value, label: COLOUR_FAMILY_LABELS[value] }))
	];

	let wasOpen = false;
	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;

		caption = edging?.caption ?? '';
		edgingCode = edging?.edgingCode ?? '';
		materialType = edging?.materialType ?? 'ABS';
		thickness = String(edging?.thicknessMm ?? 1);
		colourFamily = edging?.colourFamily ?? '';
		active = edging?.active ?? true;
		errors = {};
		serverError = null;
		submitting = false;
	});

	function close(): void {
		if (submitting) return;
		onClose();
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = null;

		const parsed = edgingFormSchema.safeParse({
			caption,
			edgingCode,
			materialType,
			thicknessMm: Number(thickness),
			colourFamily: colourFamily === '' ? null : colourFamily,
			active
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			const saved =
				edging === null
					? await materialsApi.createEdging(parsed.data)
					: await materialsApi.updateEdging(edging.id, parsed.data);
			open = false;
			onSaved(saved);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this edging. Try again.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

{#snippet footer()}
	<Button variant="secondary" onclick={close} disabled={submitting}>Cancel</Button>
	<Button
		variant="primary"
		type="submit"
		form="edging-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save edging' : 'Create edging'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit edging' : 'New edging'}
	description="Edging is linked to decors with a match type: exact, complementary or alternative."
	{footer}
	onclose={onClose}
>
	<form
		id="edging-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit edging' : 'New edging'}
	>
		<Input
			label="Caption"
			required
			bind:value={caption}
			maxlength={200}
			placeholder="1 mm ABS white"
			error={errors.caption}
			disabled={submitting}
		/>

		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				label="Edging code"
				required
				bind:value={edgingCode}
				maxlength={64}
				placeholder="ABS-WH-1"
				error={errors.edgingCode}
				disabled={submitting}
			/>
			<Input
				label="Material"
				required
				bind:value={materialType}
				maxlength={100}
				placeholder="ABS"
				error={errors.materialType}
				disabled={submitting}
			/>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				label="Thickness (mm)"
				required
				type="number"
				step="0.1"
				min="0.1"
				bind:value={thickness}
				error={errors.thicknessMm}
				disabled={submitting}
			/>
			<Select
				label="Colour family"
				bind:value={colourFamily}
				options={colourOptions}
				error={errors.colourFamily}
				disabled={submitting}
			/>
		</div>

		{#if editing}
			<Checkbox
				label="Active"
				bind:checked={active}
				description="Inactive edging stays on existing decor links and is not offered for new ones."
				disabled={submitting}
			/>
		{/if}

		{#if serverError}
			<p class="text-callout text-critical-ink" role="alert">{serverError}</p>
		{/if}
	</form>
</Dialog>
