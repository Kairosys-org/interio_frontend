<script lang="ts">
	import { resolve } from '$app/paths';

	import { ArrowRight, CircleAlert, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { SurveyDetail, SurveyRoom, SurveyRoomTree } from '$modules/surveys/domain/types';
	import { isUuid } from '$shared/domain/uuid';
	import { formatCount } from '$shared/lib/format';
	import {
		Badge,
		Button,
		EmptyState,
		EntityLink,
		ForbiddenPage,
		Skeleton
	} from '$shared/presentation/ui';
	import { ROOM_TYPE_LABELS } from '$modules/surveys/presentation/survey-labels';
	import MobileHeader from '../components/MobileHeader.svelte';
	import RoomFormDialog from '../components/RoomFormDialog.svelte';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let detail = $state<SurveyDetail | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let sequence = 0;
	let formOpen = $state(false);

	const validId = $derived(isUuid(id));
	const survey = $derived(detail?.survey ?? null);
	const rooms = $derived(detail?.rooms ?? []);

	const editable = $derived(
		survey !== null &&
			(survey.status === 'draft' || survey.status === 'in_progress' || survey.status === 'rejected')
	);

	$effect(() => {
		const value = id;
		if (!isUuid(value)) {
			sequence += 1;
			loading = false;
			detail = null;
			notFound = true;
			return;
		}
		void load(value);
	});

	async function load(value: string): Promise<void> {
		const current = ++sequence;
		loading = true;
		error = null;
		notFound = false;
		try {
			const hub = await surveysApi.get(value);
			if (current !== sequence) return;
			detail = hub;
		} catch (caught) {
			if (current !== sequence) return;
			detail = null;
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else
				error = isApiError(caught) ? caught.message : 'We could not load these rooms. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}

	function missing(tree: SurveyRoomTree): string[] {
		const missingDimensions: string[] = [];
		if (tree.room.ceilingHeightMm === null) missingDimensions.push('ceiling');
		if (tree.room.roomLengthMm === null) missingDimensions.push('length');
		if (tree.room.roomWidthMm === null) missingDimensions.push('width');
		return missingDimensions;
	}

	function handleCreated(room: SurveyRoom): void {
		toast.success(`${room.caption} added.`);
		formOpen = false;
		void load(id);
	}
</script>

<svelte:head>
	<title>{survey?.caption ? `Rooms · ${survey.caption}` : 'Rooms · Interio Survey'}</title>
</svelte:head>

{#if !validId}
	<ForbiddenPage
		variant="not-found"
		title="Survey not found."
		description="This survey does not exist or is no longer available."
		backHref={resolve('/m/surveys')}
		backLabel="Back to surveys"
	/>
{:else if loading}
	<div class="flex flex-col gap-4" aria-busy="true">
		<h1 class="sr-only">Loading rooms</h1>
		<Skeleton variant="block" />
		<Skeleton lines={3} />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Survey not found."
		description="This survey does not exist or is no longer available."
		backHref={resolve('/m/surveys')}
		backLabel="Back to surveys"
	/>
{:else if error || !detail || !survey}
	<h1 class="sr-only">Rooms</h1>
	<EmptyState title="We could not load these rooms." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={() => void load(id)}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	<MobileHeader
		title="Rooms"
		subtitle={`${survey.caption} · ${formatCount(rooms.length)} captured`}
		backHref={resolve(`/m/surveys/${survey.id}`)}
		backLabel="Survey"
	>
		{#snippet actions()}
			{#if editable}
				<Button variant="primary" onclick={() => (formOpen = true)}>
					{#snippet icon()}
						<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
					{/snippet}
					Add room
				</Button>
			{/if}
		{/snippet}
	</MobileHeader>

	{#if rooms.length === 0}
		<EmptyState
			title="No rooms captured yet."
			description="Add the first room, then name its walls and openings."
		>
			{#snippet action()}
				{#if editable}
					<Button variant="primary" onclick={() => (formOpen = true)}>Add room</Button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<ul class="flex list-none flex-col gap-3 p-0">
			{#each rooms as tree (tree.room.id)}
				{@const gaps = missing(tree)}
				<li>
					<EntityLink
						href={resolve(`/m/surveys/${survey.id}/rooms/${tree.room.id}`)}
						class="flex min-h-target touch-manipulation flex-col items-stretch gap-2 rounded-lg border border-hairline bg-canvas p-4 hover:bg-canvas-grouped"
					>
						<span class="flex w-full flex-wrap items-start justify-between gap-2">
							<span class="flex min-w-0 flex-col gap-0.5">
								<span class="text-headline break-words text-ink">{tree.room.caption}</span>
								<span class="text-footnote text-ink-secondary">
									{ROOM_TYPE_LABELS[tree.room.roomType]}
								</span>
							</span>
							{#if gaps.length === 0}
								<Badge label="Dimensions complete" tone="success" />
							{:else}
								<Badge label={`Missing ${gaps.join(', ')}`} tone="warning" />
							{/if}
						</span>

						<span class="flex flex-wrap gap-x-3 gap-y-1 text-footnote text-ink-secondary">
							<span>{tree.walls.length} walls</span>
							<span>{tree.openings.length} openings</span>
							<span>{tree.utilities.length} utilities</span>
							<span>{tree.obstacles.length} obstacles</span>
							<span>{tree.measurements.length} measurements</span>
						</span>

						{#if gaps.length > 0}
							<span class="flex items-start gap-1 text-footnote text-caution-ink">
								<CircleAlert
									size={14}
									strokeWidth={1.75}
									aria-hidden="true"
									class="mt-0.5 shrink-0"
								/>
								<span>Missing {gaps.join(', ')}.</span>
							</span>
						{/if}

						<span
							class="inline-flex w-full items-center justify-end gap-1 text-footnote text-brand"
						>
							Open room
							<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
						</span>
					</EntityLink>
				</li>
			{/each}
		</ul>
	{/if}

	<RoomFormDialog
		bind:open={formOpen}
		surveyId={survey.id}
		oncreated={handleCreated}
		onclose={() => (formOpen = false)}
	/>
{/if}
