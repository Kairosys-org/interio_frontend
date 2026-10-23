<script lang="ts">
	import { isApiError } from '$network/errors';
	import { customersApi } from '$modules/customers/data/api';
	import { Button, Combobox, Dialog, Input, Textarea } from '$shared/presentation/ui';
	import { propertiesApi } from '../../data/api';
	import type { CreatePropertyInput, Property, PropertyDedupConflict } from '../../domain/types';
	import { propertyFormSchema } from '../../domain/validations';
	import { fieldErrorsFrom } from '../field-errors';

	/**
	 * Create and edit property dialog (DESIGN §10.2 Form / edit).
	 *
	 * One component for both modes: only the copy, the submit label and the
	 * call after validation differ. The customer list is loaded here because
	 * the picker belongs to the form, not to the page around it.
	 *
	 * A `409 conflict` carrying dedup details is not a form failure: the row
	 * already exists as `pending_review`, so the dialog closes and the page
	 * opens the review flow. Entered data is preserved for every other error.
	 */
	interface Props {
		open?: boolean;
		property?: Property | null;
		/** Caption for a linked customer that is no longer in the active list. */
		customerCaption?: string | null;
		onSaved: (property: Property) => void;
		onDedupConflict: (conflict: PropertyDedupConflict) => void;
		onClose: () => void;
	}

	let {
		open = $bindable(false),
		property = null,
		customerCaption = null,
		onSaved,
		onDedupConflict,
		onClose
	}: Props = $props();

	const editing = $derived(property !== null);

	let customers = $state<{ id: string; caption: string; email: string | null }[]>([]);
	let customersLoading = $state(false);
	let customersError = $state<string | null>(null);
	let customersRequested = false;

	let customerId = $state('');
	let addressLine1 = $state('');
	let addressLine2 = $state('');
	let town = $state('');
	let postcode = $state('');
	let accessNotes = $state('');

	let errors = $state<Record<string, string>>({});
	let serverError = $state('');
	let submitting = $state(false);

	const customerOptions = $derived.by(() => {
		const options = customers.map((customer) => ({
			value: customer.id,
			label: customer.email === null ? customer.caption : `${customer.caption} · ${customer.email}`
		}));

		if (customerId !== '' && !options.some((option) => option.value === customerId)) {
			options.unshift({
				value: customerId,
				label: customerCaption ?? 'Current customer'
			});
		}

		return options;
	});

	const customerHint = $derived.by(() => {
		if (customersLoading) return 'Loading customers…';
		if (customersError) return customersError;
		if (customers.length === 0)
			return 'No active customers yet. Create a customer before adding a property.';
		return 'Only active customers can be linked to a property.';
	});

	let wasOpen = false;
	let lastKey = '';

	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}

		const key = property?.id ?? 'new';
		if (!wasOpen || key !== lastKey) fillForm();
		wasOpen = true;
		lastKey = key;

		if (!customersRequested) {
			customersRequested = true;
			void loadCustomers();
		}
	});

	function fillForm(): void {
		customerId = property?.customerId ?? '';
		addressLine1 = property?.addressLine1 ?? '';
		addressLine2 = property?.addressLine2 ?? '';
		town = property?.town ?? '';
		postcode = property?.postcode ?? '';
		accessNotes = property?.accessNotes ?? '';
		errors = {};
		serverError = '';
		submitting = false;
	}

	async function loadCustomers(): Promise<void> {
		customersLoading = true;
		customersError = null;
		try {
			const page = await customersApi.list({ pageSize: 100, state: 'active' });
			customers = page.items.map((row) => ({
				id: row.id,
				caption: row.caption,
				email: row.email
			}));
		} catch (caught) {
			customers = [];
			customersError = isApiError(caught)
				? caught.message
				: 'We could not load customers. Try again.';
		} finally {
			customersLoading = false;
		}
	}

	function close(): void {
		if (submitting) return;
		serverError = '';
		onClose();
	}

	function isPropertyDedupConflict(details: unknown): details is PropertyDedupConflict {
		if (typeof details !== 'object' || details === null) return false;
		const value = details as Partial<PropertyDedupConflict>;
		return (
			value.entityType === 'property' &&
			typeof value.heldId === 'string' &&
			Array.isArray(value.candidates)
		);
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const parsed = propertyFormSchema.safeParse({
			customerId,
			addressLine1,
			addressLine2,
			town,
			postcode,
			accessNotes
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		const values = parsed.data;
		const input: CreatePropertyInput = {
			customerId: values.customerId,
			addressLine1: values.addressLine1,
			addressLine2: values.addressLine2 ?? null,
			town: values.town ?? null,
			postcode: values.postcode ?? null,
			accessNotes: values.accessNotes ?? null
		};

		submitting = true;
		try {
			const saved =
				editing && property
					? await propertiesApi.update(property.id, input)
					: await propertiesApi.create(input);

			open = false;
			onSaved(saved);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.status === 409 && isPropertyDedupConflict(caught.details)) {
					open = false;
					onDedupConflict(caught.details);
					return;
				}
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this property. Try again.';
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
		form="property-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save changes' : 'Create property'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit property' : 'New property'}
	description={editing
		? 'Update the address, customer or access notes. Every change is recorded in the audit trail.'
		: 'Add a property to this workspace. A possible duplicate is held for review before it becomes active.'}
	size="lg"
	{footer}
	onclose={close}
>
	<form id="property-form" class="flex flex-col gap-5" onsubmit={submit} novalidate>
		{#if serverError}
			<p
				role="alert"
				class="rounded-md border border-critical bg-critical-soft px-3 py-2 text-callout text-critical-ink"
			>
				{serverError}
			</p>
		{/if}

		<div class="flex flex-col gap-5">
			<div class="flex flex-col gap-2">
				<Combobox
					label="Customer"
					bind:value={customerId}
					options={customerOptions}
					placeholder="Search active customers"
					hint={customerHint}
					error={errors.customerId}
					emptyMessage="No active customers match this search"
					disabled={customersLoading || customers.length === 0}
				/>
				{#if customersError}
					<Button
						variant="tertiary"
						onclick={() => void loadCustomers()}
						disabled={customersLoading}
						class="self-start"
					>
						Try again
					</Button>
				{/if}
			</div>

			<div class="grid gap-5 md:grid-cols-2">
				<Input
					label="Address line 1"
					bind:value={addressLine1}
					required
					autocomplete="address-line1"
					error={errors.addressLine1}
					class="md:col-span-2"
				/>
				<Input
					label="Address line 2"
					bind:value={addressLine2}
					hint="Optional. Flat, unit or building name."
					autocomplete="address-line2"
					error={errors.addressLine2}
					class="md:col-span-2"
				/>
				<Input label="Town" bind:value={town} autocomplete="address-level2" error={errors.town} />
				<Input
					label="Postcode"
					bind:value={postcode}
					hint="Optional."
					autocomplete="postal-code"
					spellcheck="false"
					error={errors.postcode}
				/>
				<Textarea
					label="Access notes"
					bind:value={accessNotes}
					rows={4}
					hint="Optional. Gate codes, parking, key safe or pets. Shown on the property record."
					error={errors.accessNotes}
					maxlength={2000}
					class="md:col-span-2"
				/>
			</div>
		</div>
	</form>
</Dialog>
