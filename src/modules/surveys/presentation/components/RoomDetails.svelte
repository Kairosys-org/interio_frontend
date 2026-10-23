<script lang="ts">
	import { Badge, KeyValueGrid } from '$shared/presentation/ui';
	import { formatDimension } from '$shared/lib/format';
	import type { SurveyRoomTree } from '../../domain/types';
	import {
		NOTE_CATEGORY_LABELS,
		OBSTACLE_TYPE_LABELS,
		OPENING_TYPE_LABELS,
		UTILITY_TYPE_LABELS
	} from '../survey-labels';

	/**
	 * The inside of one room (Part 9 §5–§9, §11): dimensions, walls, openings,
	 * utilities, obstacles and notes. Measurements and photos live in their own
	 * sections so each child can be found from the section nav.
	 */
	interface Props {
		tree: SurveyRoomTree;
	}

	let { tree }: Props = $props();

	const room = $derived(tree.room);

	const wallCaption = $derived.by(() => {
		const byId = new Map(tree.walls.map((wall) => [wall.id, wall.caption]));
		return byId;
	});

	const dimensionItems = $derived([
		{
			label: 'Ceiling height',
			value: room.ceilingHeightMm === null ? null : formatDimension(room.ceilingHeightMm)
		},
		{
			label: 'Room length',
			value: room.roomLengthMm === null ? null : formatDimension(room.roomLengthMm)
		},
		{
			label: 'Room width',
			value: room.roomWidthMm === null ? null : formatDimension(room.roomWidthMm)
		}
	]);
</script>

<div class="flex flex-col gap-6">
	<KeyValueGrid items={dimensionItems} columns={3} />

	{#if room.shapeNotes}
		<p class="text-callout break-words whitespace-pre-line text-ink-secondary">{room.shapeNotes}</p>
	{/if}

	<section class="flex flex-col gap-2">
		<h4 class="text-subheadline text-ink">Walls ({tree.walls.length})</h4>
		{#if tree.walls.length === 0}
			<p class="text-callout text-ink-secondary">No walls recorded.</p>
		{:else}
			<ul class="flex list-none flex-col divide-y divide-hairline p-0">
				{#each tree.walls as wall (wall.id)}
					<li class="flex flex-wrap items-baseline justify-between gap-2 py-2">
						<span class="text-callout text-ink">{wall.caption}</span>
						<span class="text-footnote text-ink-secondary tabular-nums">
							{formatDimension(wall.lengthMm)} long · {formatDimension(wall.heightMm)} high
							{#if wall.condition}
								· {wall.condition}
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="flex flex-col gap-2">
		<h4 class="text-subheadline text-ink">Openings ({tree.openings.length})</h4>
		{#if tree.openings.length === 0}
			<p class="text-callout text-ink-secondary">No openings recorded.</p>
		{:else}
			<ul class="flex list-none flex-col divide-y divide-hairline p-0">
				{#each tree.openings as opening (opening.id)}
					<li class="flex flex-col gap-1 py-2">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<span class="flex flex-wrap items-center gap-2">
								<span class="text-callout text-ink">
									{opening.caption ?? OPENING_TYPE_LABELS[opening.openingType]}
								</span>
								<Badge label={OPENING_TYPE_LABELS[opening.openingType]} tone="neutral" />
								{#if opening.unattached || opening.surveyWallId === null}
									<Badge label="Not linked to a wall" tone="warning" />
								{/if}
							</span>
							<span class="text-footnote text-ink-secondary tabular-nums">
								{formatDimension(opening.widthMm)} × {formatDimension(opening.heightMm)}
							</span>
						</div>
						<p class="text-footnote text-ink-secondary">
							{#if opening.surveyWallId}
								{wallCaption.get(opening.surveyWallId) ?? 'Wall'}
							{:else}
								Wall not recorded
							{/if}
							{#if opening.sillHeightMm !== null}
								· sill {formatDimension(opening.sillHeightMm)}
							{/if}
							{#if opening.swingDirection}
								· swing {opening.swingDirection}
							{/if}
						</p>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="flex flex-col gap-2">
		<h4 class="text-subheadline text-ink">Utilities ({tree.utilities.length})</h4>
		{#if tree.utilities.length === 0}
			<p class="text-callout text-ink-secondary">No utilities recorded.</p>
		{:else}
			<ul class="flex list-none flex-col divide-y divide-hairline p-0">
				{#each tree.utilities as utility (utility.id)}
					<li class="flex flex-wrap items-baseline justify-between gap-2 py-2">
						<span class="text-callout text-ink">
							{UTILITY_TYPE_LABELS[utility.utilityType]} · {utility.locationDesc}
						</span>
						<span class="text-footnote text-ink-secondary tabular-nums">
							{#if utility.heightFromFloorMm !== null}
								{formatDimension(utility.heightFromFloorMm)} from the floor
							{:else}
								Height not recorded
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="flex flex-col gap-2">
		<h4 class="text-subheadline text-ink">Obstacles ({tree.obstacles.length})</h4>
		{#if tree.obstacles.length === 0}
			<p class="text-callout text-ink-secondary">No obstacles recorded.</p>
		{:else}
			<ul class="flex list-none flex-col divide-y divide-hairline p-0">
				{#each tree.obstacles as obstacle (obstacle.id)}
					<li class="flex flex-col gap-1 py-2">
						<span class="flex flex-wrap items-center gap-2">
							<span class="text-callout text-ink">
								{OBSTACLE_TYPE_LABELS[obstacle.obstacleType]} · {obstacle.description}
							</span>
							{#if obstacle.blocksPositioning}
								<Badge label="Limits positioning" tone="warning" />
							{/if}
						</span>
						{#if obstacle.positionDesc}
							<p class="text-footnote text-ink-secondary">{obstacle.positionDesc}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="flex flex-col gap-2">
		<h4 class="text-subheadline text-ink">Room notes ({tree.notes.length})</h4>
		{#if tree.notes.length === 0}
			<p class="text-callout text-ink-secondary">No notes for this room.</p>
		{:else}
			<ul class="flex list-none flex-col gap-3 p-0">
				{#each tree.notes as note (note.id)}
					<li class="flex flex-col gap-1">
						<span class="text-footnote text-ink-secondary">
							{NOTE_CATEGORY_LABELS[note.category]}
							{#if note.revision > 1}
								· revision {note.revision}
							{/if}
						</span>
						<p class="text-callout break-words whitespace-pre-line text-ink">{note.body}</p>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
