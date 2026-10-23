<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { PROJECT_TYPE_LABELS, type ProjectType } from '$shared/domain/record-states';
	import type { AuditTrailRow } from '$shared/domain/audit';
	import { isUuid } from '$shared/domain/uuid';
	import {
		AuditTrailTab,
		Breadcrumb,
		Button,
		ConfirmDialog,
		DetailSection,
		EmptyState,
		EntityLink,
		KeyValueGrid,
		PermissionGate,
		Skeleton,
		StateChip,
		Tabs,
		TextLink
	} from '$shared/presentation/ui';
	import { propertiesApi } from '../../data/api';
	import type { Property, PropertyDetail } from '../../domain/types';
	import AccessNotes from '../components/AccessNotes.svelte';
	import PropertyDedupReview from '../components/PropertyDedupReview.svelte';
	import PropertyFormDialog from '../components/PropertyFormDialog.svelte';

	/**
	 * `/properties/[id]` detail hub (DESIGN §10.2 Detail hub): full-address
	 * identity header with state, customer link and the Overview / Audit tabs.
	 * Overview holds the address block, access notes and the projects at this
	 * address. No dead tab is rendered.
	 */
	interface Props {
		propertyId: string;
	}

	let { propertyId }: Props = $props();

	const TABS = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'audit', label: 'Audit' }
	];

	function readTab(value: string | null): string {
		return TABS.some((tab) => tab.id === value) ? (value as string) : 'overview';
	}

	const requestedTab = page.url.searchParams.get('tab');
	let activeTab = $state(readTab(requestedTab));
	let lastTabParam: string | null = requestedTab;

	let detail = $state<PropertyDetail | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);

	let editOpen = $state(false);
	let archiveOpen = $state(false);
	let archiveError = $state<string | null>(null);
	let dedupOpen = $state(false);

	let auditRows = $state<AuditTrailRow[] | null>(null);
	let auditLoading = $state(false);
	let auditError = $state<string | null>(null);
	let auditRequested: string | null = null;

	let requestSequence = 0;

	const validId = $derived(isUuid(propertyId));
	const property = $derived(detail?.property ?? null);
	const customer = $derived(detail?.customer ?? null);
	const projects = $derived(detail?.projects ?? []);
	const canEdit = $derived(property?.state === 'active');

	const fullAddress = $derived(
		property
			? [property.addressLine1, property.addressLine2, property.town, property.postcode]
					.filter((value): value is string => Boolean(value))
					.join(', ')
			: 'Property'
	);

	const breadcrumb = $derived([
		{ label: 'Properties', href: resolve('/properties') },
		{ label: property?.addressLine1 ?? 'Property' }
	]);

	const addressItems = $derived.by(() => {
		if (!property) return [];
		return [
			{ label: 'Address line 1', value: property.addressLine1 },
			{ label: 'Address line 2', value: property.addressLine2 },
			{ label: 'Town', value: property.town },
			{ label: 'Postcode', value: property.postcode },
			{
				label: 'Customer',
				value: customer?.caption ?? 'Unknown customer',
				href: customer ? resolve(`/customers/${customer.id}` as Pathname) : undefined
			}
		];
	});

	const stateNote = $derived.by(() => {
		if (!property || property.state === 'active') return '';
		if (property.state === 'pending_review')
			return 'Review the duplicate match before editing this property.';
		if (property.state === 'archived') return 'This property is archived and cannot be edited.';
		return 'This property was linked to an existing record.';
	});

	async function load(value: string): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;
		notFound = false;

		try {
			const result = await propertiesApi.get(value);
			if (sequence !== requestSequence) return;
			detail = result;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			detail = null;
			if (isApiError(caught) && caught.isNotFound()) {
				notFound = true;
			} else {
				error = isApiError(caught) ? caught.message : 'We could not load this property. Try again.';
			}
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	$effect(() => {
		const value = propertyId;
		if (!isUuid(value)) {
			requestSequence += 1;
			loading = false;
			detail = null;
			notFound = true;
			error = null;
			return;
		}
		void load(value);
	});

	// Keep the active tab in the URL so the view is shareable (DESIGN §9.3 Tabs).
	$effect(() => {
		const tab = activeTab;
		if (tab === lastTabParam) return;
		lastTabParam = tab;

		const params = new URLSearchParams(page.url.searchParams);
		if (tab === 'overview') params.delete('tab');
		else params.set('tab', tab);

		const suffix = params.toString();
		const target =
			suffix.length > 0 ? `/properties/${propertyId}?${suffix}` : `/properties/${propertyId}`;
		void goto(resolve(target as Pathname), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	});

	// Audit is lazy: it only loads once the tab is first opened.
	$effect(() => {
		const tab = activeTab;
		const id = propertyId;
		if (tab !== 'audit' || !isUuid(id) || auditRequested === id) return;
		auditRequested = id;
		void loadAudit(id);
	});

	async function loadAudit(id: string): Promise<void> {
		auditLoading = true;
		auditError = null;
		try {
			auditRows = await propertiesApi.audit(id);
		} catch (caught) {
			auditRows = [];
			auditError = isApiError(caught)
				? caught.message
				: 'We could not load the audit trail. Try again.';
		} finally {
			auditLoading = false;
		}
	}

	function retryAudit(): void {
		auditRequested = null;
		void loadAudit(propertyId);
	}

	function handleSaved(_saved: Property): void {
		toast.success('Property updated.');
		void load(propertyId);
	}

	async function confirmArchive(): Promise<void> {
		archiveError = null;
		try {
			await propertiesApi.archive(propertyId);
		} catch (caught) {
			archiveError = isApiError(caught)
				? caught.message
				: 'We could not archive this property. Try again.';
			throw caught;
		}

		archiveOpen = false;
		toast.success('Property archived.');
		void load(propertyId);
	}

	function reloadAfterDedup(): void {
		auditRequested = null;
		void load(propertyId);
	}
</script>

<svelte:head>
	<title>{property ? `${property.addressLine1} · Interio` : 'Property · Interio'}</title>
</svelte:head>

{#if !validId}
	<h1 class="sr-only">Property</h1>
	<EmptyState
		title="Property not found."
		description="This property does not exist or is no longer available."
	>
		{#snippet action()}
			<TextLink href={resolve('/properties')}>Back to properties</TextLink>
		{/snippet}
	</EmptyState>
{:else if loading}
	<div class="flex flex-col gap-6" aria-busy="true">
		<h1 class="sr-only">Loading property</h1>
		<p class="sr-only" role="status" aria-live="polite">Loading property.</p>
		<Skeleton lines={1} class="max-w-content-reading" />
		<Skeleton variant="block" />
		<Skeleton variant="block" />
	</div>
{:else if notFound}
	<h1 class="sr-only">Property</h1>
	<EmptyState
		title="Property not found."
		description="This property does not exist or is no longer available."
	>
		{#snippet action()}
			<TextLink href={resolve('/properties')}>Back to properties</TextLink>
		{/snippet}
	</EmptyState>
{:else if error || !property || !detail}
	<h1 class="sr-only">Property</h1>
	<EmptyState title="We could not load this property." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={() => void load(propertyId)}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	<p class="sr-only" role="status" aria-live="polite">{fullAddress} loaded.</p>

	<Breadcrumb items={breadcrumb} class="pb-4" />

	<header class="flex flex-col gap-4 pb-8 md:flex-row md:items-start md:justify-between">
		<div class="flex min-w-0 flex-col gap-2">
			<div class="flex flex-wrap items-center gap-3">
				<h1 class="text-large-title break-words text-ink">{fullAddress}</h1>
				<StateChip entity="property" state={property.state} />
			</div>

			{#if customer}
				<p class="flex flex-wrap items-center gap-1 text-callout text-ink-secondary">
					<span>Customer</span>
					<EntityLink
						href={resolve(`/customers/${customer.id}`)}
						class="inline-flex min-h-target items-center"
					>
						{customer.caption}
					</EntityLink>
				</p>
			{:else}
				<p class="text-callout text-ink-secondary">No customer linked.</p>
			{/if}

			{#if stateNote}
				<p class="text-footnote text-ink-tertiary">{stateNote}</p>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
			{#if property.state === 'pending_review'}
				<PermissionGate permission={PERMISSIONS.PROPERTY_UPDATE}>
					<Button variant="primary" onclick={() => (dedupOpen = true)}>Review duplicate</Button>
				</PermissionGate>
			{/if}

			{#if canEdit}
				<PermissionGate permission={PERMISSIONS.PROPERTY_UPDATE}>
					<Button variant="primary" onclick={() => (editOpen = true)}>Edit property</Button>
				</PermissionGate>

				<PermissionGate permission={PERMISSIONS.PROPERTY_ARCHIVE}>
					<Button variant="destructive" onclick={() => (archiveOpen = true)}>
						Archive property
					</Button>
				</PermissionGate>
			{/if}
		</div>
	</header>

	<div class="sr-only" role="status" aria-live="polite">{activeTab} tab shown.</div>

	<Tabs label="Property record" tabs={TABS} bind:value={activeTab}>
		{#snippet children(tabId)}
			{#if tabId === 'overview'}
				<div class="flex flex-col gap-4">
					<DetailSection title="Address" description="Where the work happens.">
						<KeyValueGrid items={addressItems} />
					</DetailSection>

					<DetailSection
						title="Access notes"
						description="How to get in and what to expect on site."
					>
						<AccessNotes value={property.accessNotes} />
					</DetailSection>

					<DetailSection title="Projects" description="Every project at this address.">
						{#if projects.length === 0}
							<EmptyState
								title="No projects yet."
								description="Create a project from /projects/new to start work at this address."
							>
								{#snippet action()}
									<TextLink href={resolve('/projects/new' as Pathname)}>New project</TextLink>
								{/snippet}
							</EmptyState>
						{:else}
							<ul class="flex list-none flex-col p-0">
								{#each projects as project (project.id)}
									<li
										class="flex flex-col gap-1 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
									>
										<div class="flex min-w-0 flex-col gap-1">
											<EntityLink
												href={resolve(`/projects/${project.id}` as Pathname)}
												class="inline-flex min-h-target items-center"
											>
												{project.caption}
											</EntityLink>
											<span class="text-footnote text-ink-secondary">
												{project.reference} · {PROJECT_TYPE_LABELS[
													project.projectType as ProjectType
												] ?? project.projectType}
											</span>
										</div>
										<StateChip entity="project" state={project.status} />
									</li>
								{/each}
							</ul>
						{/if}
					</DetailSection>
				</div>
			{:else if tabId === 'audit'}
				<div class="rounded-lg border border-hairline bg-canvas p-4 md:p-5">
					{#if auditError}
						<div class="flex flex-col items-start gap-3">
							<AuditTrailTab rows={[]} error={auditError} />
							<Button variant="secondary" onclick={retryAudit}>Try again</Button>
						</div>
					{:else}
						<AuditTrailTab
							rows={auditRows ?? []}
							loading={auditLoading}
							emptyLabel="No activity for this property yet."
						/>
					{/if}
				</div>
			{/if}
		{/snippet}
	</Tabs>

	<PropertyFormDialog
		bind:open={editOpen}
		{property}
		customerCaption={customer?.caption ?? null}
		onSaved={handleSaved}
		onDedupConflict={() => void load(propertyId)}
		onClose={() => (editOpen = false)}
	/>

	<ConfirmDialog
		bind:open={archiveOpen}
		title={`Archive ${property.addressLine1}?`}
		description="The property leaves the active list. The record, its projects and its history are kept."
		confirmLabel="Archive property"
		destructive
		error={archiveError}
		onconfirm={confirmArchive}
	/>

	<PropertyDedupReview bind:open={dedupOpen} heldId={propertyId} onReviewed={reloadAfterDedup} />
{/if}
