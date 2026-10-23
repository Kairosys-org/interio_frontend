<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { propertiesApi } from '$modules/properties/data/api';
	import type { PropertyListRow } from '$modules/properties/domain/types';
	import { isApiError } from '$network/errors';
	import { Button, RadioGroup, SearchInput, Skeleton } from '$shared/presentation/ui';
	import type { CustomerChoice, PropertyChoice } from '../wizard-types';
	import { propertyChoiceFrom } from '../wizard-types';

	/**
	 * Step 2 — choose a property that belongs to the selected customer. The
	 * customer filter is applied by the API, never by filtering a global list in
	 * the browser, so pagination and search stay honest.
	 */
	interface Props {
		customer: CustomerChoice | null;
		selected: PropertyChoice | null;
		onselect: (choice: PropertyChoice | null) => void;
		error?: string | null;
	}

	let { customer, selected, onselect, error = null }: Props = $props();

	const PAGE_SIZE = 20;
	let query = $state('');
	let rows = $state<PropertyListRow[]>([]);
	let page = $state(1);
	let hasMore = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let requestSequence = 0;

	const options = $derived.by(() => {
		const list = rows.map((row) => {
			const choice = propertyChoiceFrom(row);
			return {
				value: choice.id,
				label: choice.label,
				description: row.postcode ?? row.customerCaption
			};
		});
		if (selected && !list.some((option) => option.value === selected.id)) {
			list.unshift({
				value: selected.id,
				label: selected.label,
				description: 'Selected property'
			});
		}
		return list;
	});

	const newPropertyHref = resolve('/properties/new' as string as Pathname);

	let loadedCustomerId: string | null = null;

	$effect(() => {
		const current = customer?.id ?? null;
		if (current === loadedCustomerId) return;
		loadedCustomerId = current;
		query = '';
		page = 1;
		hasMore = false;
		rows = [];
		loadError = null;
		if (current === null) return;
		void load(current, '');
	});

	async function load(customerId: string, search: string, nextPage = 1): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		loadError = null;

		try {
			const result = await propertiesApi.list({
				customerId,
				search: search.trim().length > 0 ? search.trim() : undefined,
				state: 'active',
				sort: 'addressLine1',
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
			loadError = isApiError(caught) ? caught.message : 'We could not load properties. Try again.';
			if (nextPage === 1) rows = [];
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	function handleSearch(value: string): void {
		query = value;
		if (!customer) return;
		void load(customer.id, value);
	}

	function handleChange(event: Event): void {
		const id = (event.currentTarget as HTMLInputElement).value;
		const row = rows.find((candidate) => candidate.id === id);
		onselect(row ? propertyChoiceFrom(row) : selected);
	}
</script>

{#if !customer}
	<div class="rounded-md border border-hairline bg-canvas-grouped p-4">
		<h3 class="text-title-3 text-ink">Choose a customer first.</h3>
		<p class="text-callout text-ink-secondary">
			A property always belongs to one customer. Go back to step 1 and select the customer.
		</p>
	</div>
{:else}
	<div class="flex flex-col gap-4">
		<p class="text-callout text-ink-secondary">
			Properties for <span class="text-ink">{customer.caption}</span>
		</p>

		<SearchInput
			label="Search properties"
			bind:value={query}
			placeholder="Address, town or postcode"
			onsearch={handleSearch}
		/>

		{#if loadError}
			<div class="flex flex-col gap-3 rounded-md border border-critical bg-critical-soft p-4">
				<p role="alert" class="text-callout text-critical-ink">{loadError}</p>
				<Button variant="secondary" onclick={() => void load(customer.id, query)}>Try again</Button>
			</div>
		{:else if loading && rows.length === 0}
			<div class="flex flex-col gap-2" role="status" aria-live="polite">
				<span class="sr-only">Loading properties</span>
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
						{query.trim().length > 0
							? 'No properties match this search.'
							: 'This customer has no property yet.'}
					</h3>
					<p class="text-callout text-ink-secondary">
						{query.trim().length > 0
							? 'Try a different address or postcode.'
							: 'Add the property where this project will take place, then come back.'}
					</p>
				</div>

				{#if query.trim().length === 0}
					<a
						href={newPropertyHref}
						class="inline-flex min-h-target min-w-target touch-manipulation items-center justify-center gap-2 rounded-md bg-brand px-4 text-subheadline whitespace-nowrap text-on-brand select-none hover:bg-brand-hover"
					>
						New property
					</a>
				{/if}
			</div>
		{:else}
			<RadioGroup
				label="Property"
				value={selected?.id ?? ''}
				{options}
				error={error ?? undefined}
				onchange={handleChange}
				hint="Only active properties for this customer are listed."
			/>

			{#if hasMore}
				<Button
					variant="secondary"
					{loading}
					onclick={() => void load(customer.id, query, page + 1)}
				>
					Load more properties
				</Button>
			{/if}
		{/if}
	</div>
{/if}
