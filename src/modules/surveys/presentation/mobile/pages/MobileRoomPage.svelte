<script lang="ts">
	import { resolve } from '$app/paths';

	import { ArrowRight, CircleAlert, Images, Pencil, Plus, Ruler } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { surveysApi } from '$modules/surveys/data/api';
	import type {
		SurveyDetail,
		SurveyObstacle,
		SurveyOpening,
		SurveyRoom,
		SurveyRoomTree,
		SurveyUtility,
		SurveyWall
	} from '$modules/surveys/domain/types';
	import { isUuid } from '$shared/domain/uuid';
	import { formatDimension } from '$shared/lib/format';
	import {
		Badge,
		Button,
		EmptyState,
		EntityLink,
		ForbiddenPage,
		KeyValueGrid,
		MediaGrid,
		Skeleton,
		type MediaItem
	} from '$shared/presentation/ui';
	import {
		NOTE_CATEGORY_LABELS,
		OBSTACLE_TYPE_LABELS,
		OPENING_TYPE_LABELS,
		ROOM_TYPE_LABELS,
		UTILITY_TYPE_LABELS
	} from '$modules/surveys/presentation/survey-labels';
	import MobileHeader from '../components/MobileHeader.svelte';
	import MeasurementFormDialog from '../components/MeasurementFormDialog.svelte';
	import NoteFormDialog from '../components/NoteFormDialog.svelte';
	import ObstacleFormDialog from '../components/ObstacleFormDialog.svelte';
	import OpeningFormDialog from '../components/OpeningFormDialog.svelte';
	import RoomFormDialog from '../components/RoomFormDialog.svelte';
	import UtilityFormDialog from '../components/UtilityFormDialog.svelte';
	import WallFormDialog from '../components/WallFormDialog.svelte';

	interface Props {
		id: string;
		roomId: string;
	}

	let { id, roomId }: Props = $props();

	let detail = $state<SurveyDetail | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let sequence = 0;

	let roomDialogOpen = $state(false);
	let wallDialogOpen = $state(false);
	let openingDialogOpen = $state(false);
	let utilityDialogOpen = $state(false);
	let obstacleDialogOpen = $state(false);
	let noteDialogOpen = $state(false);
	let measurementDialogOpen = $state(false);

	let editWall = $state<SurveyWall | null>(null);
	let editOpening = $state<SurveyOpening | null>(null);
	let editUtility = $state<SurveyUtility | null>(null);
	let editObstacle = $state<SurveyObstacle | null>(null);

	const validIds = $derived(isUuid(id) && isUuid(roomId));
	const survey = $derived(detail?.survey ?? null);
	const tree = $derived(detail?.rooms.find((row) => row.room.id === roomId) ?? null);

	const editable = $derived(
		survey !== null &&
			(survey.status === 'draft' || survey.status === 'in_progress' || survey.status === 'rejected')
	);

	const photos = $derived.by<MediaItem[]>(() => {
		if (!detail) return [];
		return detail.media
			.filter((item) => item.ownerType === 'room' && item.ownerId === roomId)
			.map((item) => ({
				id: item.id,
				fileName: item.caption?.trim() || `photo-${item.id.slice(0, 8)}`,
				caption: item.caption,
				kind: item.assetKind,
				mimeType: item.assetKind === 'plan' ? 'application/pdf' : 'image/jpeg',
				previewUrl: item.url,
				uploadState: item.uploadState,
				ownerLabel: tree?.room.caption ?? null,
				alt: item.caption
			}));
	});

	const roomNotes = $derived(tree?.notes ?? []);

	$effect(() => {
		if (!validIds) {
			sequence += 1;
			loading = false;
			detail = null;
			notFound = true;
			return;
		}
		void load(id);
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
			if (!hub.rooms.some((row) => row.room.id === roomId)) notFound = true;
		} catch (caught) {
			if (current !== sequence) return;
			detail = null;
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else error = isApiError(caught) ? caught.message : 'We could not load this room. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}

	function refresh(message: string): void {
		toast.success(message);
		void load(id);
	}

	function editWallWith(wall: SurveyWall): void {
		editWall = wall;
		wallDialogOpen = true;
	}

	function editOpeningWith(opening: SurveyOpening): void {
		editOpening = opening;
		openingDialogOpen = true;
	}

	function editUtilityWith(utility: SurveyUtility): void {
		editUtility = utility;
		utilityDialogOpen = true;
	}

	function editObstacleWith(obstacle: SurveyObstacle): void {
		editObstacle = obstacle;
		obstacleDialogOpen = true;
	}

	function closeDialogs(): void {
		editWall = null;
		editOpening = null;
		editUtility = null;
		editObstacle = null;
	}

	function missingDimensions(row: SurveyRoomTree): string[] {
		const gaps: string[] = [];
		if (row.room.ceilingHeightMm === null) gaps.push('ceiling height');
		if (row.room.roomLengthMm === null) gaps.push('length');
		if (row.room.roomWidthMm === null) gaps.push('width');
		return gaps;
	}

	function handleRoomUpdated(_room: SurveyRoom): void {
		toast.success('Room saved.');
		roomDialogOpen = false;
		void load(id);
	}
</script>

<svelte:head>
	<title
		>{tree?.room.caption ? `${tree.room.caption} · Interio Survey` : 'Room · Interio Survey'}</title
	>
</svelte:head>

{#if !validIds}
	<ForbiddenPage
		variant="not-found"
		title="Room not found."
		description="This room does not exist or is no longer available."
		backHref={resolve('/m/surveys')}
		backLabel="Back to surveys"
	/>
{:else if loading}
	<div class="flex flex-col gap-4" aria-busy="true">
		<h1 class="sr-only">Loading room</h1>
		<Skeleton variant="block" />
		<Skeleton lines={4} />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Room not found."
		description="This room does not exist or is no longer available."
		backHref={resolve(`/m/surveys/${id}/rooms`)}
		backLabel="Back to rooms"
	/>
{:else if error || !detail || !survey || !tree}
	<h1 class="sr-only">Room</h1>
	<EmptyState title="We could not load this room." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={() => void load(id)}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	{@const loadedTree = tree}
	{@const gaps = missingDimensions(loadedTree)}

	<MobileHeader
		title={loadedTree.room.caption}
		subtitle={ROOM_TYPE_LABELS[loadedTree.room.roomType]}
		backHref={resolve(`/m/surveys/${survey.id}/rooms`)}
		backLabel="Rooms"
	>
		{#snippet actions()}
			{#if editable}
				<Button variant="secondary" onclick={() => (roomDialogOpen = true)}>
					{#snippet icon()}
						<Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
					{/snippet}
					Edit room
				</Button>
			{/if}
		{/snippet}
	</MobileHeader>

	<div class="flex flex-col gap-6">
		<section class="rounded-lg border border-hairline bg-canvas p-4">
			<KeyValueGrid
				columns={3}
				items={[
					{
						label: 'Ceiling',
						value:
							loadedTree.room.ceilingHeightMm === null
								? null
								: formatDimension(loadedTree.room.ceilingHeightMm)
					},
					{
						label: 'Length',
						value:
							loadedTree.room.roomLengthMm === null
								? null
								: formatDimension(loadedTree.room.roomLengthMm)
					},
					{
						label: 'Width',
						value:
							loadedTree.room.roomWidthMm === null
								? null
								: formatDimension(loadedTree.room.roomWidthMm)
					}
				]}
			/>
			{#if loadedTree.room.shapeNotes}
				<p class="pt-3 text-callout break-words whitespace-pre-line text-ink-secondary">
					{loadedTree.room.shapeNotes}
				</p>
			{/if}
			{#if gaps.length > 0}
				<p class="flex items-start gap-1 pt-3 text-footnote text-caution-ink">
					<CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
					<span>Missing {gaps.join(', ')}.</span>
				</p>
			{/if}
		</section>

		<section class="flex flex-col gap-2" aria-labelledby="walls-heading">
			<div class="flex items-center justify-between gap-2">
				<h2 id="walls-heading" class="text-title-3 text-ink">Walls</h2>
				{#if editable}
					<Button variant="secondary" onclick={() => (wallDialogOpen = true)}>
						{#snippet icon()}
							<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
						{/snippet}
						Add wall
					</Button>
				{/if}
			</div>
			{#if loadedTree.walls.length === 0}
				<p class="text-callout text-ink-secondary">No walls recorded.</p>
			{:else}
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each loadedTree.walls as wall (wall.id)}
						<li class="flex items-center gap-2 rounded-lg border border-hairline bg-canvas">
							<EntityLink
								href={resolve(`/m/surveys/${survey.id}/rooms/${roomId}/walls/${wall.id}`)}
								class="flex min-h-target flex-1 touch-manipulation flex-col items-stretch gap-0.5 p-3 hover:bg-canvas-grouped"
							>
								<span class="text-callout text-ink">{wall.caption}</span>
								<span class="text-footnote text-ink-secondary tabular-nums">
									{formatDimension(wall.lengthMm)} × {formatDimension(wall.heightMm)}
								</span>
							</EntityLink>
							{#if editable}
								<Button variant="tertiary" onclick={() => editWallWith(wall)}>Edit</Button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="flex flex-col gap-2" aria-labelledby="openings-heading">
			<div class="flex items-center justify-between gap-2">
				<h2 id="openings-heading" class="text-title-3 text-ink">Openings</h2>
				{#if editable}
					<Button variant="secondary" onclick={() => (openingDialogOpen = true)}>
						{#snippet icon()}
							<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
						{/snippet}
						Add opening
					</Button>
				{/if}
			</div>
			{#if loadedTree.openings.length === 0}
				<p class="text-callout text-ink-secondary">No openings recorded.</p>
			{:else}
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each loadedTree.openings as opening (opening.id)}
						<li class="flex items-center gap-2 rounded-lg border border-hairline bg-canvas">
							<EntityLink
								href={resolve(`/m/surveys/${survey.id}/openings/${opening.id}`)}
								class="flex min-h-target flex-1 touch-manipulation flex-col items-stretch gap-0.5 p-3 hover:bg-canvas-grouped"
							>
								<span class="flex flex-wrap items-center gap-2">
									<span class="text-callout text-ink">
										{opening.caption ?? OPENING_TYPE_LABELS[opening.openingType]}
									</span>
									{#if opening.unattached || opening.surveyWallId === null}
										<Badge label="Unattached" tone="warning" />
									{/if}
								</span>
								<span class="text-footnote text-ink-secondary tabular-nums">
									{formatDimension(opening.widthMm)} × {formatDimension(opening.heightMm)}
								</span>
							</EntityLink>
							{#if editable}
								<Button variant="tertiary" onclick={() => editOpeningWith(opening)}>Edit</Button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="flex flex-col gap-2" aria-labelledby="utilities-heading">
			<div class="flex items-center justify-between gap-2">
				<h2 id="utilities-heading" class="text-title-3 text-ink">Utilities</h2>
				{#if editable}
					<Button variant="secondary" onclick={() => (utilityDialogOpen = true)}>
						{#snippet icon()}
							<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
						{/snippet}
						Add utility
					</Button>
				{/if}
			</div>
			{#if loadedTree.utilities.length === 0}
				<p class="text-callout text-ink-secondary">No utilities recorded.</p>
			{:else}
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each loadedTree.utilities as utility (utility.id)}
						<li class="flex items-center gap-2 rounded-lg border border-hairline bg-canvas p-3">
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-callout break-words text-ink">
									{UTILITY_TYPE_LABELS[utility.utilityType]} · {utility.locationDesc}
								</span>
								<span class="text-footnote text-ink-secondary tabular-nums">
									{utility.heightFromFloorMm === null
										? 'Height not recorded'
										: `${formatDimension(utility.heightFromFloorMm)} from the floor`}
								</span>
							</span>
							{#if editable}
								<Button variant="tertiary" onclick={() => editUtilityWith(utility)}>Edit</Button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="flex flex-col gap-2" aria-labelledby="obstacles-heading">
			<div class="flex items-center justify-between gap-2">
				<h2 id="obstacles-heading" class="text-title-3 text-ink">Obstacles</h2>
				{#if editable}
					<Button variant="secondary" onclick={() => (obstacleDialogOpen = true)}>
						{#snippet icon()}
							<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
						{/snippet}
						Add obstacle
					</Button>
				{/if}
			</div>
			{#if loadedTree.obstacles.length === 0}
				<p class="text-callout text-ink-secondary">No obstacles recorded.</p>
			{:else}
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each loadedTree.obstacles as obstacle (obstacle.id)}
						<li class="flex items-center gap-2 rounded-lg border border-hairline bg-canvas p-3">
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-callout break-words text-ink">
									{OBSTACLE_TYPE_LABELS[obstacle.obstacleType]} · {obstacle.description}
								</span>
								{#if obstacle.blocksPositioning}
									<Badge label="Limits positioning" tone="warning" />
								{/if}
							</span>
							{#if editable}
								<Button variant="tertiary" onclick={() => editObstacleWith(obstacle)}>Edit</Button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="flex flex-col gap-2" aria-labelledby="room-measurements-heading">
			<div class="flex items-center justify-between gap-2">
				<h2 id="room-measurements-heading" class="text-title-3 text-ink">Measurements</h2>
				{#if editable}
					<Button variant="secondary" onclick={() => (measurementDialogOpen = true)}>
						{#snippet icon()}
							<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
						{/snippet}
						Add reading
					</Button>
				{/if}
			</div>
			{#if loadedTree.measurements.length === 0}
				<p class="text-callout text-ink-secondary">No measurements in this room yet.</p>
			{:else}
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each loadedTree.measurements as measurement (measurement.id)}
						<li
							class="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-canvas p-3"
						>
							<span class="flex min-w-0 flex-col gap-0.5">
								<span class="flex flex-wrap items-center gap-2">
									<span class="text-callout break-words text-ink">
										{measurement.targetCaption ?? measurement.targetType.replaceAll('_', ' ')}
									</span>
									{#if measurement.isManufacturingCritical}
										<Badge
											label={measurement.verifiedAt
												? 'Critical · verified'
												: 'Critical · unverified'}
											tone={measurement.verifiedAt ? 'success' : 'warning'}
										/>
									{/if}
								</span>
								<span class="text-footnote text-ink-secondary">from {measurement.source}</span>
							</span>
							<span class="text-callout text-ink tabular-nums">
								{formatDimension(measurement.valueMm)}
							</span>
						</li>
					{/each}
				</ul>
				<EntityLink
					href={resolve(`/m/surveys/${survey.id}/measurements`)}
					class="inline-flex min-h-target items-center gap-1 text-footnote text-brand"
				>
					Open all measurements
					<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
				</EntityLink>
			{/if}
		</section>

		<section class="flex flex-col gap-2" aria-labelledby="room-notes-heading">
			<div class="flex items-center justify-between gap-2">
				<h2 id="room-notes-heading" class="text-title-3 text-ink">Notes</h2>
				{#if editable}
					<Button variant="secondary" onclick={() => (noteDialogOpen = true)}>
						{#snippet icon()}
							<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
						{/snippet}
						Add note
					</Button>
				{/if}
			</div>
			{#if roomNotes.length === 0}
				<p class="text-callout text-ink-secondary">No notes for this room.</p>
			{:else}
				<ul class="flex list-none flex-col gap-3 p-0">
					{#each roomNotes as note (note.id)}
						<li class="flex flex-col gap-1 rounded-lg border border-hairline bg-canvas p-3">
							<span class="text-footnote text-ink-secondary">
								{NOTE_CATEGORY_LABELS[note.category]}
								{#if note.revision > 1}· revision {note.revision}{/if}
							</span>
							<p class="text-callout break-words whitespace-pre-line text-ink">{note.body}</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="flex flex-col gap-2" aria-labelledby="room-photos-heading">
			<div class="flex items-center justify-between gap-2">
				<h2 id="room-photos-heading" class="text-title-3 text-ink">Photos</h2>
				<EntityLink
					href={resolve(`/m/surveys/${survey.id}/media`)}
					class="inline-flex min-h-target items-center gap-1 text-footnote text-brand"
				>
					<Images size={16} strokeWidth={1.75} aria-hidden="true" />
					Media
				</EntityLink>
			</div>
			<MediaGrid
				items={photos}
				columns={3}
				emptyTitle="No photos of this room yet."
				emptyDescription="Capture photos from the survey media screen."
			/>
		</section>
	</div>

	<RoomFormDialog
		bind:open={roomDialogOpen}
		surveyId={survey.id}
		room={loadedTree.room}
		onupdated={handleRoomUpdated}
		onclose={() => (roomDialogOpen = false)}
	/>

	<WallFormDialog
		bind:open={wallDialogOpen}
		{roomId}
		wall={editWall}
		oncreated={(wall) => refresh(`${wall.caption} added.`)}
		onupdated={(wall) => refresh(`${wall.caption} saved.`)}
		onclose={() => {
			wallDialogOpen = false;
			closeDialogs();
		}}
	/>

	<OpeningFormDialog
		bind:open={openingDialogOpen}
		{roomId}
		walls={loadedTree.walls}
		opening={editOpening}
		oncreated={() => refresh('Opening added.')}
		onupdated={() => refresh('Opening saved.')}
		onclose={() => {
			openingDialogOpen = false;
			closeDialogs();
		}}
	/>

	<UtilityFormDialog
		bind:open={utilityDialogOpen}
		{roomId}
		walls={loadedTree.walls}
		utility={editUtility}
		oncreated={() => refresh('Utility added.')}
		onupdated={() => refresh('Utility saved.')}
		onclose={() => {
			utilityDialogOpen = false;
			closeDialogs();
		}}
	/>

	<ObstacleFormDialog
		bind:open={obstacleDialogOpen}
		{roomId}
		obstacle={editObstacle}
		oncreated={() => refresh('Obstacle added.')}
		onupdated={() => refresh('Obstacle saved.')}
		onclose={() => {
			obstacleDialogOpen = false;
			closeDialogs();
		}}
	/>

	<MeasurementFormDialog
		bind:open={measurementDialogOpen}
		surveyId={survey.id}
		rooms={detail.rooms}
		defaultRoomId={roomId}
		oncreated={() => refresh('Measurement saved.')}
		onupdated={() => refresh('Measurement saved.')}
		onclose={() => (measurementDialogOpen = false)}
	/>

	<NoteFormDialog
		bind:open={noteDialogOpen}
		surveyId={survey.id}
		rooms={detail.rooms}
		defaultRoomId={roomId}
		oncreated={() => refresh('Note added.')}
		onclose={() => (noteDialogOpen = false)}
	/>

	{#if editable}
		<EntityLink
			href={resolve(`/m/surveys/${survey.id}/measurements`)}
			class="mt-4 flex min-h-target items-center justify-center gap-2 rounded-lg border border-hairline bg-canvas p-3 text-callout text-brand"
		>
			<Ruler size={18} strokeWidth={1.75} aria-hidden="true" />
			Open the measurement list
		</EntityLink>
	{/if}
{/if}
