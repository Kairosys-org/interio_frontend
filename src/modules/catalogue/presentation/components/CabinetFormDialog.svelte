<script lang="ts">
	import { isApiError } from '$network/errors';
	import type { CabinetFamily, ConstructionMethod } from '$shared/domain/record-states';
	import { CABINET_FAMILIES, CONSTRUCTION_METHODS } from '$shared/domain/record-states';
	import { Button, Dialog, Input, Select, Textarea } from '$shared/presentation/ui';
	import { catalogueApi } from '../../data/api';
	import type { Cabinet } from '../../domain/types';
	import { cabinetFormSchema, fieldErrorsFrom } from '../../domain/validations';
	import { CABINET_FAMILY_LABELS, CONSTRUCTION_METHOD_LABELS } from '../catalogue-display';

	/**
	 * New / edit cabinet dialog (phase-3 §1 catalogue).
	 *
	 * The family is fixed after creation because placement options are chosen
	 * from it; the caption, description, construction method and active flag
	 * stay editable. Deactivation is the archive state — nothing is deleted.
	 */
	interface Props {
		open?: boolean;
		cabinet?: Cabinet | null;
		onClose: () => void;
		onSaved: (cabinet: Cabinet) => void;
	}

	let { open = $bindable(false), cabinet = null, onClose, onSaved }: Props = $props();

	const editing = $derived(cabinet !== null);

	const familyOptions = CABINET_FAMILIES.map((family) => ({
		value: family,
		label: CABINET_FAMILY_LABELS[family]
	}));
	const constructionOptions = CONSTRUCTION_METHODS.map((method) => ({
		value: method,
		label: CONSTRUCTION_METHOD_LABELS[method]
	}));

	let caption = $state('');
	let family = $state<CabinetFamily>('base');
	let constructionMethod = $state<ConstructionMethod>('cam_lock');
	let description = $state('');
	let active = $state(true);

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

		caption = cabinet?.caption ?? '';
		family = cabinet?.family ?? 'base';
		constructionMethod = cabinet?.constructionMethod ?? 'cam_lock';
		description = cabinet?.description ?? '';
		active = cabinet?.active ?? true;
		errors = {};
		serverError = '';
		submitting = false;
	});

	function close(): void {
		if (submitting) return;
		onClose();
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const parsed = cabinetFormSchema.safeParse({
			caption,
			family,
			description: description.trim().length > 0 ? description : null,
			constructionMethod
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			const saved =
				cabinet === null
					? await catalogueApi.create(parsed.data)
					: await catalogueApi.update(cabinet.id, {
							caption: parsed.data.caption,
							description: parsed.data.description,
							constructionMethod: parsed.data.constructionMethod,
							active
						});
			open = false;
			onSaved(saved);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this cabinet. Try again.';
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
		form="cabinet-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save cabinet' : 'Create cabinet'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit cabinet' : 'New cabinet'}
	description={editing
		? 'Update the catalogue entry. Existing units keep the configuration they were built with.'
		: 'Add a parametric cabinet to your master catalogue.'}
	{footer}
	onclose={onClose}
>
	<form
		id="cabinet-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit cabinet' : 'New cabinet'}
	>
		<Input
			label="Caption"
			required
			bind:value={caption}
			maxlength={120}
			placeholder="Base unit — two door"
			error={errors.caption}
			disabled={submitting}
		/>

		<Select
			label="Family"
			required
			bind:value={family}
			options={familyOptions}
			disabled={submitting || editing}
			hint={editing
				? 'The family is fixed after creation.'
				: 'Where the cabinet appears in placement.'}
			error={errors.family}
		/>

		<Select
			label="Construction method"
			required
			bind:value={constructionMethod}
			options={constructionOptions}
			error={errors.constructionMethod}
			disabled={submitting}
		/>

		<Textarea
			label="Description"
			bind:value={description}
			rows={3}
			maxlength={500}
			hint="Optional. Shown on the cabinet detail page."
			error={errors.description}
			disabled={submitting}
		/>

		{#if editing}
			<label class="flex min-h-target items-center gap-3 text-callout text-ink">
				<input
					type="checkbox"
					checked={active}
					disabled={submitting}
					onchange={(event) => (active = event.currentTarget.checked)}
				/>
				<span>Active in the catalogue</span>
			</label>
			<p class="-mt-2 text-footnote text-ink-secondary">
				Discontinued cabinets stay on existing units and can still be reactivated.
			</p>
		{/if}

		{#if serverError}
			<p class="text-callout text-critical-ink" role="alert">{serverError}</p>
		{/if}
	</form>
</Dialog>
