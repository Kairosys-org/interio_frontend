<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import {
		Badge,
		Button,
		DataTable,
		DetailSection,
		EmptyState,
		PageHeader,
		PermissionGate,
		SearchInput,
		Skeleton
	} from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { Manufacturer, ManufacturerNode, MaterialCollection } from '../../domain/types';
	import CollectionFormDialog from '../components/CollectionFormDialog.svelte';
	import ManufacturerFormDialog from '../components/ManufacturerFormDialog.svelte';

	/**
	 * `/materials/manufacturers` (phase-3 §3).
	 *
	 * Manufacturer → collection is one level deep; there is no separate
	 * collection module. The tree edits both levels inline in dialogs and
	 * shows the decor count per collection so an empty collection is visible.
	 */
	let nodes = $state<ManufacturerNode[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let query = $state('');
	let requestSequence = 0;

	let manufacturerOpen = $state(false);
	let editingManufacturer = $state<Manufacturer | null>(null);
	let collectionOpen = $state(false);
	let collectionManufacturer = $state<Manufacturer | null>(null);
	let editingCollection = $state<MaterialCollection | null>(null);

	const filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (needle.length === 0) return nodes;
		return nodes
			.map((node) => ({
				...node,
				collections: node.collections.filter(
					(entry) =>
						node.manufacturer.caption.toLowerCase().includes(needle) ||
						entry.collection.caption.toLowerCase().includes(needle)
				)
			}))
			.filter(
				(node) =>
					node.manufacturer.caption.toLowerCase().includes(needle) || node.collections.length > 0
			);
	});

	const hasFilters = $derived(query.trim().length > 0);

	$effect(() => {
		void load();
	});

	async function load(): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;
		try {
			const result = await materialsApi.listManufacturers();
			if (sequence !== requestSequence) return;
			nodes = result;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			nodes = [];
			error = isApiError(caught) ? caught.message : 'We could not load manufacturers.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	function newManufacturer(): void {
		editingManufacturer = null;
		manufacturerOpen = true;
	}

	function editManufacturer(node: ManufacturerNode): void {
		editingManufacturer = node.manufacturer;
		manufacturerOpen = true;
	}

	function newCollection(node: ManufacturerNode): void {
		collectionManufacturer = node.manufacturer;
		editingCollection = null;
		collectionOpen = true;
	}

	function editCollection(node: ManufacturerNode, collection: MaterialCollection): void {
		collectionManufacturer = node.manufacturer;
		editingCollection = collection;
		collectionOpen = true;
	}

	function onManufacturerSaved(): void {
		toast.success('Manufacturer saved.');
		void load();
	}

	function onCollectionSaved(): void {
		toast.success('Collection saved.');
		void load();
	}
</script>

<PageHeader
	eyebrow="Materials"
	title="Manufacturers"
	description="Manufacturer → collection → decor. Collections never nest deeper than one level."
>
	{#snippet actions()}
		<PermissionGate permission={PERMISSIONS.MATERIALS_CREATE}>
			<Button onclick={newManufacturer}>
				{#snippet icon()}<Plus size={18} strokeWidth={1.75} aria-hidden="true" />{/snippet}
				New manufacturer
			</Button>
		</PermissionGate>
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-4">
	<div class="max-w-xl">
		<SearchInput
			label="Search manufacturers and collections"
			bind:value={query}
			placeholder="Search by manufacturer or collection name"
		/>
	</div>

	{#if loading}
		<div class="flex flex-col gap-4" aria-busy="true" aria-label="Loading manufacturers">
			<h2 class="sr-only">Loading manufacturers</h2>
			<Skeleton variant="block" />
			<Skeleton variant="block" />
		</div>
	{:else if error}
		<p class="text-callout text-critical-ink" role="alert">{error}</p>
	{:else if filtered.length === 0}
		<EmptyState
			title={hasFilters ? 'No manufacturers match that search' : 'No manufacturers yet'}
			description={hasFilters
				? 'Try another manufacturer or collection name.'
				: 'Add the first manufacturer, then a collection, before creating decors.'}
		/>
	{:else}
		<div class="flex flex-col gap-4">
			{#each filtered as node (node.manufacturer.id)}
				<DetailSection
					title={node.manufacturer.caption}
					description={[
						node.manufacturer.country,
						node.manufacturer.website,
						node.manufacturer.active ? null : 'Inactive'
					]
						.filter((part) => part !== null && part.length > 0)
						.join(' · ') || 'No country or website recorded.'}
				>
					{#snippet actions()}
						<div class="flex flex-wrap items-center gap-2">
							<Badge
								label={node.manufacturer.active ? 'Active' : 'Inactive'}
								tone={node.manufacturer.active ? 'success' : 'neutral'}
							/>
							<PermissionGate permission={PERMISSIONS.MATERIALS_UPDATE}>
								<Button variant="tertiary" onclick={() => editManufacturer(node)}>
									Edit<span class="sr-only"> {node.manufacturer.caption}</span>
								</Button>
							</PermissionGate>
							<PermissionGate permission={PERMISSIONS.MATERIALS_CREATE}>
								<Button variant="secondary" onclick={() => newCollection(node)}>
									New collection<span class="sr-only"> for {node.manufacturer.caption}</span>
								</Button>
							</PermissionGate>
						</div>
					{/snippet}

					{#if node.collections.length === 0}
						<p class="text-callout text-ink-secondary">
							No collections yet. Add one before creating decors for this manufacturer.
						</p>
					{:else}
						<DataTable
							caption={`Collections for ${node.manufacturer.caption}`}
							columns={[
								{ key: 'collection', label: 'Collection' },
								{ key: 'decors', label: 'Decors', align: 'end' },
								{ key: 'status', label: 'Status' }
							]}
							rows={node.collections}
							rowKey={(row) => row.collection.id}
							density="compact"
						>
							{#snippet cell({ row, column })}
								{#if column.key === 'collection'}
									{row.collection.caption}
								{:else if column.key === 'decors'}
									{row.decorCount}
								{:else if column.key === 'status'}
									<Badge
										label={row.collection.active ? 'Active' : 'Inactive'}
										tone={row.collection.active ? 'success' : 'neutral'}
									/>
								{/if}
							{/snippet}
							{#snippet actions(row)}
								<PermissionGate permission={PERMISSIONS.MATERIALS_UPDATE}>
									<Button variant="tertiary" onclick={() => editCollection(node, row.collection)}>
										Edit<span class="sr-only"> {row.collection.caption}</span>
									</Button>
								</PermissionGate>
							{/snippet}
						</DataTable>
					{/if}
				</DetailSection>
			{/each}
		</div>
	{/if}
</div>

<ManufacturerFormDialog
	bind:open={manufacturerOpen}
	manufacturer={editingManufacturer}
	onClose={() => (manufacturerOpen = false)}
	onSaved={onManufacturerSaved}
/>

{#if collectionManufacturer !== null}
	<CollectionFormDialog
		bind:open={collectionOpen}
		manufacturerId={collectionManufacturer.id}
		manufacturerCaption={collectionManufacturer.caption}
		collection={editingCollection}
		onClose={() => (collectionOpen = false)}
		onSaved={onCollectionSaved}
	/>
{/if}
