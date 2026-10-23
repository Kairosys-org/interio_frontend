<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import {
		propertyMatchReasons,
		type DedupCandidateRef,
		type DedupReviewInput
	} from '$shared/domain/dedup';
	import { Button, DedupReviewModal, Dialog, Skeleton } from '$shared/presentation/ui';
	import { propertiesApi } from '../../data/api';
	import type { PropertyDetail } from '../../domain/types';

	/**
	 * R5 review surface for a held property. It owns the full candidate
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

	/** The id the current context belongs to; a new id reloads. */
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
			loadError = 'This property is no longer available to review.';
			return;
		}

		if (requestedId === id) return;
		requestedId = id;
		void loadContext(id);
	});

	function captionFor(detail: PropertyDetail): string {
		const property = detail.property;
		return [property.addressLine1, property.postcode]
			.filter((value): value is string => Boolean(value))
			.join(', ');
	}

	function fieldView(detail: PropertyDetail): FieldView[] {
		const property = detail.property;
		return [
			{ label: 'Address line 1', value: property.addressLine1 },
			{ label: 'Address line 2', value: property.addressLine2 ?? '' },
			{ label: 'Town', value: property.town ?? '' },
			{ label: 'Postcode', value: property.postcode ?? '' },
			{ label: 'Customer', value: detail.customer?.caption ?? '' },
			{ label: 'Access notes', value: property.accessNotes ?? '' }
		];
	}

	async function loadContext(id: string): Promise<void> {
		const sequence = ++requestSequence;
		loadError = null;
		reviewError = null;
		held = null;
		candidateRows = [];

		try {
			const detail = await propertiesApi.get(id);
			if (sequence !== requestSequence) return;

			const refs: DedupCandidateRef[] =
				candidates.length > 0
					? candidates
					: detail.property.dedupOfId
						? [
								{
									id: detail.property.dedupOfId,
									entityType: 'property',
									caption: '',
									createdAt: '',
									matchReasons: []
								}
							]
						: [];

			const loaded = await Promise.all(
				refs.map(async (ref): Promise<CandidateRecord | null> => {
					if (ref.id === detail.property.id) return null;
					try {
						const candidate = await propertiesApi.get(ref.id);
						return {
							id: candidate.property.id,
							caption: captionFor(candidate),
							createdAt: candidate.property.createdAt,
							matchReasons:
								ref.matchReasons.length > 0
									? [...ref.matchReasons]
									: propertyMatchReasons(detail.property, candidate.property),
							fields: fieldView(candidate)
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
				id: detail.property.id,
				caption: captionFor(detail),
				state: detail.property.state,
				createdAt: detail.property.createdAt,
				fields: fieldView(detail)
			};
			candidateRows = loaded.filter((row): row is CandidateRecord => row !== null);
		} catch (caught) {
			if (sequence !== requestSequence) return;
			loadError = isApiError(caught)
				? caught.message
				: 'We could not load this property. Close this and try again.';
		}
	}

	async function handleReview(input: DedupReviewInput): Promise<void> {
		if (!held) return;

		busy = true;
		reviewError = null;
		try {
			await propertiesApi.reviewDedup(held.id, input);
			open = false;
			toast.success(
				input.decision === 'link_to_existing'
					? 'Property linked to the existing record.'
					: 'Property confirmed as distinct.'
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
			description="This property could not be loaded for review."
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
