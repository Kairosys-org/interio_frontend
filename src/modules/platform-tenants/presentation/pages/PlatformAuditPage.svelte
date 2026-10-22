<script lang="ts">
	import { isApiError } from '$network/errors';
	import { formatCount, formatDateTime } from '$shared/lib/format';
	import { stateLabel } from '$shared/lib/status';
	import { Button, EmptyState, Input, Pagination, Select, Skeleton } from '$shared/presentation/ui';
	import { platformTenantsApi } from '../../data/api';
	import type { PlatformAuditRow } from '../../domain/types';

	const PAGE_SIZE = 25;

	const ACTION_LABELS: Record<string, string> = {
		'tenant.created': 'Tenant created',
		'tenant.suspended': 'Tenant suspended',
		'tenant.reactivated': 'Tenant reactivated',
		'tenant.offboarded': 'Tenant offboarded'
	};

	function actionLabel(action: string): string {
		return ACTION_LABELS[action] ?? stateLabel(action.replaceAll('.', '_'));
	}

	function detailSummary(payload: Record<string, unknown> | null): string {
		if (!payload) return '—';
		const reason = payload.reason;
		if (typeof reason === 'string' && reason.trim().length > 0) return reason.trim();
		const slug = payload.slug;
		if (typeof slug === 'string' && slug.length > 0) return slug;
		return '—';
	}

	let search = $state('');
	let debouncedSearch = $state('');
	let tenantId = $state('all');

	let tenantChoices = $state<{ value: string; label: string }[]>([]);
	const tenantOptions = $derived([{ value: 'all', label: 'All tenants' }, ...tenantChoices]);

	let rows = $state<PlatformAuditRow[]>([]);
	let total = $state(0);
	let currentPage = $state(1);
	let loading = $state(true);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);

	let requestSequence = 0;

	const hasFilters = $derived(debouncedSearch.trim().length > 0 || tenantId !== 'all');

	async function loadTenantChoices(): Promise<void> {
		try {
			const page = await platformTenantsApi.list({ page: 1, pageSize: 100 });
			tenantChoices = page.items.map((tenant) => ({
				value: tenant.id,
				label: tenant.displayName
			}));
		} catch {
			// The filter stays at "All tenants"; the stream below surfaces any
			// authorisation or transport failure in its own error state.
			tenantChoices = [];
		}
	}

	async function loadPage(
		targetPage: number,
		replace: boolean,
		searchValue: string,
		tenantIdValue: string
	): Promise<void> {
		const sequence = ++requestSequence;
		if (replace) {
			loading = true;
			error = null;
		} else {
			loadingMore = true;
		}

		try {
			const result = await platformTenantsApi.listAudit({
				search: searchValue.trim().length > 0 ? searchValue.trim() : undefined,
				tenantId: tenantIdValue === 'all' ? null : tenantIdValue,
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
			error = isApiError(caught) ? caught.message : 'We could not load the audit log. Try again.';
		} finally {
			if (sequence === requestSequence) {
				loading = false;
				loadingMore = false;
			}
		}
	}

	$effect(() => {
		void loadTenantChoices();
	});

	$effect(() => {
		const term = search;
		const timer = setTimeout(() => {
			debouncedSearch = term;
		}, 250);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const searchValue = debouncedSearch;
		const tenantValue = tenantId;
		void loadPage(1, true, searchValue, tenantValue);
	});

	function loadMore(): void {
		void loadPage(currentPage + 1, false, debouncedSearch, tenantId);
	}

	function clearFilters(): void {
		search = '';
		debouncedSearch = '';
		tenantId = 'all';
	}
</script>

<header class="flex flex-col gap-1 pb-6">
	<h1 class="text-large-title text-ink">Platform audit</h1>
	<p class="text-callout text-ink-secondary">
		Tenant lifecycle and platform actions, newest first.
	</p>
</header>

<div class="flex flex-col gap-3 pb-6 md:flex-row md:items-end">
	<Input
		label="Search audit"
		type="search"
		bind:value={search}
		placeholder="Action, actor or tenant"
		autocomplete="off"
		class="md:flex-1"
	/>
	<Select label="Tenant" bind:value={tenantId} options={tenantOptions} class="md:w-sidebar" />
</div>

<section aria-labelledby="audit-heading" class="flex flex-col gap-4">
	<h2 id="audit-heading" class="sr-only">Platform audit events</h2>

	{#if loading}
		<div class="flex flex-col" aria-busy="true" aria-label="Loading audit events">
			{#each [0, 1, 2, 3, 4] as index (index)}
				<div class="border-b border-hairline py-4">
					<Skeleton lines={1} />
				</div>
			{/each}
		</div>
	{:else if error}
		<EmptyState title="We could not load the audit log." description={error}>
			{#snippet action()}
				<Button
					variant="secondary"
					onclick={() => void loadPage(1, true, debouncedSearch, tenantId)}>Try again</Button
				>
			{/snippet}
		</EmptyState>
	{:else if rows.length === 0}
		<EmptyState
			title={hasFilters ? 'No audit events match these filters.' : 'No platform activity yet.'}
			description={hasFilters
				? 'Clear the search or tenant filter to see the full stream.'
				: 'Tenant lifecycle events appear here as they happen.'}
		>
			{#snippet action()}
				{#if hasFilters}
					<Button variant="secondary" onclick={clearFilters}>Clear filters</Button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<div class="hidden overflow-x-auto rounded-md border border-hairline md:block">
			<table class="w-full border-collapse text-left">
				<caption class="sr-only">Platform audit events, newest first</caption>
				<thead class="bg-canvas-grouped">
					<tr>
						<th scope="col" class="px-4 py-3 text-footnote text-ink-secondary">When</th>
						<th scope="col" class="px-4 py-3 text-footnote text-ink-secondary">Action</th>
						<th scope="col" class="px-4 py-3 text-footnote text-ink-secondary">Actor</th>
						<th scope="col" class="px-4 py-3 text-footnote text-ink-secondary">Tenant</th>
						<th scope="col" class="px-4 py-3 text-footnote text-ink-secondary">Detail</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.id)}
						<tr class="border-t border-hairline">
							<td class="px-4 py-3 text-callout whitespace-nowrap text-ink-secondary">
								<time datetime={row.occurredAt}>{formatDateTime(row.occurredAt)}</time>
							</td>
							<td class="px-4 py-3 text-callout text-ink">{actionLabel(row.action)}</td>
							<td class="px-4 py-3 text-callout text-ink-secondary">{row.actorEmail}</td>
							<td class="px-4 py-3 text-callout text-ink-secondary">
								{row.subjectTenantName ?? '—'}
							</td>
							<td class="px-4 py-3 text-callout text-ink-secondary">
								{detailSummary(row.payload)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<ul class="flex list-none flex-col gap-3 p-0 md:hidden">
			{#each rows as row (row.id)}
				<li class="flex flex-col gap-2 rounded-md border border-hairline bg-canvas-grouped p-4">
					<div class="flex items-start justify-between gap-3">
						<span class="text-subheadline text-ink">{actionLabel(row.action)}</span>
						<time datetime={row.occurredAt} class="text-footnote text-ink-secondary">
							{formatDateTime(row.occurredAt)}
						</time>
					</div>
					<div class="flex flex-col gap-1 text-footnote">
						<span class="text-ink-secondary">{row.actorEmail}</span>
						<span class="text-ink-tertiary">{row.subjectTenantName ?? 'No tenant'}</span>
						{#if detailSummary(row.payload) !== '—'}
							<span class="text-callout text-ink-secondary">{detailSummary(row.payload)}</span>
						{/if}
					</div>
				</li>
			{/each}
		</ul>

		<Pagination
			hasMore={rows.length < total}
			loading={loadingMore}
			onLoadMore={loadMore}
			totalLabel={`${formatCount(total)} ${total === 1 ? 'event' : 'events'}`}
		/>
	{/if}
</section>
