<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { isUuid } from '$shared/domain/uuid';
	import { formatDate } from '$shared/lib/format';
	import {
		Badge,
		Breadcrumb,
		Button,
		DataTable,
		DetailSection,
		EmptyState,
		EntityLink,
		ForbiddenPage,
		KeyValueGrid,
		PageHeader,
		PermissionGate,
		Skeleton
	} from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { SupplierDetail } from '../../domain/types';
	import SupplierFormDialog from '../components/SupplierFormDialog.svelte';

	/**
	 * `/materials/suppliers/[id]` (phase-3 §3).
	 *
	 * The supplier record plus every decor that references it, with the
	 * per-decor supplier code and primary flag. The link is owned by the
	 * decor, so removal happens on the decor detail page, not here.
	 */
	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let detail = $state<SupplierDetail | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let requestSequence = 0;
	let editOpen = $state(false);

	const validId = $derived(isUuid(id));

	$effect(() => {
		const value = page.params.id ?? '';
		if (!isUuid(value)) {
			loading = false;
			detail = null;
			notFound = true;
			error = null;
			return;
		}
		void load(value);
	});

	async function load(supplierId: string): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;
		notFound = false;
		try {
			const result = await materialsApi.getSupplier(supplierId);
			if (sequence !== requestSequence) return;
			detail = result;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			detail = null;
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else error = isApiError(caught) ? caught.message : 'We could not load this supplier.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	function onSaved(): void {
		toast.success('Supplier saved.');
		if (isUuid(id)) void load(id);
	}
</script>

{#if !validId}
	<ForbiddenPage
		variant="not-found"
		title="Supplier not found."
		description="This supplier does not exist or is no longer available."
		backHref={resolve('/materials/suppliers')}
		backLabel="Back to suppliers"
	/>
{:else if loading}
	<div class="flex flex-col gap-6" aria-busy="true" aria-label="Loading supplier">
		<h1 class="sr-only">Loading supplier</h1>
		<Skeleton lines={1} class="max-w-content-reading" />
		<Skeleton variant="block" />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Supplier not found."
		description="This supplier does not exist or is no longer available."
		backHref={resolve('/materials/suppliers')}
		backLabel="Back to suppliers"
	/>
{:else if detail !== null}
	<div class="flex flex-col gap-6">
		<PageHeader
			eyebrow="Supplier"
			title={detail.supplier.caption}
			description="Lead time and the decors bought from this supplier."
		>
			{#snippet breadcrumbs()}
				<Breadcrumb
					items={[
						{ label: 'Materials', href: resolve('/materials/decor') },
						{ label: 'Suppliers', href: resolve('/materials/suppliers') },
						{ label: detail?.supplier.caption ?? 'Supplier' }
					]}
				/>
			{/snippet}
			{#snippet actions()}
				<PermissionGate permission={PERMISSIONS.MATERIALS_UPDATE}>
					<Button variant="secondary" onclick={() => (editOpen = true)}>Edit supplier</Button>
				</PermissionGate>
			{/snippet}
		</PageHeader>

		<div class="flex flex-wrap items-center gap-2">
			<Badge
				label={detail.supplier.active ? 'Active' : 'Inactive'}
				tone={detail.supplier.active ? 'success' : 'neutral'}
			/>
			<p class="text-footnote text-ink-secondary">
				Updated {formatDate(detail.supplier.updatedAt)}
			</p>
		</div>

		{#if error}
			<p class="text-callout text-critical-ink" role="alert">{error}</p>
		{/if}

		<DetailSection title="Record" description="Contact details and purchasing lead time.">
			<KeyValueGrid
				columns={2}
				items={[
					{ label: 'Contact', value: detail.supplier.contact ?? '—' },
					{
						label: 'Lead time',
						value:
							detail.supplier.leadTimeDays === null
								? 'Not recorded'
								: `${detail.supplier.leadTimeDays} days`
					},
					{ label: 'Linked decors', value: String(detail.decors.length) },
					{ label: 'Status', value: detail.supplier.active ? 'Active' : 'Inactive' }
				]}
			/>
		</DetailSection>

		<DetailSection
			title="Linked decors"
			description="Codes are stored on each decor link, not on the supplier."
		>
			{#if detail.decors.length === 0}
				<EmptyState
					title="No decors linked"
					description="Link this supplier from a decor detail page to record the codes used when ordering."
				/>
			{:else}
				<DataTable
					caption="Decors bought from this supplier"
					columns={[
						{ key: 'decor', label: 'Decor' },
						{ key: 'code', label: 'Decor code' },
						{ key: 'origin', label: 'Manufacturer / collection' },
						{ key: 'supplierCode', label: 'Supplier code' },
						{ key: 'primary', label: 'Primary' }
					]}
					rows={detail.decors}
					rowKey={(row) => row.decorId}
					density="compact"
				>
					{#snippet cell({ row, column })}
						{#if column.key === 'decor'}
							<EntityLink href={`/materials/decor/${row.decorId}`}>{row.caption}</EntityLink>
						{:else if column.key === 'code'}
							<span class="font-mono text-callout text-ink">{row.decorCode}</span>
						{:else if column.key === 'origin'}
							{row.manufacturerCaption} · {row.collectionCaption}
						{:else if column.key === 'supplierCode'}
							<span class="font-mono text-callout text-ink">{row.supplierCode}</span>
							{#if row.altSupplierCode}
								<span class="text-footnote text-ink-secondary"> / {row.altSupplierCode}</span>
							{/if}
						{:else if column.key === 'primary'}
							{row.isPrimary ? 'Primary' : '—'}
						{/if}
					{/snippet}
				</DataTable>
			{/if}
		</DetailSection>
	</div>

	<SupplierFormDialog
		bind:open={editOpen}
		supplier={detail.supplier}
		onClose={() => (editOpen = false)}
		{onSaved}
	/>
{/if}
