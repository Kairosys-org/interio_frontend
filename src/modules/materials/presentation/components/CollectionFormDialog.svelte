<script lang="ts">
	import { isApiError } from '$network/errors';
	import { Button, Checkbox, Dialog, Input } from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { MaterialCollection } from '../../domain/types';
	import {
		collectionFormSchema,
		collectionUpdateSchema,
		fieldErrorsFrom
	} from '../../domain/validations';

	/**
	 * New / edit collection dialog (phase-3 §1 materials).
	 *
	 * Collections only exist inside one manufacturer and never nest further.
	 * A caption clash inside the same manufacturer is a 409 conflict; the
	 * message names the existing collection.
	 */
	interface Props {
		open?: boolean;
		manufacturerId: string;
		manufacturerCaption: string;
		collection?: MaterialCollection | null;
		onClose: () => void;
		onSaved: (collection: MaterialCollection) => void;
	}

	let {
		open = $bindable(false),
		manufacturerId,
		manufacturerCaption,
		collection = null,
		onClose,
		onSaved
	}: Props = $props();

	const editing = $derived(collection !== null);

	let caption = $state('');
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

		caption = collection?.caption ?? '';
		active = collection?.active ?? true;
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

		if (collection === null) {
			const parsed = collectionFormSchema.safeParse({ manufacturerId, caption });
			if (!parsed.success) {
				errors = fieldErrorsFrom(parsed.error);
				return;
			}
			errors = {};
			submitting = true;
			try {
				const saved = await materialsApi.createCollection(parsed.data);
				open = false;
				onSaved(saved);
			} catch (caught) {
				if (isApiError(caught)) {
					if (caught.fieldErrors) errors = { ...caught.fieldErrors };
					serverError = caught.message;
				} else {
					serverError = 'We could not save this collection. Try again.';
				}
			} finally {
				submitting = false;
			}
			return;
		}

		const parsed = collectionUpdateSchema.safeParse({ caption, active });
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};
		submitting = true;
		try {
			const saved = await materialsApi.updateCollection(collection.id, parsed.data);
			open = false;
			onSaved(saved);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this collection. Try again.';
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
		form="collection-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save collection' : 'Create collection'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit collection' : 'New collection'}
	description={`A collection inside ${manufacturerCaption}. Names must be unique for this manufacturer.`}
	{footer}
	onclose={onClose}
>
	<form
		id="collection-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit collection' : 'New collection'}
	>
		<Input
			label="Caption"
			required
			bind:value={caption}
			maxlength={200}
			placeholder="Wood Grain"
			error={errors.caption}
			disabled={submitting}
		/>

		{#if editing}
			<Checkbox
				label="Active"
				bind:checked={active}
				description="Inactive collections stay on existing decors and are not offered for new ones."
				disabled={submitting}
			/>
		{/if}

		{#if serverError}
			<p class="text-callout text-critical-ink" role="alert">{serverError}</p>
		{/if}
	</form>
</Dialog>
