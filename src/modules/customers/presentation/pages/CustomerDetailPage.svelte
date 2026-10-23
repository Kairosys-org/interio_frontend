<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import {
		CUSTOMER_SOURCE_LABELS,
		PREFERRED_CHANNEL_LABELS,
		PROJECT_TYPE_LABELS,
		type ProjectType
	} from '$shared/domain/record-states';
	import type { AuditTrailRow } from '$shared/domain/audit';
	import { isUuid } from '$shared/domain/uuid';
	import { formatDate } from '$shared/lib/format';
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
	import { customersApi } from '../../data/api';
	import type { Customer, CustomerDetail } from '../../domain/types';
	import CustomerDedupReview from '../components/CustomerDedupReview.svelte';
	import CustomerFormDialog from '../components/CustomerFormDialog.svelte';

	/**
	 * `/customers/[id]` detail hub (DESIGN §10.2 Detail hub): identity header
	 * with state, facts, and the Properties / Projects / Audit tabs. Quotes and
	 * later tabs are registered by their own phases — no dead tab is rendered.
	 */
	interface Props {
		customerId: string;
	}

	let { customerId }: Props = $props();

	const TABS = [
		{ id: 'properties', label: 'Properties' },
		{ id: 'projects', label: 'Projects' },
		{ id: 'audit', label: 'Audit' }
	];

	function readTab(value: string | null): string {
		return TABS.some((tab) => tab.id === value) ? (value as string) : 'properties';
	}

	const requestedTab = page.url.searchParams.get('tab');
	let activeTab = $state(readTab(requestedTab));
	let lastTabParam: string | null = requestedTab;

	let detail = $state<CustomerDetail | null>(null);
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

	const validId = $derived(isUuid(customerId));
	const customer = $derived(detail?.customer ?? null);
	const canEdit = $derived(customer?.state === 'active');
	const properties = $derived(detail?.properties ?? []);
	const projects = $derived(detail?.projects ?? []);

	const breadcrumb = $derived([
		{ label: 'Customers', href: resolve('/customers') },
		{ label: customer?.caption ?? 'Customer' }
	]);

	const contactLine = $derived(
		[customer?.contactName, customer?.email, customer?.phone]
			.filter((value): value is string => Boolean(value))
			.join(' · ') || 'No contact details recorded.'
	);

	const address = $derived(
		[customer?.addressLine1, customer?.addressLine2]
			.filter((value): value is string => Boolean(value))
			.join(', ')
	);

	const detailItems = $derived(
		customer
			? [
					{ label: 'Contact', value: customer.contactName },
					{ label: 'Email', value: customer.email },
					{ label: 'Phone', value: customer.phone },
					{ label: 'Address', value: address },
					{ label: 'Town', value: customer.town },
					{ label: 'Postcode', value: customer.postcode },
					{
						label: 'Preferred channel',
						value: PREFERRED_CHANNEL_LABELS[customer.preferredChannel]
					},
					{ label: 'Source', value: CUSTOMER_SOURCE_LABELS[customer.source] },
					{ label: 'Created', value: formatDate(customer.createdAt) }
				]
			: []
	);

	const stateNote = $derived.by(() => {
		if (!customer || customer.state === 'active') return '';
		if (customer.state === 'pending_review')
			return 'Review the duplicate before editing this customer.';
		if (customer.state === 'archived') return 'This customer is archived and cannot be edited.';
		return 'This customer was cancelled during duplicate review.';
	});

	async function load(value: string): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;
		notFound = false;

		try {
			const result = await customersApi.get(value);
			if (sequence !== requestSequence) return;
			detail = result;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			detail = null;
			if (isApiError(caught) && caught.isNotFound()) {
				notFound = true;
			} else {
				error = isApiError(caught) ? caught.message : 'We could not load this customer. Try again.';
			}
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	$effect(() => {
		const value = customerId;
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
		if (tab === 'properties') params.delete('tab');
		else params.set('tab', tab);

		const suffix = params.toString();
		const target =
			suffix.length > 0 ? `/customers/${customerId}?${suffix}` : `/customers/${customerId}`;
		void goto(resolve(target as Pathname), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	});

	// Audit is lazy: it only loads once the tab is first opened.
	$effect(() => {
		const tab = activeTab;
		const id = customerId;
		if (tab !== 'audit' || !isUuid(id) || auditRequested === id) return;
		auditRequested = id;
		void loadAudit(id);
	});

	async function loadAudit(id: string): Promise<void> {
		auditLoading = true;
		auditError = null;
		try {
			auditRows = await customersApi.audit(id);
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
		void loadAudit(customerId);
	}

	function handleSaved(_saved: Customer): void {
		toast.success('Customer updated.');
		void load(customerId);
	}

	function openDedup(): void {
		dedupOpen = true;
	}

	async function confirmArchive(): Promise<void> {
		archiveError = null;
		try {
			await customersApi.archive(customerId);
		} catch (caught) {
			archiveError = isApiError(caught)
				? caught.message
				: 'We could not archive this customer. Try again.';
			throw caught;
		}

		archiveOpen = false;
		toast.success('Customer archived.');
		void load(customerId);
	}
</script>

<svelte:head>
	<title>{customer ? `${customer.caption} · Interio` : 'Customer · Interio'}</title>
</svelte:head>

{#if !validId}
	<h1 class="sr-only">Customer not found</h1>
	<EmptyState
		title="Customer not found."
		description="This customer does not exist or is no longer available."
	>
		{#snippet action()}
			<TextLink href={resolve('/customers')}>Back to customers</TextLink>
		{/snippet}
	</EmptyState>
{:else if loading}
	<div class="flex flex-col gap-6" aria-busy="true">
		<h1 class="sr-only">Loading customer</h1>
		<p class="sr-only" role="status" aria-live="polite">Loading customer.</p>
		<Skeleton lines={1} class="max-w-content-reading" />
		<Skeleton variant="block" />
		<Skeleton variant="block" />
	</div>
{:else if notFound}
	<h1 class="sr-only">Customer not found</h1>
	<EmptyState
		title="Customer not found."
		description="This customer does not exist or is no longer available."
	>
		{#snippet action()}
			<TextLink href={resolve('/customers')}>Back to customers</TextLink>
		{/snippet}
	</EmptyState>
{:else if error || !customer || !detail}
	<h1 class="sr-only">Customer unavailable</h1>
	<EmptyState title="We could not load this customer." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={() => void load(customerId)}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	<p class="sr-only" role="status" aria-live="polite">{customer.caption} loaded.</p>

	<Breadcrumb items={breadcrumb} class="pb-4" />

	<header class="flex flex-col gap-4 pb-8 md:flex-row md:items-start md:justify-between">
		<div class="flex min-w-0 flex-col gap-2">
			<div class="flex flex-wrap items-center gap-3">
				<h1 class="text-large-title text-ink">{customer.caption}</h1>
				<StateChip entity="customer" state={customer.state} />
			</div>
			<p class="text-callout break-words text-ink-secondary">{contactLine}</p>
			{#if stateNote}
				<p class="text-footnote text-ink-tertiary">{stateNote}</p>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
			{#if customer.state === 'pending_review'}
				<PermissionGate permission={PERMISSIONS.CUSTOMER_UPDATE}>
					<Button variant="primary" onclick={openDedup}>Review duplicate</Button>
				</PermissionGate>
			{/if}

			{#if canEdit}
				<PermissionGate permission={PERMISSIONS.CUSTOMER_UPDATE}>
					<Button variant="primary" onclick={() => (editOpen = true)}>Edit customer</Button>
				</PermissionGate>

				<PermissionGate permission={PERMISSIONS.CUSTOMER_ARCHIVE}>
					<Button variant="destructive" onclick={() => (archiveOpen = true)}>
						Archive customer
					</Button>
				</PermissionGate>
			{/if}
		</div>
	</header>

	<DetailSection
		title="Customer details"
		description="Contact details, address and where this record came from."
	>
		<KeyValueGrid items={detailItems} />
	</DetailSection>

	<section
		aria-label="Customer record"
		class="mt-4 rounded-lg border border-hairline bg-canvas p-4 md:p-5"
	>
		<div class="sr-only" role="status" aria-live="polite">{activeTab} tab shown.</div>

		<Tabs label="Customer record" tabs={TABS} bind:value={activeTab}>
			{#snippet children(tabId)}
				{#if tabId === 'properties'}
					{#if properties.length === 0}
						<EmptyState
							title="No properties yet."
							description="Properties for this customer appear here once they are added."
						/>
					{:else}
						<ul class="flex list-none flex-col p-0">
							{#each properties as property (property.id)}
								<li
									class="flex flex-col gap-1 border-b border-hairline py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
								>
									<div class="flex min-w-0 flex-col gap-1">
										<EntityLink
											href={resolve(`/properties/${property.id}` as Pathname)}
											class="inline-flex min-h-target items-center"
										>
											{property.addressLine1}{#if property.addressLine2}, {property.addressLine2}{/if}
										</EntityLink>
										<span class="text-footnote text-ink-secondary">
											{[property.town, property.postcode]
												.filter((value): value is string => Boolean(value))
												.join(' · ') || 'No town or postcode recorded'}
										</span>
									</div>
									<StateChip entity="property" state={property.state} />
								</li>
							{/each}
						</ul>
					{/if}
				{:else if tabId === 'projects'}
					{#if projects.length === 0}
						<EmptyState
							title="No projects yet."
							description="Projects for this customer appear here once they are created."
						/>
					{:else}
						<ul class="flex list-none flex-col p-0">
							{#each projects as project (project.id)}
								<li
									class="flex flex-col gap-1 border-b border-hairline py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
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
				{:else if tabId === 'audit'}
					{#if auditError}
						<div class="flex flex-col items-start gap-3">
							<AuditTrailTab rows={[]} error={auditError} />
							<Button variant="secondary" onclick={retryAudit}>Try again</Button>
						</div>
					{:else}
						<AuditTrailTab
							rows={auditRows ?? []}
							loading={auditLoading}
							emptyLabel="No activity for this customer yet."
						/>
					{/if}
				{/if}
			{/snippet}
		</Tabs>
	</section>

	<CustomerFormDialog
		bind:open={editOpen}
		{customer}
		onSaved={handleSaved}
		onDedupConflict={() => void load(customerId)}
		onClose={() => (editOpen = false)}
	/>

	<ConfirmDialog
		bind:open={archiveOpen}
		title={`Archive ${customer.caption}?`}
		description="The customer leaves the active list. The record and its history are kept."
		confirmLabel="Archive customer"
		destructive
		error={archiveError}
		onconfirm={confirmArchive}
	/>

	<CustomerDedupReview
		bind:open={dedupOpen}
		heldId={customerId}
		onReviewed={() => void load(customerId)}
	/>
{/if}
