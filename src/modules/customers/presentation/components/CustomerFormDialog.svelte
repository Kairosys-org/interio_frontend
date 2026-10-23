<script lang="ts">
	import { isApiError } from '$network/errors';
	import { PREFERRED_CHANNELS, PREFERRED_CHANNEL_LABELS } from '$shared/domain/record-states';
	import { Button, Dialog, Input, Select } from '$shared/presentation/ui';
	import { customersApi } from '../../data/api';
	import type { Customer, CustomerDedupConflict } from '../../domain/types';
	import { customerFormSchema, fieldErrorsFrom } from '../../domain/validations';

	/**
	 * Create and edit customer dialog (DESIGN §10.2 Form / edit). One component
	 * for both modes: the only difference is the heading, the submit label and
	 * the call made after validation.
	 *
	 * A `409 conflict` carrying dedup details is not a form error: the record
	 * already exists as `pending_review`, so the dialog closes and the page
	 * opens the review flow.
	 */
	interface Props {
		open?: boolean;
		customer?: Customer | null;
		onSaved: (customer: Customer) => void;
		onDedupConflict: (conflict: CustomerDedupConflict) => void;
		onClose: () => void;
	}

	let {
		open = $bindable(false),
		customer = null,
		onSaved,
		onDedupConflict,
		onClose
	}: Props = $props();

	const editing = $derived(customer !== null);

	const CHANNEL_OPTIONS = PREFERRED_CHANNELS.map((value) => ({
		value,
		label: PREFERRED_CHANNEL_LABELS[value]
	}));

	let caption = $state('');
	let contactName = $state('');
	let email = $state('');
	let phone = $state('');
	let addressLine1 = $state('');
	let addressLine2 = $state('');
	let town = $state('');
	let postcode = $state('');
	let preferredChannel = $state<string>('email');

	let errors = $state<Record<string, string>>({});
	let serverError = $state('');
	let submitting = $state(false);

	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) fillForm();
		wasOpen = open;
	});

	function fillForm(): void {
		caption = customer?.caption ?? '';
		contactName = customer?.contactName ?? '';
		email = customer?.email ?? '';
		phone = customer?.phone ?? '';
		addressLine1 = customer?.addressLine1 ?? '';
		addressLine2 = customer?.addressLine2 ?? '';
		town = customer?.town ?? '';
		postcode = customer?.postcode ?? '';
		preferredChannel = customer?.preferredChannel ?? 'email';
		errors = {};
		serverError = '';
		submitting = false;
	}

	function close(): void {
		if (submitting) return;
		serverError = '';
		onClose();
	}

	function isCustomerDedupConflict(details: unknown): details is CustomerDedupConflict {
		if (typeof details !== 'object' || details === null) return false;
		const value = details as Partial<CustomerDedupConflict>;
		return (
			value.entityType === 'customer' &&
			typeof value.heldId === 'string' &&
			Array.isArray(value.candidates)
		);
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const parsed = customerFormSchema.safeParse({
			caption,
			contactName,
			email,
			phone,
			addressLine1,
			addressLine2,
			town,
			postcode,
			preferredChannel
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			const saved =
				editing && customer
					? await customersApi.update(customer.id, parsed.data)
					: await customersApi.create(parsed.data);

			open = false;
			onSaved(saved);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.status === 409 && isCustomerDedupConflict(caught.details)) {
					open = false;
					onDedupConflict(caught.details);
					return;
				}
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this customer. Try again.';
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
		form="customer-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save changes' : 'Create customer'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit customer' : 'New customer'}
	description={editing
		? 'Update the customer details. Every change is recorded in the audit trail.'
		: 'Add a customer to this workspace. A possible duplicate is held for review before it becomes active.'}
	size="lg"
	{footer}
	onclose={close}
>
	<form id="customer-form" class="flex flex-col gap-5" onsubmit={submit} novalidate>
		{#if serverError}
			<p
				role="alert"
				class="rounded-md border border-critical bg-critical-soft px-3 py-2 text-callout text-critical-ink"
			>
				{serverError}
			</p>
		{/if}

		<div class="grid gap-5 md:grid-cols-2">
			<Input
				label="Customer caption"
				bind:value={caption}
				required
				hint="The name you will recognise this customer by."
				autocomplete="organization"
				error={errors.caption}
				class="md:col-span-2"
			/>
			<Input
				label="Contact name"
				bind:value={contactName}
				hint="Optional."
				autocomplete="name"
				error={errors.contactName}
			/>
			<Select
				label="Preferred channel"
				bind:value={preferredChannel}
				options={CHANNEL_OPTIONS}
				error={errors.preferredChannel}
			/>
			<Input
				label="Email"
				bind:value={email}
				type="email"
				inputmode="email"
				autocomplete="email"
				hint="Optional. Stored in lowercase."
				error={errors.email}
			/>
			<Input
				label="Phone"
				bind:value={phone}
				type="tel"
				inputmode="tel"
				autocomplete="tel"
				hint="Optional. Stored as digits only."
				error={errors.phone}
			/>
			<Input
				label="Address line 1"
				bind:value={addressLine1}
				autocomplete="address-line1"
				error={errors.addressLine1}
				class="md:col-span-2"
			/>
			<Input
				label="Address line 2"
				bind:value={addressLine2}
				hint="Optional."
				autocomplete="address-line2"
				error={errors.addressLine2}
				class="md:col-span-2"
			/>
			<Input label="Town" bind:value={town} autocomplete="address-level2" error={errors.town} />
			<Input
				label="Postcode"
				bind:value={postcode}
				autocomplete="postal-code"
				spellcheck="false"
				error={errors.postcode}
			/>
		</div>
	</form>
</Dialog>
