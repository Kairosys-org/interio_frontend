<script lang="ts">
	import { resolve } from '$app/paths';

	import { CircleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { OpeningType, SurveyDetail, SwingDirection } from '$modules/surveys/domain/types';
	import { OPENING_TYPES, SWING_DIRECTIONS } from '$modules/surveys/domain/types';
	import { openingFormSchema } from '$modules/surveys/domain/validations';
	import {
		openingFitsWallReason,
		requiresSill,
		requiresSwing
	} from '$modules/surveys/domain/rules';
	import { fieldErrorsFrom } from '$modules/surveys/presentation/field-errors';
	import { OPENING_TYPE_LABELS } from '$modules/surveys/presentation/survey-labels';
	import { isUuid } from '$shared/domain/uuid';
	import { formatDimension } from '$shared/lib/format';
	import {
		Badge,
		Button,
		DimensionField,
		EmptyState,
		ForbiddenPage,
		Input,
		Select,
		Skeleton,
		Textarea
	} from '$shared/presentation/ui';
	import MobileHeader from '../components/MobileHeader.svelte';
	import MobileActionBar from '../components/MobileActionBar.svelte';

	interface Props {
		id: string;
		openingId: string;
	}

	let { id, openingId }: Props = $props();

	let detail = $state<SurveyDetail | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let sequence = 0;

	let openingType = $state<OpeningType>('window');
	let caption = $state('');
	let width = $state('');
	let height = $state('');
	let sill = $state('');
	let swing = $state<SwingDirection>('none');
	let reveal = $state('');
	let notes = $state('');
	let wallId = $state('');
	let errors = $state<Record<string, string>>({});
	let serverError = $state('');
	let saving = $state(false);

	const validIds = $derived(isUuid(id) && isUuid(openingId));
	const survey = $derived(detail?.survey ?? null);

	const located = $derived.by(() => {
		if (!detail) return null;
		for (const tree of detail.rooms) {
			const opening = tree.openings.find((row) => row.id === openingId);
			if (opening) return { tree, opening };
		}
		return null;
	});

	const tree = $derived(located?.tree ?? null);
	const opening = $derived(located?.opening ?? null);
	const wall = $derived(tree?.walls.find((row) => row.id === opening?.surveyWallId) ?? null);
	const editable = $derived(
		survey !== null &&
			(survey.status === 'draft' || survey.status === 'in_progress' || survey.status === 'rejected')
	);

	const TYPE_OPTIONS = OPENING_TYPES.map((type) => ({
		value: type,
		label: OPENING_TYPE_LABELS[type]
	}));
	const SWING_OPTIONS = SWING_DIRECTIONS.map((direction) => ({
		value: direction,
		label:
			direction === 'none' ? 'No swing' : direction.charAt(0).toUpperCase() + direction.slice(1)
	}));
	const WALL_OPTIONS = $derived([
		{ value: '', label: 'Not linked to a wall yet' },
		...(tree?.walls.map((row) => ({ value: row.id, label: row.caption })) ?? [])
	]);

	const wallWarning = $derived.by(() => {
		if (!wall || !opening) return null;
		return openingFitsWallReason(
			{ widthMm: opening.widthMm, heightMm: opening.heightMm },
			{ lengthMm: wall.lengthMm, heightMm: wall.heightMm }
		);
	});

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
		if (!opening) return;
		openingType = opening.openingType;
		caption = opening.caption ?? '';
		width = String(opening.widthMm);
		height = String(opening.heightMm);
		sill = opening.sillHeightMm === null ? '' : String(opening.sillHeightMm);
		swing = opening.swingDirection ?? 'none';
		reveal = opening.revealDepthMm === null ? '' : String(opening.revealDepthMm);
		notes = opening.notes ?? '';
		wallId = opening.surveyWallId ?? '';
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
			const found = hub.rooms.some((row) => row.openings.some((child) => child.id === openingId));
			if (!found) notFound = true;
		} catch (caught) {
			if (current !== sequence) return;
			detail = null;
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else
				error = isApiError(caught) ? caught.message : 'We could not load this opening. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}

	async function save(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!opening) return;
		serverError = '';

		const parsed = openingFormSchema.safeParse({
			openingType,
			caption,
			widthMm: width,
			heightMm: height,
			sillHeightMm: sill,
			swingDirection: requiresSwing(openingType) ? (swing === 'none' ? '' : swing) : swing,
			revealDepthMm: reveal,
			notes,
			surveyWallId: wallId
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		saving = true;
		try {
			await surveysApi.updateOpening(opening.id, parsed.data);
			toast.success('Opening saved.');
			await load(id);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this opening. Try again.';
			}
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title
		>{opening?.caption ? `${opening.caption} · Interio Survey` : 'Opening · Interio Survey'}</title
	>
</svelte:head>

{#if !validIds}
	<ForbiddenPage
		variant="not-found"
		title="Opening not found."
		description="This opening does not exist or is no longer available."
		backHref={resolve('/m/surveys')}
		backLabel="Back to surveys"
	/>
{:else if loading}
	<div class="flex flex-col gap-4" aria-busy="true">
		<h1 class="sr-only">Loading opening</h1>
		<Skeleton variant="block" />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Opening not found."
		description="This opening does not exist or is no longer available."
		backHref={resolve(`/m/surveys/${id}/rooms`)}
		backLabel="Back to rooms"
	/>
{:else if error || !detail || !survey || !tree || !opening}
	<h1 class="sr-only">Opening</h1>
	<EmptyState title="We could not load this opening." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={() => void load(id)}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	{@const loadedOpening = opening}

	<MobileHeader
		title={loadedOpening.caption ?? OPENING_TYPE_LABELS[loadedOpening.openingType]}
		subtitle={`${tree.room.caption} · ${formatDimension(loadedOpening.widthMm)} × ${formatDimension(loadedOpening.heightMm)}`}
		backHref={resolve(`/m/surveys/${survey.id}/rooms/${tree.room.id}`)}
		backLabel="Room"
	>
		{#snippet actions()}
			<Badge label={OPENING_TYPE_LABELS[loadedOpening.openingType]} tone="neutral" />
		{/snippet}
	</MobileHeader>

	<div class="flex flex-col gap-4">
		{#if loadedOpening.unattached || loadedOpening.surveyWallId === null}
			<p
				class="flex items-start gap-2 rounded-lg border border-caution bg-caution-soft p-3 text-footnote text-caution-ink"
			>
				<CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>
					This opening is not linked to a wall. Choose the wall below, or confirm it needs one
					recording first.
				</span>
			</p>
		{:else if wall}
			<p class="text-footnote text-ink-secondary">
				In <a
					{...{
						href: resolve(`/m/surveys/${survey.id}/rooms/${tree.room.id}/walls/${wall.id}`)
					}}
					class="inline-flex min-h-target items-center text-brand">{wall.caption}</a
				>.
			</p>
			{#if wallWarning}
				<p
					role="alert"
					class="flex items-start gap-2 rounded-lg border border-critical bg-critical-soft p-3 text-footnote text-critical-ink"
				>
					<CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
					<span>{wallWarning}</span>
				</p>
			{/if}
		{/if}

		{#if editable}
			<form
				id="opening-edit-form"
				class="flex flex-col gap-4"
				onsubmit={save}
				novalidate
				aria-label="Edit opening"
			>
				<Select
					label="Opening type"
					required
					value={openingType}
					options={TYPE_OPTIONS}
					error={errors.openingType}
					disabled={saving}
					onchange={(event) =>
						(openingType = (event.currentTarget as HTMLSelectElement).value as OpeningType)}
				/>
				<Input
					label="Caption"
					bind:value={caption}
					maxlength={200}
					error={errors.caption}
					disabled={saving}
				/>
				<DimensionField
					label="Width"
					required
					bind:value={width}
					min={1}
					max={10000}
					error={errors.widthMm}
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
				{#if requiresSill(openingType)}
					<DimensionField
						label="Sill height"
						required
						bind:value={sill}
						min={0}
						max={5000}
						error={errors.sillHeightMm}
						disabled={saving}
					/>
				{/if}
				{#if requiresSwing(openingType)}
					<Select
						label="Swing direction"
						required
						value={swing}
						options={SWING_OPTIONS}
						error={errors.swingDirection}
						disabled={saving}
						onchange={(event) =>
							(swing = (event.currentTarget as HTMLSelectElement).value as SwingDirection)}
					/>
				{/if}
				<DimensionField
					label="Reveal depth"
					bind:value={reveal}
					min={1}
					max={1000}
					error={errors.revealDepthMm}
					disabled={saving}
				/>
				<Select
					label="Wall"
					value={wallId}
					options={WALL_OPTIONS}
					error={errors.surveyWallId}
					disabled={saving}
					onchange={(event) => (wallId = (event.currentTarget as HTMLSelectElement).value)}
				/>
				<Textarea
					label="Notes"
					bind:value={notes}
					rows={3}
					maxlength={2000}
					error={errors.notes}
					disabled={saving}
				/>

				{#if serverError}
					<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
						<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
						<span>{serverError}</span>
					</p>
				{/if}
			</form>

			<MobileActionBar hint="The opening can never be larger than the wall it is cut into.">
				<Button
					variant="primary"
					type="submit"
					form="opening-edit-form"
					loading={saving}
					loadingLabel="Saving…"
				>
					Save opening
				</Button>
			</MobileActionBar>
		{:else}
			<p
				class="rounded-lg border border-hairline bg-canvas-grouped p-3 text-footnote text-ink-secondary"
			>
				This survey is {survey.status}, so the opening is read-only.
			</p>
		{/if}
	</div>
{/if}
