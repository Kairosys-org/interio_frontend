<script lang="ts">
	import { resolve } from '$app/paths';

	import { CircleAlert, Pencil, Plus, ShieldCheck } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { sessionStore } from '$shared/application/session';
	import { PERMISSIONS, hasPermission } from '$shared/domain/permissions';
	import { isUuid } from '$shared/domain/uuid';
	import { formatCount, formatDimension } from '$shared/lib/format';
	import {
		Badge,
		Button,
		EmptyState,
		ForbiddenPage,
		Select,
		Skeleton,
		StateChip
	} from '$shared/presentation/ui';
	import { surveysApi } from '$modules/surveys/data/api';
	import type {
		SurveyDetail,
		SurveyMeasurement,
		VerificationMethod
	} from '$modules/surveys/domain/types';
	import {
		measurementTargetLabel,
		sourceLabel,
		verificationMethodLabel
	} from '$modules/surveys/presentation/survey-labels';
	import VerifyMeasurementDialog from '$modules/surveys/presentation/components/VerifyMeasurementDialog.svelte';
	import MobileActionBar from '../components/MobileActionBar.svelte';
	import MobileHeader from '../components/MobileHeader.svelte';
	import MeasurementFormDialog from '../components/MeasurementFormDialog.svelte';

	/**
	 * `/m/surveys/[id]/measurements` — the core capture screen (phase-2 §3.2).
	 *
	 * Every row states its kind, value, provenance and G8 state in words.
	 * Verification is inline when the signed-in user may approve; the bulk
	 * action records one method per row and never hides which rows it touched.
	 */
	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	type Filter = 'all' | 'critical' | 'unverified';

	const FILTER_OPTIONS = [
		{ value: 'all', label: 'Every reading' },
		{ value: 'critical', label: 'Manufacturing-critical' },
		{ value: 'unverified', label: 'Waiting for verification' }
	];

	let detail = $state<SurveyDetail | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let sequence = 0;

	let filter = $state<Filter>('all');
	let formOpen = $state(false);
	let editMeasurement = $state<SurveyMeasurement | null>(null);
	let formSequence = $state(0);

	let verifyTarget = $state<SurveyMeasurement | null>(null);
	let verifyOpen = $state(false);
	let bulkOpen = $state(false);
	let verifySaving = $state(false);
	let verifyError = $state<string | null>(null);

	const user = $derived($sessionStore.user);
	const survey = $derived(detail?.survey ?? null);
	const validId = $derived(isUuid(id));
	const canApprove = $derived(
		Boolean(user && hasPermission(user.permissions, PERMISSIONS.SURVEY_APPROVE))
	);
	const editable = $derived(
		survey !== null &&
			(survey.status === 'draft' || survey.status === 'in_progress' || survey.status === 'rejected')
	);

	const rows = $derived.by(() => {
		if (!detail) return [];
		return detail.rooms.flatMap((tree) =>
			tree.measurements.map((measurement) => ({
				measurement,
				roomCaption: tree.room.caption
			}))
		);
	});

	const filtered = $derived(
		rows.filter(({ measurement }) => {
			if (filter === 'critical') return measurement.isManufacturingCritical;
			if (filter === 'unverified') {
				return measurement.isManufacturingCritical && measurement.verifiedAt === null;
			}
			return true;
		})
	);

	const criticalUnverified = $derived(
		rows
			.map(({ measurement }) => measurement)
			.filter(
				(measurement) => measurement.isManufacturingCritical && measurement.verifiedAt === null
			)
	);

	$effect(() => {
		const value = id;
		if (!isUuid(value)) {
			sequence += 1;
			loading = false;
			detail = null;
			notFound = true;
			error = null;
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
				error = isApiError(caught)
					? caught.message
					: 'We could not load these measurements. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}

	function startCreate(): void {
		formSequence += 1;
		editMeasurement = null;
		formOpen = true;
	}

	function startEdit(measurement: SurveyMeasurement): void {
		formSequence += 1;
		editMeasurement = measurement;
		formOpen = true;
	}

	function onSaved(): void {
		formOpen = false;
		toast.success(editMeasurement ? 'Measurement saved.' : 'Measurement captured.');
		void load(id);
	}

	function startVerify(measurement: SurveyMeasurement): void {
		verifyError = null;
		verifyTarget = measurement;
		verifyOpen = true;
	}

	function startBulk(): void {
		verifyError = null;
		bulkOpen = true;
	}

	async function confirmVerify(method: VerificationMethod, note: string | null): Promise<void> {
		const target = verifyTarget;
		if (!target) return;
		verifySaving = true;
		verifyError = null;
		try {
			await surveysApi.verifyMeasurement(target.id, { method, note });
			verifyOpen = false;
			toast.success('Measurement verified. It no longer blocks G8.');
			await load(id);
		} catch (caught) {
			verifyError = isApiError(caught)
				? caught.message
				: 'We could not verify this measurement. Try again.';
		} finally {
			verifySaving = false;
		}
	}

	async function confirmBulk(method: VerificationMethod, note: string | null): Promise<void> {
		if (criticalUnverified.length === 0) return;
		verifySaving = true;
		verifyError = null;
		let verified = 0;
		try {
			for (const measurement of criticalUnverified) {
				await surveysApi.verifyMeasurement(measurement.id, { method, note });
				verified += 1;
			}
			bulkOpen = false;
			toast.success(
				`${verified} critical ${verified === 1 ? 'measurement' : 'measurements'} verified.`
			);
			await load(id);
		} catch (caught) {
			verifyError = isApiError(caught)
				? caught.message
				: `We verified ${verified} of ${criticalUnverified.length}. Try the rest again.`;
			await load(id);
		} finally {
			verifySaving = false;
		}
	}

	function retry(): void {
		void load(id);
	}
</script>

<svelte:head>
	<title
		>{survey?.caption ? `Measurements · ${survey.caption}` : 'Measurements · Interio Survey'}</title
	>
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
		<h1 class="sr-only">Loading measurements</h1>
		<Skeleton variant="block" />
		<Skeleton lines={5} />
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
	<h1 class="sr-only">Measurements</h1>
	<EmptyState title="We could not load these measurements." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={retry}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	{@const loadedSurvey = survey}

	<MobileHeader
		title="Measurements"
		subtitle={`${loadedSurvey.caption} · ${formatCount(rows.length)} readings`}
		backHref={resolve(`/m/surveys/${loadedSurvey.id}`)}
		backLabel="Survey"
	>
		{#snippet actions()}
			<StateChip entity="survey" state={loadedSurvey.status} />
		{/snippet}
	</MobileHeader>

	<div class="flex flex-col gap-4">
		{#if criticalUnverified.length > 0}
			<section
				role="status"
				class="flex flex-col gap-2 rounded-lg border border-caution bg-caution-soft p-3"
			>
				<p class="flex items-start gap-2 text-footnote text-caution-ink">
					<CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
					<span>
						{criticalUnverified.length}
						{criticalUnverified.length === 1
							? 'critical measurement is'
							: 'critical measurements are'}
						still unverified. G8 blocks survey verification until every one is checked.
					</span>
				</p>
				{#if canApprove}
					<Button variant="secondary" onclick={startBulk}>
						{#snippet icon()}
							<ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
						{/snippet}
						Verify all {criticalUnverified.length}
					</Button>
				{/if}
			</section>
		{/if}

		<div class="flex items-end gap-2">
			<Select
				label="Show"
				value={filter}
				options={FILTER_OPTIONS}
				onchange={(event) => (filter = (event.currentTarget as HTMLSelectElement).value as Filter)}
				class="flex-1"
			/>
			{#if editable}
				<Button variant="primary" onclick={startCreate}>
					{#snippet icon()}
						<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
					{/snippet}
					Add reading
				</Button>
			{/if}
		</div>

		{#if filtered.length === 0}
			<EmptyState
				title={rows.length === 0
					? 'No measurements captured yet.'
					: 'No readings match this filter.'}
				description={rows.length === 0
					? 'Capture the first reading, then link it to the room, wall or opening it belongs to.'
					: 'Choose Every reading to see the rest of the survey.'}
			>
				{#snippet action()}
					{#if rows.length === 0 && editable}
						<Button variant="primary" onclick={startCreate}>Add reading</Button>
					{/if}
				{/snippet}
			</EmptyState>
		{:else}
			<ul class="flex list-none flex-col gap-2 p-0">
				{#each filtered as row (row.measurement.id)}
					{@const measurement = row.measurement}
					<li
						class="flex flex-col gap-2 rounded-lg border border-hairline bg-canvas p-3"
						data-testid="mobile-measurement-row"
					>
						<div class="flex items-start justify-between gap-2">
							<div class="flex min-w-0 flex-col gap-0.5">
								<span class="text-callout break-words text-ink">
									{measurementTargetLabel(measurement)}
								</span>
								<span class="text-footnote break-words text-ink-secondary">
									{row.roomCaption} · {sourceLabel(measurement.source)}
									{#if measurement.deviceInfo}
										({measurement.deviceInfo})
									{/if}
								</span>
							</div>
							<span class="shrink-0 text-callout text-ink tabular-nums">
								{formatDimension(measurement.valueMm)}
							</span>
						</div>

						<div class="flex flex-wrap items-center gap-2">
							{#if measurement.isManufacturingCritical}
								<Badge
									label={measurement.verifiedAt
										? `Critical · verified with ${verificationMethodLabel(measurement.verificationMethod)}`
										: 'Critical · unverified'}
									tone={measurement.verifiedAt ? 'success' : 'warning'}
								/>
							{:else}
								<Badge label="Standard reading" tone="neutral" />
							{/if}
							{#if measurement.surveyWallId}
								<Badge label="Linked to a wall" tone="neutral" />
							{/if}
							{#if measurement.surveyOpeningId}
								<Badge label="Linked to an opening" tone="neutral" />
							{/if}
						</div>

						{#if measurement.isManufacturingCritical && measurement.verifiedAt === null}
							<p class="text-footnote text-caution-ink">
								Needs verification before this survey can be verified.
							</p>
						{/if}

						{#if editable || (canApprove && measurement.isManufacturingCritical && measurement.verifiedAt === null)}
							<div class="flex flex-wrap items-center justify-end gap-2 pt-1">
								{#if editable}
									<Button variant="tertiary" onclick={() => startEdit(measurement)}>
										{#snippet icon()}
											<Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
										{/snippet}
										Edit
									</Button>
								{/if}
								{#if canApprove && measurement.isManufacturingCritical && measurement.verifiedAt === null}
									<Button variant="secondary" onclick={() => startVerify(measurement)}>
										Verify
									</Button>
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if editable}
		<MobileActionBar
			hint="Every reading is saved on its own, so a dropped connection never loses the last one."
		>
			<Button variant="primary" fullWidth onclick={startCreate}>
				{#snippet icon()}
					<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
				{/snippet}
				Capture a reading
			</Button>
		</MobileActionBar>
	{/if}

	{#key formSequence}
		<MeasurementFormDialog
			bind:open={formOpen}
			surveyId={loadedSurvey.id}
			rooms={detail.rooms}
			measurement={editMeasurement}
			oncreated={onSaved}
			onupdated={onSaved}
			onclose={() => (formOpen = false)}
		/>
	{/key}

	<VerifyMeasurementDialog
		bind:open={verifyOpen}
		measurement={verifyTarget}
		saving={verifySaving}
		error={verifyError}
		onconfirm={confirmVerify}
	/>

	<VerifyMeasurementDialog
		bind:open={bulkOpen}
		measurement={criticalUnverified[0] ?? null}
		bulk
		count={criticalUnverified.length}
		saving={verifySaving}
		error={verifyError}
		onconfirm={confirmBulk}
	/>
{/if}
