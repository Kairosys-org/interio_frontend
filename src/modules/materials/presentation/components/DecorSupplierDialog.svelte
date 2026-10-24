<script lang="ts">
	import { isApiError } from '$network/errors';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { Button, Checkbox, Dialog, Input, Select } from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { DecorSupplierLink, Supplier } from '../../domain/types';
	import { decorSupplierFormSchema } from '../../domain/validations';

	/**
	 * Link a supplier to a decor (phase-3 §1 materials, §9.6).
	 *
	 * The supplier code belongs to this decor–supplier pair, never to a
	 * global supplier product (`LinkSupplier` 1–5). Only one supplier per
	 * decor can be primary; the mock rejects a second primary and this dialog
	 * shows that message verbatim.
	 */
	interface Props {
		open?: boolean;
		decorId: string;
		link?: DecorSupplierLink | null;
		onClose: () => void;
		onSaved: (link: DecorSupplierLink) => void;
	}

	let { open = $bindable(false), decorId, link = null, onClose, onSaved }: Props = $props();

	const editing = $derived(link !== null);

	let suppliers = $state<Supplier[]>([]);
	let suppliersLoading = $state(false);
	let suppliersError = $state<string | null>(null);
	let supplierId = $state('');
	let supplierCode = $state('');
	let altSupplierCode = $state('');
	let isPrimary = $state(false);
	let serverError = $state<string | null>(null);
	let submitting = $state(false);

	const supplierOptions = $derived(
		suppliers.map((row) => ({
			value: row.id,
			label: `${row.caption}${row.active ? '' : ' (inactive)'}`
		}))
	);

	let loaded = false;
	let wasOpen = false;
	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;

		supplierId = link?.supplierId ?? '';
		supplierCode = link?.supplierCode ?? '';
		altSupplierCode = link?.altSupplierCode ?? '';
		isPrimary = link?.isPrimary ?? false;
		serverError = null;
		submitting = false;
		if (!loaded) {
			loaded = true;
			void loadSuppliers();
		}
	});

	async function loadSuppliers(): Promise<void> {
		suppliersLoading = true;
		suppliersError = null;
		try {
			const page = await materialsApi.listSuppliers({ active: 'all', pageSize: MAX_PAGE_SIZE });
			suppliers = page.items;
			if (!editing && supplierId === '') {
				supplierId = page.items.find((row) => row.active)?.id ?? '';
			}
		} catch (caught) {
			suppliers = [];
			suppliersError = isApiError(caught) ? caught.message : 'We could not load suppliers.';
		} finally {
			suppliersLoading = false;
		}
	}

	function close(): void {
		if (submitting) return;
		onClose();
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = null;

		const parsed = decorSupplierFormSchema.safeParse({
			supplierId,
			supplierCode,
			isPrimary,
			altSupplierCode
		});
		if (!parsed.success) {
			serverError = parsed.error.issues[0]?.message ?? 'Check the supplier details.';
			return;
		}

		submitting = true;
		try {
			const saved = await materialsApi.linkSupplier(decorId, parsed.data);
			open = false;
			onSaved(saved);
		} catch (caught) {
			serverError = isApiError(caught)
				? caught.message
				: 'We could not link this supplier. Try again.';
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
		form="decor-supplier-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save supplier link' : 'Link supplier'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit supplier link' : 'Link a supplier'}
	description="The code is the supplier's own reference for this decor. One supplier can be primary."
	{footer}
	onclose={onClose}
>
	<form id="decor-supplier-form" class="flex flex-col gap-4" onsubmit={submit} novalidate>
		<Select
			label="Supplier"
			required
			bind:value={supplierId}
			options={supplierOptions}
			placeholder={suppliersLoading
				? 'Loading suppliers…'
				: suppliers.length === 0
					? 'No suppliers yet'
					: 'Choose a supplier'}
			hint={suppliersError ?? undefined}
			disabled={submitting || suppliersLoading || suppliers.length === 0 || editing}
		/>

		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				label="Supplier code"
				required
				bind:value={supplierCode}
				maxlength={64}
				placeholder="KAI-1180"
				disabled={submitting}
			/>
			<Input
				label="Alternative code"
				bind:value={altSupplierCode}
				maxlength={64}
				hint="Optional. Used when the supplier lists the same decor twice."
				disabled={submitting}
			/>
		</div>

		<Checkbox
			label="Primary supplier"
			bind:checked={isPrimary}
			description="A decor can have one primary supplier. Set it on another link first to move it."
			disabled={submitting}
		/>

		{#if serverError}
			<p class="text-callout text-critical-ink" role="alert">{serverError}</p>
		{/if}
	</form>
</Dialog>
