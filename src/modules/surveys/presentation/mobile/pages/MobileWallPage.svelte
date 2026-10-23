<script lang="ts">
	import { resolve } from '$app/paths';

	import { CircleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { SurveyDetail } from '$modules/surveys/domain/types';
	import { wallFormSchema } from '$modules/surveys/domain/validations';
	import { openingFitsWallReason } from '$modules/surveys/domain/rules';
	import { fieldErrorsFrom } from '$modules/surveys/presentation/field-errors';
	import { OPENING_TYPE_LABELS } from '$modules/surveys/presentation/survey-labels';
	import { isUuid } from '$shared/domain/uuid';
	import { formatDimension } from '$shared/lib/format';
	import {
		Button,
		DimensionField,
		EmptyState,
		ForbiddenPage,
		Input,
		Skeleton,
		Textarea
	} from '$shared/presentation/ui';
	import MobileHeader from '../components/MobileHeader.svelte';
	import MobileActionBar from '../components/MobileActionBar.svelte';

	interface Props {
		id: string;
		roomId: string;
		wallId: string;
	}

	let { id, roomId, wallId }: Props = $props();

	let detail = $state<SurveyDetail | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let sequence = 0;

	let caption = $state('');
	let length = $state('');
	let height = $state('');
	let condition = $state('');
	let errors = $state<Record<string, string>>({});
	let serverError = $state('');
	let saving = $state(false);

	const validIds = $derived(isUuid(id) && isUuid(roomId) && isUuid(wallId));
	const survey = $derived(detail?.survey ?? null);
	const tree = $derived(detail?.rooms.find((row) => row.room.id === roomId) ?? null);
	const wall = $derived(tree?.walls.find((row) => row.id === wallId) ?? null);
	const linkedOpenings = $derived(
		tree?.openings.filter((opening) => opening.surveyWallId === wallId) ?? []
	);
	const editable = $derived(
		survey !== null &&
			(survey.status === 'draft' || survey.status === 'in_progress' || survey.status === 'rejected')
	);

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

	$effect(() => {
		if (!wall) return;
		caption = wall.caption;
		length = String(wall.lengthMm);
		height = String(wall.heightMm);
		condition = wall.condition ?? '';
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
			const room = hub.rooms.find((row) => row.room.id === roomId);
			if (!room || !room.walls.some((row) => row.id === wallId)) notFound = true;
		} catch (caught) {
			if (current !== sequence) return;
			detail = null;
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else error = isApiError(caught) ? caught.message : 'We could not load this wall. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}

	async function save(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!wall) return;
		serverError = '';

		const parsed = wallFormSchema.safeParse({
			caption,
			lengthMm: length,
			heightMm: height,
			condition
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		saving = true;
		try {
			await surveysApi.updateWall(wall.id, parsed.data);
			toast.success('Wall saved.');
			await load(id);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this wall. Try again.';
			}
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{wall?.caption ? `${wall.caption} · Interio Survey` : 'Wall · Interio Survey'}</title>
</svelte:head>

{#if !validIds}
	<ForbiddenPage
		variant="not-found"
		title="Wall not found."
		description="This wall does not exist or is no longer available."
		backHref={resolve(`/m/surveys/${id}/rooms/${roomId}`)}
		backLabel="Back to room"
	/>
{:else if loading}
	<div class="flex flex-col gap-4" aria-busy="true">
		<h1 class="sr-only">Loading wall</h1>
		<Skeleton variant="block" />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Wall not found."
		description="This wall does not exist or is no longer available."
		backHref={resolve(`/m/surveys/${id}/rooms/${roomId}`)}
		backLabel="Back to room"
	/>
{:else if error || !detail || !survey || !tree || !wall}
	<h1 class="sr-only">Wall</h1>
	<EmptyState title="We could not load this wall." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={() => void load(id)}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	{@const loadedWall = wall}

	<MobileHeader
		title={loadedWall.caption}
		subtitle={`${tree.room.caption} · ${formatDimension(loadedWall.lengthMm)} × ${formatDimension(loadedWall.heightMm)}`}
		backHref={resolve(`/m/surveys/${survey.id}/rooms/${roomId}`)}
		backLabel="Room"
	/>

	<div class="flex flex-col gap-6">
		{#if linkedOpenings.length === 0}
			<p
				class="rounded-lg border border-hairline bg-canvas-grouped p-3 text-footnote text-ink-secondary"
			>
				No openings are linked to this wall. An unattached opening shows on the room until it is
				linked.
			</p>
		{:else}
			<section class="flex flex-col gap-2" aria-labelledby="linked-openings-heading">
				<h2 id="linked-openings-heading" class="text-title-3 text-ink">Openings in this wall</h2>
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each linkedOpenings as opening (opening.id)}
						{@const reason = openingFitsWallReason(
							{ widthMm: opening.widthMm, heightMm: opening.heightMm },
							{ lengthMm: loadedWall.lengthMm, heightMm: loadedWall.heightMm }
						)}
						<li class="flex flex-col gap-1 rounded-lg border border-hairline bg-canvas p-3">
							<span class="flex flex-wrap items-center justify-between gap-2">
								<span class="text-callout break-words text-ink">
									{opening.caption ?? OPENING_TYPE_LABELS[opening.openingType]}
								</span>
								<span class="text-footnote text-ink-secondary tabular-nums">
									{formatDimension(opening.widthMm)} × {formatDimension(opening.heightMm)}
								</span>
							</span>
							{#if reason}
								<p class="flex items-start gap-1 text-footnote text-critical-ink">
									<CircleAlert
										size={14}
										strokeWidth={1.75}
										aria-hidden="true"
										class="mt-0.5 shrink-0"
									/>
									<span>{reason}</span>
								</p>
							{/if}
							<a
								{...{ href: resolve(`/m/surveys/${survey.id}/openings/${opening.id}`) }}
								class="inline-flex min-h-target items-center text-footnote text-brand"
							>
								Open opening
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if editable}
			<form
				id="wall-edit-form"
				class="flex flex-col gap-4"
				onsubmit={save}
				novalidate
				aria-label="Edit wall"
			>
				<h2 class="text-title-3 text-ink">Wall details</h2>
				<Input
					label="Caption"
					required
					bind:value={caption}
					maxlength={200}
					error={errors.caption}
					disabled={saving}
				/>
				<DimensionField
					label="Length"
					required
					bind:value={length}
					min={1}
					max={30000}
					error={errors.lengthMm}
					disabled={saving}
				/>
				<DimensionField
					label="Height"
					required
					bind:value={height}
					min={1}
					max={10000}
					error={errors.heightMm}
					disabled={saving}
				/>
				<Textarea
					label="Condition"
					bind:value={condition}
					rows={3}
					maxlength={2000}
					error={errors.condition}
					disabled={saving}
				/>

				{#if serverError}
					<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
						<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
						<span>{serverError}</span>
					</p>
				{/if}
			</form>

			<MobileActionBar
				hint="Changing a wall does not move its openings; re-check them after saving."
			>
				<Button
					variant="primary"
					type="submit"
					form="wall-edit-form"
					loading={saving}
					loadingLabel="Saving…"
				>
					Save wall
				</Button>
			</MobileActionBar>
		{:else}
			<p
				class="rounded-lg border border-hairline bg-canvas-grouped p-3 text-footnote text-ink-secondary"
			>
				This survey is {survey.status}, so the wall is read-only.
			</p>
		{/if}
	</div>
{/if}
