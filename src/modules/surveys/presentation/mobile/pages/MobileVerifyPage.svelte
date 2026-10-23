<script lang="ts">
	import { resolve } from '$app/paths';

	import { CircleAlert, ShieldCheck } from '@lucide/svelte';
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
		Skeleton,
		StateChip
	} from '$shared/presentation/ui';
	import { surveysApi } from '$modules/surveys/data/api';
	import type {
		SurveyAction,
		SurveyChecklist,
		SurveyDetail,
		SurveyGateDetail,
		SurveyMeasurement,
		VerificationMethod
	} from '$modules/surveys/domain/types';
	import { measurementTargetLabel, sourceLabel } from '$modules/surveys/presentation/survey-labels';
	import { canRunSurveyAction } from '$modules/surveys/presentation/transitions';
	import SurveyTransitionDialog from '$modules/surveys/presentation/components/SurveyTransitionDialog.svelte';
	import VerifyMeasurementDialog from '$modules/surveys/presentation/components/VerifyMeasurementDialog.svelte';
	import MobileActionBar from '../components/MobileActionBar.svelte';
	import MobileHeader from '../components/MobileHeader.svelte';

	/**
	 * `/m/surveys/[id]/verify` — the G8 workstation on a phone (phase-2 §3.2).
	 *
	 * Only `survey.approve` holders reach this page. Verification is offered
	 * per row and in bulk; the final survey decision stays a separate,
	 * confirmed transition with its own role gate. Every row that blocks
	 * verification is listed by name before the button is enabled.
	 */
	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let detail = $state<SurveyDetail | null>(null);
	let checklist = $state<SurveyChecklist | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let sequence = 0;

	let verifyTarget = $state<SurveyMeasurement | null>(null);
	let verifyOpen = $state(false);
	let bulkOpen = $state(false);
	let verifySaving = $state(false);
	let verifyError = $state<string | null>(null);

	let transitionAction = $state<SurveyAction | null>(null);
	let transitionOpen = $state(false);
	let transitionSaving = $state(false);
	let transitionError = $state<string | null>(null);
	let gateReasons = $state<string[]>([]);

	const user = $derived($sessionStore.user);
	const survey = $derived(detail?.survey ?? null);
	const validId = $derived(isUuid(id));
	const canApprove = $derived(
		Boolean(user && hasPermission(user.permissions, PERMISSIONS.SURVEY_APPROVE))
	);

	const criticalRows = $derived(
		detail
			? detail.rooms.flatMap((tree) =>
					tree.measurements
						.filter((measurement) => measurement.isManufacturingCritical)
						.map((measurement) => ({ measurement, roomCaption: tree.room.caption }))
				)
			: []
	);

	const unverified = $derived(
		criticalRows
			.map((row) => row.measurement)
			.filter((measurement) => measurement.verifiedAt === null)
	);

	const canVerifySurvey = $derived(
		survey !== null &&
			canRunSurveyAction(user, 'verify', survey.status) &&
			Boolean(checklist?.canVerify)
	);
	const canReject = $derived(survey !== null && canRunSurveyAction(user, 'reject', survey.status));
	const canReopen = $derived(survey !== null && canRunSurveyAction(user, 'reopen', survey.status));

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
			const [hub, rows] = await Promise.all([surveysApi.get(value), surveysApi.checklist(value)]);
			if (current !== sequence) return;
			detail = hub;
			checklist = rows;
		} catch (caught) {
			if (current !== sequence) return;
			detail = null;
			checklist = null;
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else
				error = isApiError(caught)
					? caught.message
					: 'We could not load the verification gate. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
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
		if (unverified.length === 0) return;
		verifySaving = true;
		verifyError = null;
		let verified = 0;
		try {
			for (const measurement of unverified) {
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
				: `We verified ${verified} of ${unverified.length}. Try the rest again.`;
			await load(id);
		} finally {
			verifySaving = false;
		}
	}

	function openTransition(action: SurveyAction): void {
		transitionError = null;
		gateReasons = [];
		transitionAction = action;
		transitionOpen = true;
	}

	async function confirmTransition(reason: string): Promise<void> {
		const action = transitionAction;
		if (!action || !survey) return;
		transitionSaving = true;
		transitionError = null;
		gateReasons = [];
		try {
			await surveysApi.transition(survey.id, { action, reason: reason || null });
			transitionOpen = false;
			const messages: Record<SurveyAction, string> = {
				start: 'Survey started.',
				submit: 'Survey submitted.',
				verify: 'Survey verified. Capture is now locked until a reopen.',
				reject: 'Survey rejected. The reason is visible to the surveyor.',
				reopen: 'Survey reopened. Every measurement verification was cleared.',
				cancel: 'Survey cancelled.',
				resume: 'Survey resumed.'
			};
			toast.success(messages[action]);
			await load(id);
		} catch (caught) {
			if (isApiError(caught)) {
				transitionError = caught.message;
				if (caught.code === 'gate_blocked') {
					const details = caught.details as SurveyGateDetail | undefined;
					if (details?.blocking_reasons) gateReasons = details.blocking_reasons;
				}
			} else {
				transitionError = 'We could not change this survey. Try again.';
			}
		} finally {
			transitionSaving = false;
		}
	}

	function retry(): void {
		void load(id);
	}
</script>

<svelte:head>
	<title>{survey?.caption ? `Verify · ${survey.caption}` : 'Verify · Interio Survey'}</title>
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
		<h1 class="sr-only">Loading verification gate</h1>
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
{:else if !canApprove}
	<ForbiddenPage
		variant="forbidden"
		title="Verification needs approval rights."
		description="Only a surveyor or production manager with survey.approve can verify measurements and the survey itself."
		backHref={resolve(`/m/surveys/${id}`)}
		backLabel="Back to the survey"
	/>
{:else if error || !detail || !survey || !checklist}
	<h1 class="sr-only">Verify survey</h1>
	<EmptyState title="We could not load the verification gate." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={retry}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	{@const loadedSurvey = survey}
	{@const loadedChecklist = checklist}

	<MobileHeader
		title="Verify survey"
		subtitle={`${loadedSurvey.caption} · ${formatCount(criticalRows.length)} critical readings`}
		backHref={resolve(`/m/surveys/${loadedSurvey.id}`)}
		backLabel="Survey"
	>
		{#snippet actions()}
			<StateChip entity="survey" state={loadedSurvey.status} />
		{/snippet}
	</MobileHeader>

	<div class="flex flex-col gap-4">
		<section class="flex flex-col gap-2 rounded-lg border border-hairline bg-canvas p-3">
			<h2 class="text-title-3 text-ink">G8 gate</h2>
			{#if unverified.length === 0}
				<p class="flex items-start gap-2 text-footnote text-safe-ink">
					<ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
					<span>
						Every manufacturing-critical measurement is verified. {loadedChecklist.canVerify
							? 'The survey itself can now be verified.'
							: 'The survey still needs to be submitted first.'}
					</span>
				</p>
			{:else}
				<p class="flex items-start gap-2 text-footnote text-caution-ink">
					<CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
					<span>
						{unverified.length}
						{unverified.length === 1
							? 'critical measurement blocks'
							: 'critical measurements block'}
						survey verification. Verify each one with the method that was used.
					</span>
				</p>
				<Button variant="secondary" onclick={startBulk}>
					{#snippet icon()}
						<ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
					{/snippet}
					Verify all {unverified.length}
				</Button>
			{/if}
		</section>

		{#if gateReasons.length > 0}
			<section
				role="alert"
				class="flex flex-col gap-2 rounded-lg border border-critical bg-critical-soft p-3"
			>
				<h2 class="text-subheadline text-critical-ink">The server refused this action</h2>
				<ul class="flex list-none flex-col gap-1 p-0 text-footnote text-critical-ink">
					{#each gateReasons as reason (reason)}
						<li>{reason}</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="flex flex-col gap-2" aria-labelledby="critical-heading">
			<h2 id="critical-heading" class="text-title-3 text-ink">Critical measurements</h2>
			{#if criticalRows.length === 0}
				<p class="text-callout text-ink-secondary">
					No manufacturing-critical measurements in this survey.
				</p>
			{:else}
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each criticalRows as row (row.measurement.id)}
						<li class="flex flex-col gap-2 rounded-lg border border-hairline bg-canvas p-3">
							<div class="flex items-start justify-between gap-2">
								<div class="flex min-w-0 flex-col gap-0.5">
									<span class="text-callout break-words text-ink">
										{measurementTargetLabel(row.measurement)}
									</span>
									<span class="text-footnote break-words text-ink-secondary">
										{row.roomCaption} · {sourceLabel(row.measurement.source)}
									</span>
								</div>
								<span class="shrink-0 text-callout text-ink tabular-nums">
									{formatDimension(row.measurement.valueMm)}
								</span>
							</div>
							<div class="flex flex-wrap items-center justify-between gap-2">
								{#if row.measurement.verifiedAt}
									<Badge label="Verified — no longer blocks G8" tone="success" />
								{:else}
									<Badge label="Unverified — blocks G8" tone="warning" />
								{/if}
								{#if row.measurement.verifiedAt === null}
									<Button variant="secondary" onclick={() => startVerify(row.measurement)}>
										Verify
									</Button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="flex flex-col gap-2" aria-labelledby="decision-heading">
			<h2 id="decision-heading" class="text-title-3 text-ink">Survey decision</h2>
			{#if loadedSurvey.status === 'submitted'}
				<p class="text-footnote text-ink-secondary">
					Verification is final until a production manager reopens the survey.
				</p>
			{:else if loadedSurvey.status === 'verified'}
				<p class="text-footnote text-ink-secondary">
					This survey is verified. Reopening clears every measurement verification.
				</p>
			{:else}
				<p class="text-footnote text-ink-secondary">
					The survey must be submitted before it can be verified.
				</p>
			{/if}
		</section>
	</div>

	{#if canVerifySurvey || canReject || canReopen}
		<MobileActionBar hint="Every decision is recorded in the survey audit trail.">
			{#if canReopen}
				<Button variant="secondary" onclick={() => openTransition('reopen')}>Reopen</Button>
			{/if}
			{#if canReject}
				<Button variant="secondary" onclick={() => openTransition('reject')}>Reject</Button>
			{/if}
			{#if canVerifySurvey}
				<Button variant="primary" onclick={() => openTransition('verify')}>Verify survey</Button>
			{/if}
		</MobileActionBar>
	{/if}

	<VerifyMeasurementDialog
		bind:open={verifyOpen}
		measurement={verifyTarget}
		saving={verifySaving}
		error={verifyError}
		onconfirm={confirmVerify}
	/>

	<VerifyMeasurementDialog
		bind:open={bulkOpen}
		measurement={unverified[0] ?? null}
		bulk
		count={unverified.length}
		saving={verifySaving}
		error={verifyError}
		onconfirm={confirmBulk}
	/>

	<SurveyTransitionDialog
		bind:open={transitionOpen}
		action={transitionAction}
		surveyCaption={loadedSurvey.caption}
		saving={transitionSaving}
		error={transitionError}
		onconfirm={confirmTransition}
	/>
{/if}
