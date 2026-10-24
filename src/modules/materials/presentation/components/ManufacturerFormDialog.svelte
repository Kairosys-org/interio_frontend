<script lang="ts">
	import { isApiError } from '$network/errors';
	import { Button, Checkbox, Dialog, Input } from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { Manufacturer } from '../../domain/types';
	import { fieldErrorsFrom, manufacturerFormSchema } from '../../domain/validations';

	/**
	 * New / edit manufacturer dialog (phase-3 §1 materials).
	 *
	 * Manufacturer and collection names are stored as typed; the collection
	 * dialog checks uniqueness inside a manufacturer and reports a conflict
	 * without renaming anything.
	 */
	interface Props {
		open?: boolean;
		manufacturer?: Manufacturer | null;
		onClose: () => void;
		onSaved: (manufacturer: Manufacturer) => void;
	}

	let { open = $bindable(false), manufacturer = null, onClose, onSaved }: Props = $props();

	const editing = $derived(manufacturer !== null);

	let caption = $state('');
	let country = $state('');
	let website = $state('');
	let active = $state(true);

	let errors = $state<Record<string, string>>({});
	let serverError = $state<string | null>(null);
	let submitting = $state(false);

	let wasOpen = false;
	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;

		caption = manufacturer?.caption ?? '';
		country = manufacturer?.country ?? '';
		website = manufacturer?.website ?? '';
		active = manufacturer?.active ?? true;
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

		const parsed = manufacturerFormSchema.safeParse({
			caption,
			country: country.trim().length > 0 ? country : null,
			website: website.trim().length > 0 ? website : null
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			const saved =
				manufacturer === null
					? await materialsApi.createManufacturer(parsed.data)
					: await materialsApi.updateManufacturer(manufacturer.id, {
							...parsed.data,
							active
						});
			open = false;
			onSaved(saved);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this manufacturer. Try again.';
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
		form="manufacturer-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save manufacturer' : 'Create manufacturer'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit manufacturer' : 'New manufacturer'}
	description="Each manufacturer holds one level of collections; decors belong to a collection."
	{footer}
	onclose={onClose}
>
	<form
		id="manufacturer-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit manufacturer' : 'New manufacturer'}
	>
		<Input
			label="Caption"
			required
			bind:value={caption}
			maxlength={200}
			placeholder="Kairos Laminates"
			error={errors.caption}
			disabled={submitting}
		/>

		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				label="Country"
				bind:value={country}
				maxlength={100}
				placeholder="Germany"
				error={errors.country}
				disabled={submitting}
			/>
			<Input
				label="Website"
				bind:value={website}
				maxlength={200}
				placeholder="kairos-laminates.example"
				error={errors.website}
				disabled={submitting}
			/>
		</div>

		{#if editing}
			<Checkbox
				label="Active"
				bind:checked={active}
				description="Inactive manufacturers and their collections stay on existing decors."
				disabled={submitting}
			/>
		{/if}

		{#if serverError}
			<p class="text-callout text-critical-ink" role="alert">{serverError}</p>
		{/if}
	</form>
</Dialog>
