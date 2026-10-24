<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { CircleAlert, Inbox } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import type { AuditTrailRow } from '$shared/domain/audit';
	import type { DedupEntityType } from '$shared/domain/dedup';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { formatCount } from '$shared/lib/format';
	import {
		Button,
		DedupReviewModal,
		EmptyState,
		PageHeader,
		SearchInput,
		Select,
		Skeleton,
		TextLink
	} from '$shared/presentation/ui';
	import { duplicatesApi } from '../../data/api';
	import type { DedupQueueItem, DedupReviewInput } from '../../domain/types';
	import DedupQueueCard from '../components/DedupQueueCard.svelte';

	/**
	 * `/dedup-queue` (phase-1 §1.4, spec Part 11 §4.2): every held
	 * `pending_review` row across customers, properties and projects.
	 *
	 * `duplicatesApi.list()` returns the whole queue, so search and record type
	 * filter this page client-side while `q` and `type` stay in the URL for a
	 * shareable, reload-safe view. Nothing is merged: a review records a
	 * decision and the row leaves the queue.
	 */
	const TYPE_VALUES: readonly DedupEntityType[] = ['customer', 'property', 'project'];

	const TYPE_OPTIONS = [
		{ value: 'all', label: 'All types' },
		{ value: 'customer', label: 'Customers' },
		{ value: 'property', label: 'Properties' },
		{ value: 'project', label: 'Projects' }
	];

	const REVIEW_PERMISSION: Readonly<Record<DedupEntityType, string>> = Object.freeze({
		customer: PERMISSIONS.CUSTOMER_UPDATE,
		property: PERMISSIONS.PROPERTY_UPDATE,
		project: PERMISSIONS.PROJECT_UPDATE
	});

	interface AuditEntry {
		open: boolean;
		loading: boolean;
		error: string | null;
		rows: AuditTrailRow[];
	}

	function isEntityType(value: string | null): value is DedupEntityType {
		return TYPE_VALUES.includes(value as DedupEntityType);
	}

	function auditKey(item: DedupQueueItem): string {
		return `${item.held.entityType}:${item.held.id}`;
	}

	const initialQuery = page.url.searchParams.get('q') ?? '';
	const initialType = page.url.searchParams.get('type');

	let query = $state(initialQuery);
	let selectedType = $state<string>(isEntityType(initialType) ? initialType : 'all');
	let items = $state<DedupQueueItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let reviewOpen = $state(false);
	let reviewItem = $state<DedupQueueItem | null>(null);
	let reviewBusy = $state(false);
	let reviewError = $state<string | null>(null);

	let auditEntries = $state<Record<string, AuditEntry>>({});

	let requestSequence = 0;
	let lastUrl = `${page.url.pathname}${page.url.search}`;

	const typeFilter = $derived<DedupEntityType | 'all'>(
		isEntityType(selectedType) ? selectedType : 'all'
	);
	const hasFilters = $derived(query.trim().length > 0 || typeFilter !== 'all');

	const filteredItems = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return items.filter(
			(item) =>
				(typeFilter === 'all' || item.held.entityType === typeFilter) && matchesQuery(item, needle)
		);
	});

	/** Identity fields only: state and workflow columns are not search terms. */
	const SEARCHABLE_FIELD_LABELS: ReadonlySet<string> = new Set([
		'Caption',
		'Contact',
		'Email',
		'Phone',
		'Address',
		'Address line 1',
		'Address line 2',
		'Town',
		'Postcode',
		'Reference'
	]);

	/** Caption plus the identity fields: covers name, email and address. */
	function matchesQuery(item: DedupQueueItem, needle: string): boolean {
		if (needle === '') return true;
		const values = item.held.fields
			.filter((field) => SEARCHABLE_FIELD_LABELS.has(field.label))
			.map((field) => field.value);
		return [item.held.caption, ...values].join(' ').toLowerCase().includes(needle);
	}

	function syncUrl(): void {
		const params = new SvelteURLSearchParams();
		if (query.trim().length > 0) params.set('q', query.trim());
		if (typeFilter !== 'all') params.set('type', typeFilter);

		const search = params.toString();
		const target = search.length > 0 ? `/dedup-queue?${search}` : '/dedup-queue';
		if (target === lastUrl) return;
		lastUrl = target;
		void goto(search.length > 0 ? resolve(`/dedup-queue?${search}`) : resolve('/dedup-queue'), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	async function load(): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;

		try {
			const result = await duplicatesApi.list();
			if (sequence !== requestSequence) return;
			items = result;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			items = [];
			error = isApiError(caught) ? caught.message : 'We could not load the dedup queue. Try again.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	let initialised = false;
	$effect(() => {
		if (initialised) return;
		initialised = true;
		syncUrl();
		void load();
	});

	function applyFilters(): void {
		syncUrl();
	}

	function applySearch(value: string): void {
		query = value;
		applyFilters();
	}

	function resetFilters(): void {
		query = '';
		selectedType = 'all';
		applyFilters();
	}

	function openReview(item: DedupQueueItem): void {
		reviewItem = item;
		reviewError = null;
		reviewOpen = true;
	}

	async function handleReview(input: DedupReviewInput): Promise<void> {
		const item = reviewItem;
		if (!item) return;

		reviewBusy = true;
		reviewError = null;
		try {
			await duplicatesApi.review({
				entityType: item.held.entityType,
				id: item.held.id,
				...input
			});
			reviewOpen = false;
			toast.success('Duplicate reviewed');
			void load();
		} catch (caught) {
			reviewError = isApiError(caught)
				? caught.message
				: 'We could not save this review. Try again.';
			throw caught;
		} finally {
			reviewBusy = false;
		}
	}

	function toggleHistory(item: DedupQueueItem): void {
		const key = auditKey(item);
		const existing = auditEntries[key];

		if (existing) {
			auditEntries[key] = { ...existing, open: !existing.open };
			return;
		}

		auditEntries[key] = { open: true, loading: true, error: null, rows: [] };
		void loadAudit(item, key);
	}

	async function loadAudit(item: DedupQueueItem, key: string): Promise<void> {
		try {
			const rows = await duplicatesApi.audit(item.held.entityType, item.held.id);
			const current = auditEntries[key];
			if (!current) return;
			auditEntries[key] = { ...current, rows, loading: false, error: null };
		} catch (caught) {
			const current = auditEntries[key];
			if (!current) return;
			auditEntries[key] = {
				...current,
				loading: false,
				error: isApiError(caught) ? caught.message : 'We could not load this history. Try again.'
			};
		}
	}
</script>

<svelte:head>
	<title>Dedup queue · Interio</title>
</svelte:head>

{#snippet emptyIcon()}
	<Inbox size={24} strokeWidth={1.75} aria-hidden="true" />
{/snippet}

<PageHeader
	title="Dedup queue"
	description="Possible duplicates are held for review. Nothing is merged automatically."
/>

<div class="flex flex-col gap-2 pt-6 pb-4">
	<div class="flex flex-col gap-3 md:flex-row md:items-end">
		<SearchInput
			label="Search duplicates"
			bind:value={query}
			placeholder="Name, email or address"
			onsearch={applySearch}
			class="md:flex-1"
		/>
		<Select
			label="Record type"
			bind:value={selectedType}
			options={TYPE_OPTIONS}
			onchange={applyFilters}
			class="md:w-sidebar"
		/>
	</div>
	<p class="text-footnote text-ink-secondary">
		Search and record type filter the whole queue on this page. The URL keeps the view shareable.
	</p>
</div>

<section
	class="flex min-w-0 flex-col gap-4"
	aria-label="Records held for review"
	aria-busy={loading ? 'true' : undefined}
>
	<p class="text-callout text-ink-secondary" role="status" aria-live="polite">
		{#if loading}
			Loading duplicates for review.
		{:else if error}
			Duplicates could not be loaded.
		{:else}
			{formatCount(items.length)}
			{items.length === 1 ? 'record' : 'records'} held for review.
			{#if hasFilters}
				Showing {formatCount(filteredItems.length)} of {formatCount(items.length)}.
			{/if}
		{/if}
	</p>

	{#if loading}
		<div class="flex flex-col gap-4">
			{#each [0, 1, 2] as index (index)}
				<div class="flex flex-col gap-4 rounded-lg border border-hairline bg-canvas p-4 md:p-5">
					<Skeleton lines={2} />
					<Skeleton variant="block" />
				</div>
			{/each}
		</div>
	{:else if error}
		<div
			role="alert"
			class="flex flex-col items-start gap-3 rounded-lg border border-hairline bg-canvas p-4"
		>
			<p class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{error}</span>
			</p>
			<Button variant="secondary" onclick={() => void load()}>Try again</Button>
		</div>
	{:else if items.length === 0}
		<EmptyState
			title="No duplicates to review"
			description="When a new customer, property or project matches an existing record, it is held here until someone reviews it."
			icon={emptyIcon}
		>
			{#snippet action()}
				<TextLink href={resolve('/customers')} class="inline-flex min-h-target items-center">
					Go to customers
				</TextLink>
			{/snippet}
		</EmptyState>
	{:else if filteredItems.length === 0}
		<EmptyState
			title="No duplicates match these filters."
			description="Clear the search or choose a different record type to see the rest of the queue."
		>
			{#snippet action()}
				<Button variant="secondary" onclick={resetFilters}>Clear filters</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="flex flex-col gap-4">
			{#each filteredItems as item (auditKey(item))}
				{@const audit = auditEntries[auditKey(item)]}
				<DedupQueueCard
					{item}
					permission={REVIEW_PERMISSION[item.held.entityType]}
					auditOpen={audit?.open ?? false}
					auditLoading={audit?.loading ?? false}
					auditError={audit?.error ?? null}
					auditRows={audit?.rows ?? []}
					onreview={openReview}
					ontogglehistory={toggleHistory}
				/>
			{/each}
		</div>
	{/if}
</section>

{#if reviewItem}
	<DedupReviewModal
		bind:open={reviewOpen}
		held={reviewItem.held}
		candidates={reviewItem.candidates}
		busy={reviewBusy}
		error={reviewError}
		onreview={handleReview}
	/>
{/if}
