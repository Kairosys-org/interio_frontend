<script lang="ts">
	import { isApiError } from '$network/errors';
	import { Button, Checkbox, Dialog, Input } from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { Supplier, SupplierDuplicateCandidate } from '../../domain/types';
	import { fieldErrorsFrom, supplierFormSchema } from '../../domain/validations';

	/**
	 * New / edit supplier dialog (phase-3 §1 materials).
	 *
	 * A create returns possible duplicate candidates but never merges them
	 * (R5). The dialog hands the candidates to the page, which shows a
	 * dismissible notice; the supplier itself is already saved.
	 */
	interface Props {
		open?: boolean;
		supplier?: Supplier | null;
		onClose: () => void;
		onSaved: (result: { supplier: Supplier; candidates: SupplierDuplicateCandidate[] }) => void;
	}

	let { open = $bindable(false), supplier = null, onClose, onSaved }: Props = $props();

	const editing = $derived(supplier !== null);

	let caption = $state('');
	let contact = $state('');
	let leadTime = $state('');
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

		caption = supplier?.caption ?? '';
		contact = supplier?.contact ?? '';
		leadTime =
			supplier?.leadTimeDays === null || supplier?.leadTimeDays === undefined
				? ''
				: String(supplier.leadTimeDays);
		active = supplier?.active ?? true;
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

		const parsed = supplierFormSchema.safeParse({
			caption,
			contact: contact.trim().length > 0 ? contact : null,
			leadTimeDays: leadTime.trim().length > 0 ? Number(leadTime) : null
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			if (supplier === null) {
				const created = await materialsApi.createSupplier(parsed.data);
				open = false;
				onSaved(created);
			} else {
				const saved = await materialsApi.updateSupplier(supplier.id, {
					...parsed.data,
					active
				});
				open = false;
				onSaved({ supplier: saved, candidates: [] });
			}
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this supplier. Try again.';
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
		form="supplier-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save supplier' : 'Create supplier'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit supplier' : 'New supplier'}
	description="Suppliers carry a lead time and the codes used on each decor link."
	{footer}
	onclose={onClose}
>
	<form
		id="supplier-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit supplier' : 'New supplier'}
	>
		<Input
			label="Caption"
			required
			bind:value={caption}
			maxlength={200}
			placeholder="Blum UK"
			error={errors.caption}
			disabled={submitting}
		/>

		<Input
			label="Contact"
			bind:value={contact}
			maxlength={200}
			placeholder="orders@blum.example"
			hint="Optional. An email, phone number or account manager."
			error={errors.contact}
			disabled={submitting}
		/>

		<Input
			label="Lead time (days)"
			type="number"
			min="0"
			max="365"
			step="1"
			bind:value={leadTime}
			placeholder="10"
			hint="Optional. Whole days from order to delivery."
			error={errors.leadTimeDays}
			disabled={submitting}
		/>

		{#if editing}
			<Checkbox
				label="Active"
				bind:checked={active}
				description="Inactive suppliers stay on existing decor links and are not offered for new ones."
				disabled={submitting}
			/>
		{/if}

		{#if serverError}
			<p class="text-callout text-critical-ink" role="alert">{serverError}</p>
		{/if}
	</form>
</Dialog>
