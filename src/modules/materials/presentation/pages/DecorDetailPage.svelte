<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { sessionStore } from '$shared/application/session';
	import { PERMISSIONS, hasPermission } from '$shared/domain/permissions';
	import { isUuid } from '$shared/domain/uuid';
	import { formatDate } from '$shared/lib/format';
	import {
		Badge,
		Breadcrumb,
		Button,
		ConfirmDialog,
		DataTable,
		DetailSection,
		EmptyState,
		EntityLink,
		ForbiddenPage,
		KeyValueGrid,
		PageHeader,
		PermissionGate,
		Skeleton,
		Tabs
	} from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { DecorDetail, DecorEdgingLink, DecorSupplierLink } from '../../domain/types';
	import {
		colourFamilyLabel,
		decorCoreLabel,
		edgingMatchLabel,
		formatSheetSize,
		grainDirectionLabel,
		materialStatusLabel,
		materialTypeLabel,
		premiumTierLabel
	} from '../materials-display';
	import DecorAttributesPanel from '../components/DecorAttributesPanel.svelte';
	import DecorEdgingDialog from '../components/DecorEdgingDialog.svelte';
	import DecorFormDrawer from '../components/DecorFormDrawer.svelte';
	import DecorSamplePanel from '../components/DecorSamplePanel.svelte';
	import DecorSupplierDialog from '../components/DecorSupplierDialog.svelte';

	/**
	 * `/materials/decor/[id]` (phase-3 §1, §3).
	 *
	 * The record form sits above four tabs: Edgings, Suppliers, Attributes and
	 * Sample asset. Prices and usage counts are deliberately absent — pricing
	 * is Phase 5 and usage belongs to the engineering engine in Phase 6.
	 */
	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	const TAB_IDS = ['edgings', 'suppliers', 'attributes', 'sample'] as const;
	type TabId = (typeof TAB_IDS)[number];

	function readTab(value: string | null): TabId {
		return TAB_IDS.includes(value as TabId) ? (value as TabId) : 'edgings';
	}

	let detail = $state<DecorDetail | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let requestSequence = 0;
	let tabValue = $state<TabId>(readTab(page.url.searchParams.get('tab')));
	let lastUrlTab = readTab(page.url.searchParams.get('tab'));

	let editOpen = $state(false);
	let edgingOpen = $state(false);
	let edgingTarget = $state<DecorEdgingLink | null>(null);
	let supplierOpen = $state(false);
	let supplierTarget = $state<DecorSupplierLink | null>(null);

	let pendingEdging = $state<DecorEdgingLink | null>(null);
	let pendingSupplier = $state<DecorSupplierLink | null>(null);
	let removing = $state(false);
	let removeError = $state<string | null>(null);

	const validId = $derived(isUuid(id));
	const canEdit = $derived(
		Boolean(
			$sessionStore.user &&
			hasPermission($sessionStore.user.permissions, PERMISSIONS.MATERIALS_UPDATE)
		)
	);

	const tabs = $derived([
		{ id: 'edgings', label: `Edgings (${detail?.edgings.length ?? 0})` },
		{ id: 'suppliers', label: `Suppliers (${detail?.suppliers.length ?? 0})` },
		{ id: 'attributes', label: `Attributes (${detail?.attributes.length ?? 0})` },
		{ id: 'sample', label: 'Sample asset' }
	]);

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

	$effect(() => {
		const fromUrl = readTab(page.url.searchParams.get('tab'));
		if (fromUrl === lastUrlTab) return;
		lastUrlTab = fromUrl;
		tabValue = fromUrl;
	});

	$effect(() => {
		const next = readTab(tabValue);
		if (next === lastUrlTab) return;
		lastUrlTab = next;
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (next === 'edgings') params.delete('tab');
		else params.set('tab', next);
		const query = params.toString();
		void goto(resolve(`/materials/decor/${id}${query.length > 0 ? `?${query}` : ''}`), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	});

	async function load(decorId: string): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;
		notFound = false;
		try {
			const result = await materialsApi.getDecor(decorId);
			if (sequence !== requestSequence) return;
			detail = result;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			detail = null;
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else error = isApiError(caught) ? caught.message : 'We could not load this decor.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	async function reload(): Promise<void> {
		if (!isUuid(id)) return;
		await load(id);
	}

	function onDecorSaved(_decor: { caption: string }, candidates: { caption: string }[]): void {
		if (candidates.length > 0) {
			toast.warning('Decor saved.', {
				description: `Possible duplicates: ${candidates.map((row) => row.caption).join(', ')}. Nothing was merged.`
			});
		} else {
			toast.success('Decor saved.');
		}
		void reload();
	}

	function onLinked(message: string): void {
		toast.success(message);
		void reload();
	}

	function openEdging(link: DecorEdgingLink | null): void {
		edgingTarget = link;
		edgingOpen = true;
	}

	function openSupplier(link: DecorSupplierLink | null): void {
		supplierTarget = link;
		supplierOpen = true;
	}

	async function confirmRemoveEdging(): Promise<void> {
		const target = pendingEdging;
		if (!target) return;
		removing = true;
		removeError = null;
		try {
			await materialsApi.unlinkEdging(id, target.edgingId);
			pendingEdging = null;
			toast.success('Edging unlinked.');
			await reload();
		} catch (caught) {
			removeError = isApiError(caught)
				? caught.message
				: 'We could not unlink this edging. Try again.';
		} finally {
			removing = false;
		}
	}

	async function confirmRemoveSupplier(): Promise<void> {
		const target = pendingSupplier;
		if (!target) return;
		removing = true;
		removeError = null;
		try {
			await materialsApi.unlinkSupplier(id, target.supplierId);
			pendingSupplier = null;
			toast.success('Supplier unlinked.');
			await reload();
		} catch (caught) {
			removeError = isApiError(caught)
				? caught.message
				: 'We could not unlink this supplier. Try again.';
		} finally {
			removing = false;
		}
	}
</script>

{#if !validId}
	<ForbiddenPage
		variant="not-found"
		title="Decor not found."
		description="This decor does not exist or is no longer available."
		backHref={resolve('/materials/decor')}
		backLabel="Back to decor"
	/>
{:else if loading}
	<div class="flex flex-col gap-6" aria-busy="true" aria-label="Loading decor">
		<h1 class="sr-only">Loading decor</h1>
		<Skeleton lines={1} class="max-w-content-reading" />
		<Skeleton variant="block" />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Decor not found."
		description="This decor does not exist or is no longer available."
		backHref={resolve('/materials/decor')}
		backLabel="Back to decor"
	/>
{:else if detail !== null}
	<div class="flex flex-col gap-6">
		<PageHeader
			eyebrow={`${detail.manufacturer.caption} · ${detail.collection.caption}`}
			title={detail.decor.caption}
			description="Decor finishes carry the codes, tier and supplier links used by projects and purchasing."
		>
			{#snippet breadcrumbs()}
				<Breadcrumb
					items={[
						{ label: 'Materials', href: resolve('/materials/decor') },
						{ label: 'Decor', href: resolve('/materials/decor') },
						{ label: detail?.decor.caption ?? 'Decor' }
					]}
				/>
			{/snippet}
			{#snippet actions()}
				<PermissionGate permission={PERMISSIONS.MATERIALS_UPDATE}>
					<Button variant="secondary" onclick={() => (editOpen = true)}>Edit decor</Button>
				</PermissionGate>
			{/snippet}
		</PageHeader>

		<div class="flex flex-wrap items-center gap-2">
			<Badge
				label={materialStatusLabel(detail.decor.status)}
				tone={detail.decor.status === 'active' ? 'success' : 'neutral'}
			/>
			<Badge label={premiumTierLabel(detail.decor.premiumTier)} tone="info" />
			{#if detail.decor.customerVisible}
				<Badge label="Customer visible" tone="info" />
			{:else}
				<Badge label="Hidden from customers" tone="neutral" />
			{/if}
			<p class="text-footnote text-ink-secondary">
				Updated {formatDate(detail.decor.updatedAt)}
			</p>
		</div>

		{#if error}
			<p class="text-callout text-critical-ink" role="alert">{error}</p>
		{/if}

		<DetailSection title="Record" description="Manufacturer, collection and finish attributes.">
			<KeyValueGrid
				columns={3}
				items={[
					{ label: 'Manufacturer', value: detail.manufacturer.caption },
					{ label: 'Collection', value: detail.collection.caption },
					{ label: 'Decor code', value: detail.decor.decorCode },
					{ label: 'Colour family', value: colourFamilyLabel(detail.decor.colourFamily) },
					{ label: 'Material type', value: materialTypeLabel(detail.decor.materialType) },
					{ label: 'Core', value: decorCoreLabel(detail.decor.core) },
					{ label: 'Default thickness', value: `${detail.decor.defaultThicknessMm} mm` },
					{ label: 'Sheet size', value: formatSheetSize(detail.decor.sheetSizeMm) },
					{ label: 'Grain direction', value: grainDirectionLabel(detail.decor.grainDirection) },
					{ label: 'Texture surface', value: detail.decor.textureSurface ?? '—' },
					{ label: 'Premium tier', value: premiumTierLabel(detail.decor.premiumTier) },
					{
						label: 'Customer visibility',
						value: detail.decor.customerVisible ? 'Visible' : 'Hidden'
					}
				]}
			/>
		</DetailSection>

		<div class="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
			<Tabs label="Decor sections" {tabs} bind:value={tabValue} />
			<div class="flex flex-wrap gap-2">
				{#if tabValue === 'edgings'}
					<PermissionGate permission={PERMISSIONS.MATERIALS_UPDATE}>
						<Button onclick={() => openEdging(null)}>
							{#snippet icon()}<Plus size={18} strokeWidth={1.75} aria-hidden="true" />{/snippet}
							Link edging
						</Button>
					</PermissionGate>
				{:else if tabValue === 'suppliers'}
					<PermissionGate permission={PERMISSIONS.MATERIALS_UPDATE}>
						<Button onclick={() => openSupplier(null)}>
							{#snippet icon()}<Plus size={18} strokeWidth={1.75} aria-hidden="true" />{/snippet}
							Link supplier
						</Button>
					</PermissionGate>
				{/if}
			</div>
		</div>

		{#if tabValue === 'edgings'}
			{#if detail.edgings.length === 0}
				<EmptyState
					title="No edgings linked"
					description="Link the edgings that finish this decor, with the match type used on site."
				/>
			{:else}
				<DataTable
					caption="Linked edgings"
					columns={[
						{ key: 'caption', label: 'Edging' },
						{ key: 'code', label: 'Code' },
						{ key: 'material', label: 'Material' },
						{ key: 'thickness', label: 'Thickness', align: 'end' },
						{ key: 'match', label: 'Match' }
					]}
					rows={detail.edgings}
					rowKey={(row) => row.edgingId}
					density="compact"
				>
					{#snippet cell({ row, column })}
						{#if column.key === 'caption'}
							{row.edging.caption}
							{#if !row.edging.active}
								<Badge label="Inactive" tone="neutral" class="ms-2" />
							{/if}
						{:else if column.key === 'code'}
							<span class="font-mono text-callout text-ink">{row.edging.edgingCode}</span>
						{:else if column.key === 'material'}
							{row.edging.materialType}
						{:else if column.key === 'thickness'}
							{row.edging.thicknessMm} mm
						{:else if column.key === 'match'}
							<Badge label={edgingMatchLabel(row.matchType)} tone="info" />
						{/if}
					{/snippet}
					{#snippet actions(row)}
						<PermissionGate permission={PERMISSIONS.MATERIALS_UPDATE}>
							<div class="flex justify-end gap-1">
								<Button variant="tertiary" onclick={() => openEdging(row)}>
									Edit<span class="sr-only"> {row.edging.caption} match</span>
								</Button>
								<Button
									variant="tertiary"
									onclick={() => {
										removeError = null;
										pendingEdging = row;
									}}
								>
									Remove<span class="sr-only"> {row.edging.caption}</span>
								</Button>
							</div>
						</PermissionGate>
					{/snippet}
				</DataTable>
			{/if}
		{:else if tabValue === 'suppliers'}
			{#if detail.suppliers.length === 0}
				<EmptyState
					title="No suppliers linked"
					description="Link the suppliers that stock this decor and record their code for purchasing."
				/>
			{:else}
				<DataTable
					caption="Linked suppliers"
					columns={[
						{ key: 'supplier', label: 'Supplier' },
						{ key: 'contact', label: 'Contact' },
						{ key: 'code', label: 'Supplier code' },
						{ key: 'alt', label: 'Alternative code' },
						{ key: 'primary', label: 'Primary' }
					]}
					rows={detail.suppliers}
					rowKey={(row) => row.supplierId}
					density="compact"
				>
					{#snippet cell({ row, column })}
						{#if column.key === 'supplier'}
							<EntityLink href={`/materials/suppliers/${row.supplierId}`}>
								{row.supplier.caption}
							</EntityLink>
						{:else if column.key === 'contact'}
							{row.supplier.contact ?? '—'}
						{:else if column.key === 'code'}
							<span class="font-mono text-callout text-ink">{row.supplierCode}</span>
						{:else if column.key === 'alt'}
							{row.altSupplierCode ?? '—'}
						{:else if column.key === 'primary'}
							{row.isPrimary ? 'Primary' : '—'}
						{/if}
					{/snippet}
					{#snippet actions(row)}
						<PermissionGate permission={PERMISSIONS.MATERIALS_UPDATE}>
							<div class="flex justify-end gap-1">
								<Button variant="tertiary" onclick={() => openSupplier(row)}>
									Edit<span class="sr-only"> {row.supplier.caption} link</span>
								</Button>
								<Button
									variant="tertiary"
									onclick={() => {
										removeError = null;
										pendingSupplier = row;
									}}
								>
									Remove<span class="sr-only"> {row.supplier.caption}</span>
								</Button>
							</div>
						</PermissionGate>
					{/snippet}
				</DataTable>
			{/if}
		{:else if tabValue === 'attributes'}
			<DetailSection
				title="Attributes"
				description="Free key/value pairs for this decor. Keys are unique within the decor."
			>
				<DecorAttributesPanel
					decorId={detail.decor.id}
					attributes={detail.attributes}
					{canEdit}
					onChanged={() => void reload()}
				/>
			</DetailSection>
		{:else if tabValue === 'sample'}
			<DetailSection
				title="Sample asset"
				description="One reference file per decor, stored as a decor-owned asset."
			>
				<DecorSamplePanel
					decorId={detail.decor.id}
					decorCaption={detail.decor.caption}
					sampleAssetId={detail.decor.sampleAssetId}
					{canEdit}
					onChanged={() => void reload()}
				/>
			</DetailSection>
		{/if}
	</div>

	<DecorFormDrawer
		bind:open={editOpen}
		decor={detail.decor}
		onClose={() => (editOpen = false)}
		onSaved={onDecorSaved}
	/>

	<DecorEdgingDialog
		bind:open={edgingOpen}
		decorId={detail.decor.id}
		link={edgingTarget}
		onClose={() => (edgingOpen = false)}
		onSaved={() => onLinked('Edging linked.')}
	/>

	<DecorSupplierDialog
		bind:open={supplierOpen}
		decorId={detail.decor.id}
		link={supplierTarget}
		onClose={() => (supplierOpen = false)}
		onSaved={() => onLinked('Supplier linked.')}
	/>

	<ConfirmDialog
		bind:open={
			() => pendingEdging !== null,
			(value) => {
				if (!value) pendingEdging = null;
			}
		}
		title="Unlink this edging?"
		description={pendingEdging === null
			? ''
			: `${pendingEdging.edging.caption} will no longer be offered for ${detail.decor.caption}. The edging record itself stays in the library.`}
		confirmLabel="Unlink edging"
		destructive
		loading={removing}
		error={removeError}
		onconfirm={confirmRemoveEdging}
	/>

	<ConfirmDialog
		bind:open={
			() => pendingSupplier !== null,
			(value) => {
				if (!value) pendingSupplier = null;
			}
		}
		title="Unlink this supplier?"
		description={pendingSupplier === null
			? ''
			: `${pendingSupplier.supplier.caption} and its code will be removed from ${detail.decor.caption}. The supplier record itself stays.`}
		confirmLabel="Unlink supplier"
		destructive
		loading={removing}
		error={removeError}
		onconfirm={confirmRemoveSupplier}
	/>
{/if}
