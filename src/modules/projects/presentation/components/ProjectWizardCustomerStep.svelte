<script lang="ts">
	import { resolve } from '$app/paths';
	import { customersApi } from '$modules/customers/data/api';
	import type { CustomerListRow } from '$modules/customers/domain/types';
	import { isApiError } from '$network/errors';
	import { Button, RadioGroup, SearchInput, Skeleton } from '$shared/presentation/ui';
	import type { CustomerChoice } from '../wizard-types';

	/**
	 * Step 1 — choose the customer. Only active customers are offered: a held
	 * or archived record cannot start new work. The page keeps the choice; this
	 * component only searches, pages and reports the selected row.
	 */
	interface Props {
		selected: CustomerChoice | null;
		onselect: (choice: CustomerChoice | null) => void;
		error?: string | null;
	}

	let { selected, onselect, error = null }: Props = $props();

	const PAGE_SIZE = 20;
	let query = $state('');
	let rows = $state<CustomerListRow[]>([]);
	let page = $state(1);
	let hasMore = $state(false);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let requestSequence = 0;

	/** Keep a selection made on a previous page visible after going back. */
	const options = $derived.by(() => {
		const list = rows.map((row) => ({
			value: row.id,
			label: row.caption,
			description: [row.email, row.phone, row.postcode]
				.filter((part): part is string => typeof part === 'string' && part.length > 0)
				.join(' · ')
		}));
		if (selected && !list.some((option) => option.value === selected.id)) {
			list.unshift({
				value: selected.id,
				label: selected.caption,
				description: 'Selected customer'
			});
		}
		return list;
	});

	const newCustomerHref = resolve('/customers/new');

	$effect(() => {
		void load('');
	});

	async function load(search: string, nextPage = 1): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		loadError = null;

		try {
			const result = await customersApi.list({
				search: search.trim().length > 0 ? search.trim() : undefined,
				state: 'active',
				sort: 'caption',
				sortDir: 'asc',
				page: nextPage,
				pageSize: PAGE_SIZE
			});
			if (sequence !== requestSequence) return;
			rows = nextPage === 1 ? result.items : [...rows, ...result.items];
			page = result.page;
			hasMore = result.hasMore;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			loadError = isApiError(caught) ? caught.message : 'We could not load customers. Try again.';
			if (nextPage === 1) rows = [];
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	function handleSearch(value: string): void {
		query = value;
		void load(value);
	}

	function handleChange(event: Event): void {
		const id = (event.currentTarget as HTMLInputElement).value;
		const row = rows.find((candidate) => candidate.id === id);
		onselect(
			row ? { id: row.id, caption: row.caption, email: row.email } : selected ? selected : null
		);
	}
</script>

<div class="flex flex-col gap-4">
	<SearchInput
		label="Search customers"
		bind:value={query}
		placeholder="Name, email, phone or postcode"
		onsearch={handleSearch}
	/>

	{#if loadError}
		<div class="flex flex-col gap-3 rounded-md border border-critical bg-critical-soft p-4">
			<p role="alert" class="text-callout text-critical-ink">{loadError}</p>
			<Button variant="secondary" onclick={() => void load(query)}>Try again</Button>
		</div>
	{:else if loading && rows.length === 0}
		<div class="flex flex-col gap-2" role="status" aria-live="polite">
			<span class="sr-only">Loading customers</span>
			<Skeleton />
			<Skeleton />
			<Skeleton />
		</div>
	{:else if rows.length === 0}
		<div
			class="flex flex-col items-start gap-3 rounded-md border border-hairline bg-canvas-grouped p-4"
		>
			<div class="flex flex-col gap-1">
				<h3 class="text-title-3 text-ink">
					{query.trim().length > 0 ? 'No customers match this search.' : 'No customers yet.'}
				</h3>
				<p class="text-callout text-ink-secondary">
					{query.trim().length > 0
						? 'Try a different name, email or postcode.'
						: 'Create the customer first, then come back to start their project.'}
				</p>
			</div>

			{#if query.trim().length === 0}
				<a
					href={newCustomerHref}
					class="inline-flex min-h-target min-w-target touch-manipulation items-center justify-center gap-2 rounded-md bg-brand px-4 text-subheadline whitespace-nowrap text-on-brand select-none hover:bg-brand-hover"
				>
					New customer
				</a>
			{/if}
		</div>
	{:else}
		<RadioGroup
			label="Customer"
			value={selected?.id ?? ''}
			{options}
			error={error ?? undefined}
			onchange={handleChange}
			hint="Only active customers are listed."
		/>

		{#if hasMore}
			<Button variant="secondary" {loading} onclick={() => void load(query, page + 1)}>
				Load more customers
			</Button>
		{/if}
	{/if}
</div>
