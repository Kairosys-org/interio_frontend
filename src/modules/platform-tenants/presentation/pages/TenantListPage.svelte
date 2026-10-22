<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { formatCount, formatDate } from '$shared/lib/format';
	import { stateLabel } from '$shared/lib/status';
	import type { TenantStatus } from '$shared/domain/user';
	import {
		Badge,
		Button,
		EmptyState,
		Input,
		Pagination,
		Select,
		Skeleton
	} from '$shared/presentation/ui';
	import { platformTenantsApi } from '../../data/api';
	import type { TenantListRow } from '../../domain/types';
	import TenantFormDialog from '../components/TenantFormDialog.svelte';

	const PAGE_SIZE = 25;

	const STATUS_OPTIONS = [
		{ value: 'all', label: 'All statuses' },
		{ value: 'active', label: 'Active' },
		{ value: 'suspended', label: 'Suspended' },
		{ value: 'offboarded', label: 'Offboarded' }
	];

	const initialQuery = page.url.searchParams.get('q') ?? '';
	const initialStatus = page.url.searchParams.get('status') ?? 'all';

	let query = $state(initialQuery);
	let debouncedQuery = $state(initialQuery);
	let status = $state(initialStatus);

	let rows = $state<TenantListRow[]>([]);
	let total = $state(0);
	let currentPage = $state(1);
	let loading = $state(true);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);
	let createOpen = $state(false);

	let requestSequence = 0;
	let lastUrl = `${page.url.pathname}${page.url.search}`;

	const hasFilters = $derived(debouncedQuery.trim().length > 0 || status !== 'all');

	function toStatusFilter(value: string): TenantStatus | 'all' {
		return value === 'active' || value === 'suspended' || value === 'offboarded' ? value : 'all';
	}

	function statusTone(value: TenantStatus): 'success' | 'warning' | 'neutral' {
		if (value === 'active') return 'success';
		if (value === 'suspended') return 'warning';
		return 'neutral';
	}

	function syncUrl(searchValue: string, statusValue: string): void {
		const params = new URLSearchParams();
		if (searchValue.trim().length > 0) params.set('q', searchValue.trim());
		if (statusValue !== 'all') params.set('status', statusValue);
		const suffix = params.toString();
		const target = suffix.length > 0 ? `/platform/tenants?${suffix}` : '/platform/tenants';
		if (target === lastUrl) return;
		lastUrl = target;
		void goto(resolve(target as Pathname), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	async function loadPage(
		targetPage: number,
		replace: boolean,
		searchValue: string,
		statusValue: TenantStatus | 'all'
	): Promise<void> {
		const sequence = ++requestSequence;
		if (replace) {
			loading = true;
			error = null;
		} else {
			loadingMore = true;
		}

		try {
			const result = await platformTenantsApi.list({
				search: searchValue.trim().length > 0 ? searchValue.trim() : undefined,
				status: statusValue,
				page: targetPage,
				pageSize: PAGE_SIZE
			});
			if (sequence !== requestSequence) return;
			rows = replace ? result.items : [...rows, ...result.items];
			total = result.total;
			currentPage = result.page;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			if (replace) {
				rows = [];
				total = 0;
			}
			error = isApiError(caught) ? caught.message : 'We could not load tenants. Try again.';
		} finally {
			if (sequence === requestSequence) {
				loading = false;
				loadingMore = false;
			}
		}
	}

	// 250 ms debounce so typing does not spam the API (DESIGN §9.3, ui-ux).
	$effect(() => {
		const next = query;
		const timer = setTimeout(() => {
			debouncedQuery = next;
		}, 250);
		return () => clearTimeout(timer);
	});

	// One reload per filter change; filters are mirrored into the URL so the
	// view is shareable (DESIGN §10.3).
	$effect(() => {
		const searchValue = debouncedQuery;
		const statusValue = status;
		syncUrl(searchValue, statusValue);
		void loadPage(1, true, searchValue, toStatusFilter(statusValue));
	});

	function loadMore(): void {
		void loadPage(currentPage + 1, false, debouncedQuery, toStatusFilter(status));
	}

	function resetFilters(): void {
		query = '';
		debouncedQuery = '';
		status = 'all';
	}
</script>

{#snippet plusIcon()}
	<Plus size={20} strokeWidth={1.75} aria-hidden="true" />
{/snippet}

<header class="flex flex-col gap-4 pb-6 md:flex-row md:items-start md:justify-between">
	<div class="flex flex-col gap-1">
		<h1 class="text-large-title text-ink">Tenants</h1>
		<p class="text-callout text-ink-secondary">Every studio workspace on the platform.</p>
	</div>
	<Button variant="primary" icon={plusIcon} onclick={() => (createOpen = true)}>New tenant</Button>
</header>

<div class="flex flex-col gap-3 pb-6 md:flex-row md:items-end">
	<Input
		label="Search tenants"
		type="search"
		bind:value={query}
		placeholder="Name or slug"
		autocomplete="off"
		class="md:flex-1"
	/>
	<Select label="Status" bind:value={status} options={STATUS_OPTIONS} class="md:w-sidebar" />
</div>

<section aria-labelledby="tenants-heading" class="flex flex-col gap-4">
	<h2 id="tenants-heading" class="sr-only">Tenant list</h2>

	{#if loading}
		<div class="flex flex-col" aria-busy="true" aria-label="Loading tenants">
			{#each [0, 1, 2, 3, 4] as index (index)}
				<div class="border-b border-hairline py-4">
					<Skeleton lines={1} />
				</div>
			{/each}
		</div>
	{:else if error}
		<EmptyState title="We could not load tenants." description={error}>
			{#snippet action()}
				<Button
					variant="secondary"
					onclick={() => void loadPage(1, true, debouncedQuery, toStatusFilter(status))}
				>
					Try again
				</Button>
			{/snippet}
		</EmptyState>
	{:else if rows.length === 0}
		<EmptyState
			title={hasFilters ? 'No tenants match these filters.' : 'No tenants yet.'}
			description={hasFilters
				? 'Clear the search or status filter to see every workspace.'
				: 'Create the first studio workspace to get started.'}
		>
			{#snippet action()}
				{#if hasFilters}
					<Button variant="secondary" onclick={resetFilters}>Clear filters</Button>
				{:else}
					<Button variant="tertiary" onclick={() => (createOpen = true)}>New tenant</Button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<div class="hidden overflow-x-auto rounded-md border border-hairline md:block">
			<table class="w-full border-collapse text-left">
				<caption class="sr-only">Tenants on the Interio platform</caption>
				<thead class="bg-canvas-grouped">
					<tr>
						<th scope="col" class="px-4 py-3 text-footnote text-ink-secondary">Tenant</th>
						<th scope="col" class="px-4 py-3 text-footnote text-ink-secondary">Slug</th>
						<th scope="col" class="px-4 py-3 text-footnote text-ink-secondary">Status</th>
						<th scope="col" class="px-4 py-3 text-footnote text-ink-secondary">Users</th>
						<th scope="col" class="px-4 py-3 text-footnote text-ink-secondary">Created</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.id)}
						<tr class="border-t border-hairline">
							<th scope="row" class="p-0 text-left font-normal">
								<a
									href={resolve(`/platform/tenants/${row.id}`)}
									class="flex min-h-row flex-col justify-center px-4 py-2 hover:bg-canvas-nested"
								>
									<span class="text-body text-ink">{row.displayName}</span>
									<span class="text-footnote text-ink-tertiary">{row.legalName}</span>
								</a>
							</th>
							<td class="px-4 py-3 text-callout">
								<span class="font-mono text-ink-secondary">{row.slug}</span>
							</td>
							<td class="px-4 py-3">
								<Badge label={stateLabel(row.status)} tone={statusTone(row.status)} />
							</td>
							<td class="px-4 py-3 text-callout text-ink-secondary tabular-nums">
								{formatCount(row.userCount)}
							</td>
							<td class="px-4 py-3 text-callout text-ink-secondary">
								{formatDate(row.createdAt)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<ul class="flex list-none flex-col gap-3 p-0 md:hidden">
			{#each rows as row (row.id)}
				<li class="rounded-md border border-hairline bg-canvas-grouped">
					<a
						href={resolve(`/platform/tenants/${row.id}`)}
						class="flex min-h-target flex-col gap-2 rounded-md p-4 hover:bg-canvas-nested"
					>
						<span class="flex items-start justify-between gap-3">
							<span class="flex min-w-0 flex-col">
								<span class="text-body text-ink">{row.displayName}</span>
								<span class="text-footnote text-ink-secondary">{row.legalName}</span>
							</span>
							<Badge label={stateLabel(row.status)} tone={statusTone(row.status)} />
						</span>
						<span
							class="flex flex-wrap items-center gap-x-4 gap-y-1 text-footnote text-ink-tertiary"
						>
							<span class="font-mono">{row.slug}</span>
							<span class="tabular-nums">{formatCount(row.userCount)} users</span>
							<span>Created {formatDate(row.createdAt)}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>

		<Pagination
			hasMore={rows.length < total}
			loading={loadingMore}
			onLoadMore={loadMore}
			totalLabel={`${formatCount(total)} ${total === 1 ? 'tenant' : 'tenants'}`}
		/>
	{/if}
</section>

<TenantFormDialog
	bind:open={createOpen}
	onCreated={() => {
		createOpen = false;
		toast.success('Tenant created.');
		void loadPage(1, true, debouncedQuery, toStatusFilter(status));
	}}
	onClose={() => (createOpen = false)}
/>
