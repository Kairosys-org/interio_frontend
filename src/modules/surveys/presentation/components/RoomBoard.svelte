<script lang="ts">
	import { ArrowRight, TriangleAlert } from '@lucide/svelte';
	import { Badge, EmptyState } from '$shared/presentation/ui';
	import type { SurveyRoomTree } from '../../domain/types';
	import { ROOM_TYPE_LABELS } from '../survey-labels';

	/**
	 * Room cards for the survey detail hub (phase-2 §3.1).
	 *
	 * Each card answers "which room is unfinished?": per-child counts, the
	 * missing-dimension warning and a link to the room's panel. The anchor is a
	 * hash target on the same page, so it is not an app route.
	 */
	interface Props {
		rooms: SurveyRoomTree[];
	}

	let { rooms }: Props = $props();

	function missingDimensions(tree: SurveyRoomTree): string[] {
		const missing: string[] = [];
		if (tree.room.ceilingHeightMm === null) missing.push('ceiling height');
		if (tree.room.roomLengthMm === null) missing.push('length');
		if (tree.room.roomWidthMm === null) missing.push('width');
		return missing;
	}
</script>

{#if rooms.length === 0}
	<EmptyState
		title="No rooms captured yet."
		description="Capture the first room on the mobile app before reviewing the survey here."
	/>
{:else}
	<ul class="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
		{#each rooms as tree (tree.room.id)}
			{@const missing = missingDimensions(tree)}
			{@const link = { href: `#room-${tree.room.id}` }}
			<li class="min-w-0">
				<a
					{...link}
					class="flex h-full min-h-target touch-manipulation flex-col gap-3 rounded-lg border border-hairline bg-canvas p-4 hover:bg-canvas-grouped"
				>
					<span class="flex flex-wrap items-start justify-between gap-2">
						<span class="flex min-w-0 flex-col gap-1">
							<span class="text-headline break-words text-ink">{tree.room.caption}</span>
							<span class="text-footnote text-ink-secondary">
								{ROOM_TYPE_LABELS[tree.room.roomType]}
							</span>
						</span>
						{#if missing.length > 0}
							<Badge label="Dimensions incomplete" tone="warning" />
						{:else}
							<Badge label="Dimensions complete" tone="success" />
						{/if}
					</span>

					<span class="flex flex-wrap gap-x-3 gap-y-1 text-footnote text-ink-secondary">
						<span>{tree.walls.length} {tree.walls.length === 1 ? 'wall' : 'walls'}</span>
						<span
							>{tree.openings.length}
							{tree.openings.length === 1 ? 'opening' : 'openings'}</span
						>
						<span
							>{tree.utilities.length}
							{tree.utilities.length === 1 ? 'utility' : 'utilities'}</span
						>
						<span
							>{tree.obstacles.length}
							{tree.obstacles.length === 1 ? 'obstacle' : 'obstacles'}</span
						>
						<span
							>{tree.measurements.length}
							{tree.measurements.length === 1 ? 'measurement' : 'measurements'}</span
						>
						<span
							>{tree.photoCount}
							{tree.photoCount === 1 ? 'photo' : 'photos'}</span
						>
					</span>

					{#if missing.length > 0}
						<span class="flex items-start gap-1 text-footnote text-caution-ink">
							<TriangleAlert
								size={14}
								strokeWidth={1.75}
								aria-hidden="true"
								class="mt-0.5 shrink-0"
							/>
							<span>Missing {missing.join(', ')}.</span>
						</span>
					{/if}

					<span class="mt-auto inline-flex items-center gap-1 text-footnote text-brand">
						Open room details
						<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
