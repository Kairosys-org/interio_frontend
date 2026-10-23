<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import {
		customerMatchReasons,
		type DedupCandidateRef,
		type DedupReviewInput
	} from '$shared/domain/dedup';
	import { CUSTOMER_SOURCE_LABELS, PREFERRED_CHANNEL_LABELS } from '$shared/domain/record-states';
	import { Button, DedupReviewModal, Dialog, Skeleton } from '$shared/presentation/ui';
	import { customersApi } from '../../data/api';
	import type { Customer } from '../../domain/types';

	/**
	 * R5 review surface for a held customer. It owns the full candidate
	 * context (held record + possible matches), so the list and the detail
	 * page only pass an id and react to `onReviewed`.
	 *
	 * A `409 conflict` create supplies its candidate refs; a pending row in
	 * the list has no refs, so the held record's `dedupOfId` is resolved
	 * instead. Nothing is ever merged automatically.
	 */
	interface FieldView {
		label: string;
		value: string;
	}

	interface HeldRecord {
		id: string;
		caption: string;
		state: string;
		createdAt: string;
		fields: FieldView[];
	}

	interface CandidateRecord {
		id: string;
		caption: string;
		createdAt: string;
		matchReasons: string[];
		fields: FieldView[];
	}

	interface Props {
		open?: boolean;
		heldId: string | null;
		candidates?: DedupCandidateRef[];
		onReviewed?: () => void;
	}

	let { open = $bindable(false), heldId, candidates = [], onReviewed }: Props = $props();

	let held = $state<HeldRecord | null>(null);
	let candidateRows = $state<CandidateRecord[]>([]);
	let loadError = $state<string | null>(null);
	let reviewError = $state<string | null>(null);
	let busy = $state(false);

	/** The id the current context belongs to; a new id reloads, a reopen reuses nothing. */
	let requestedId: string | null = null;
	let requestSequence = 0;

	$effect(() => {
		const isOpen = open;
		const id = heldId;

		if (!isOpen) {
			requestedId = null;
			busy = false;
			return;
		}

		if (!id) {
			requestedId = null;
			held = null;
			candidateRows = [];
			loadError = 'This customer is no longer available to review.';
			return;
		}

		if (requestedId === id) return;
		requestedId = id;
		void loadContext(id);
	});

	function fieldView(customer: Customer): FieldView[] {
		const address = [customer.addressLine1, customer.addressLine2]
			.filter((line): line is string => Boolean(line))
			.join(', ');

		return [
			{ label: 'Caption', value: customer.caption },
			{ label: 'Contact', value: customer.contactName ?? '' },
			{ label: 'Email', value: customer.email ?? '' },
			{ label: 'Phone', value: customer.phone ?? '' },
			{ label: 'Address', value: address },
			{ label: 'Town', value: customer.town ?? '' },
			{ label: 'Postcode', value: customer.postcode ?? '' },
			{ label: 'Preferred channel', value: PREFERRED_CHANNEL_LABELS[customer.preferredChannel] },
			{ label: 'Source', value: CUSTOMER_SOURCE_LABELS[customer.source] }
		];
	}

	async function loadContext(id: string): Promise<void> {
		const sequence = ++requestSequence;
		loadError = null;
		reviewError = null;
		held = null;
		candidateRows = [];

		try {
			const detail = await customersApi.get(id);
			if (sequence !== requestSequence) return;

			const refs: DedupCandidateRef[] =
				candidates.length > 0
					? candidates
					: detail.customer.dedupOfId
						? [
								{
									id: detail.customer.dedupOfId,
									entityType: 'customer',
									caption: '',
									createdAt: '',
									matchReasons: []
								}
							]
						: [];

			const loaded = await Promise.all(
				refs.map(async (ref): Promise<CandidateRecord | null> => {
					if (ref.id === detail.customer.id) return null;
					try {
						const candidate = await customersApi.get(ref.id);
						return {
							id: candidate.customer.id,
							caption: candidate.customer.caption,
							createdAt: candidate.customer.createdAt,
							matchReasons:
								ref.matchReasons.length > 0
									? [...ref.matchReasons]
									: customerMatchReasons(detail.customer, candidate.customer),
							fields: fieldView(candidate.customer)
						};
					} catch {
						// A candidate that disappeared must not block the review; the
						// user can still confirm the held record is distinct.
						return null;
					}
				})
			);
			if (sequence !== requestSequence) return;

			held = {
				id: detail.customer.id,
				caption: detail.customer.caption,
				state: detail.customer.state,
				createdAt: detail.customer.createdAt,
				fields: fieldView(detail.customer)
			};
			candidateRows = loaded.filter((row): row is CandidateRecord => row !== null);
		} catch (caught) {
			if (sequence !== requestSequence) return;
			loadError = isApiError(caught)
				? caught.message
				: 'We could not load this customer. Close this and try again.';
		}
	}

	async function handleReview(input: DedupReviewInput): Promise<void> {
		if (!held) return;

		busy = true;
		reviewError = null;
		try {
			await customersApi.reviewDedup(held.id, input);
			open = false;
			toast.success(
				input.decision === 'link_to_existing'
					? 'Customer linked to the existing record.'
					: 'Customer confirmed as distinct.'
			);
			onReviewed?.();
		} catch (caught) {
			reviewError = isApiError(caught)
				? caught.message
				: 'We could not save this review. Try again.';
			throw caught;
		} finally {
			busy = false;
		}
	}
</script>

{#if open}
	{#if loadError}
		<Dialog
			bind:open
			title="Review possible duplicate"
			description="This customer could not be loaded for review."
		>
			<p role="alert" class="text-callout text-critical-ink">{loadError}</p>

			{#snippet footer()}
				<Button variant="secondary" onclick={() => (open = false)}>Close</Button>
			{/snippet}
		</Dialog>
	{:else if held}
		<DedupReviewModal
			bind:open
			{held}
			candidates={candidateRows}
			{busy}
			error={reviewError}
			onreview={handleReview}
		/>
	{:else}
		<Dialog
			bind:open
			title="Review possible duplicate"
			description="Loading the held record and the possible matches."
			size="lg"
		>
			<div class="flex flex-col gap-4" aria-busy="true">
				<p class="sr-only" role="status">Loading duplicate review</p>
				<Skeleton lines={2} />
				<Skeleton lines={2} />
				<Skeleton variant="block" />
			</div>
		</Dialog>
	{/if}
{/if}
