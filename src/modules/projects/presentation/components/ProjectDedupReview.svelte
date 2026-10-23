<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import {
		projectMatchReasons,
		type DedupCandidateRef,
		type DedupReviewInput
	} from '$shared/domain/dedup';
	import { PROJECT_TYPE_LABELS } from '$shared/domain/record-states';
	import { stateLabel } from '$shared/lib/status';
	import { Button, DedupReviewModal, Dialog, Skeleton } from '$shared/presentation/ui';
	import { projectsApi } from '../../data/api';
	import type { Project, ProjectHub } from '../../domain/types';
	import { formatAddress } from '../wizard-types';

	/**
	 * R5 review surface for a held project, shared by the wizard (after a
	 * `409 conflict` create) and the hub (a row already held `pending_review`).
	 *
	 * The component owns the full candidate context, so callers pass only the
	 * held id and any refs the conflict returned. Nothing is ever merged
	 * automatically.
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
		onReviewed?: (project: Project) => void;
	}

	let { open = $bindable(false), heldId, candidates = [], onReviewed }: Props = $props();

	let held = $state<HeldRecord | null>(null);
	let candidateRows = $state<CandidateRecord[]>([]);
	let loadError = $state<string | null>(null);
	let reviewError = $state<string | null>(null);
	let busy = $state(false);

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
			loadError = 'This project is no longer available to review.';
			return;
		}

		if (requestedId === id) return;
		requestedId = id;
		void loadContext(id);
	});

	function fieldView(hub: ProjectHub): FieldView[] {
		return [
			{ label: 'Caption', value: hub.project.caption },
			{ label: 'Reference', value: hub.project.reference },
			{ label: 'Customer', value: hub.customer?.caption ?? '' },
			{ label: 'Property', value: hub.property ? formatAddress(hub.property) : '' },
			{ label: 'Type', value: PROJECT_TYPE_LABELS[hub.project.projectType] },
			{ label: 'Status', value: stateLabel(hub.project.status) }
		];
	}

	async function loadContext(id: string): Promise<void> {
		const sequence = ++requestSequence;
		loadError = null;
		reviewError = null;
		held = null;
		candidateRows = [];

		try {
			const detail = await projectsApi.get(id);
			if (sequence !== requestSequence) return;

			const refs: DedupCandidateRef[] =
				candidates.length > 0
					? candidates
					: detail.project.dedupOfId
						? [
								{
									id: detail.project.dedupOfId,
									entityType: 'project',
									caption: '',
									createdAt: '',
									matchReasons: []
								}
							]
						: [];

			const loaded = await Promise.all(
				refs.map(async (ref): Promise<CandidateRecord | null> => {
					if (ref.id === detail.project.id) return null;
					try {
						const candidate = await projectsApi.get(ref.id);
						return {
							id: candidate.project.id,
							caption: candidate.project.caption,
							createdAt: candidate.project.createdAt,
							matchReasons:
								ref.matchReasons.length > 0
									? [...ref.matchReasons]
									: projectMatchReasons(detail.project, candidate.project),
							fields: fieldView(candidate)
						};
					} catch {
						// A candidate that disappeared must not block the review; the
						// user can still confirm the held project is distinct.
						return null;
					}
				})
			);
			if (sequence !== requestSequence) return;

			held = {
				id: detail.project.id,
				caption: detail.project.caption,
				state: detail.project.state,
				createdAt: detail.project.createdAt,
				fields: fieldView(detail)
			};
			candidateRows = loaded.filter((row): row is CandidateRecord => row !== null);
		} catch (caught) {
			if (sequence !== requestSequence) return;
			loadError = isApiError(caught)
				? caught.message
				: 'We could not load this project. Close this and try again.';
		}
	}

	async function handleReview(input: DedupReviewInput): Promise<void> {
		if (!held) return;

		busy = true;
		reviewError = null;
		try {
			const updated = await projectsApi.reviewDedup(held.id, input);
			open = false;
			toast.success(
				input.decision === 'link_to_existing'
					? 'Project linked to the existing record.'
					: 'Project confirmed as distinct.'
			);
			onReviewed?.(updated);
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
			description="This project could not be loaded for review."
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
			description="Loading the held project and the possible matches."
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
