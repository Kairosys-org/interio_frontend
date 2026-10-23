<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { CircleAlert, ShieldCheck } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { sessionStore } from '$shared/application/session';
	import { PERMISSIONS, hasPermission } from '$shared/domain/permissions';
	import { isUuid } from '$shared/domain/uuid';
	import { formatCount, formatDateTime, formatDimension } from '$shared/lib/format';
	import {
		Badge,
		Breadcrumb,
		Button,
		DataTable,
		EmptyState,
		ForbiddenPage,
		GateBanner,
		Menu,
		PageHeader,
		Progress,
		Skeleton,
		StateChip
	} from '$shared/presentation/ui';
	import { surveysApi } from '../../data/api';
	import type {
		SurveyAction,
		SurveyDetail,
		SurveyMeasurement,
		VerificationMethod
	} from '../../domain/types';
	import { measurementTargetLabel, sourceLabel, verificationMethodLabel } from '../survey-labels';
	import { canRunSurveyAction } from '../transitions';
	import SurveyTransitionDialog from '../components/SurveyTransitionDialog.svelte';
	import VerifyMeasurementDialog from '../components/VerifyMeasurementDialog.svelte';

	/**
	 * `/surveys/[id]/verify` — the G8 verification workstation (phase-2 §3.1).
	 *
	 * Everything critical is on one table: value, source, capture time and
	 * state. Per-row verification records a method; bulk verification applies
	 * one method to every remaining row. The survey-level verify/reject
	 * actions keep their Part 4 §2 role gate.
	 */
	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	interface Column {
		key: string;
		label: string;
		align?: 'start' | 'end';
	}

	const COLUMNS: Column[] = [
		{ key: 'dimension', label: 'Dimension' },
		{ key: 'room', label: 'Room' },
		{ key: 'value', label: 'Value', align: 'end' },
		{ key: 'source', label: 'Source' },
		{ key: 'captured', label: 'Captured' },
		{ key: 'state', label: 'Verification' }
	];

	let detail = $state<SurveyDetail | null>(null);
	let measurements = $state<SurveyMeasurement[]>([]);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let requestSequence = 0;

	let verifyOpen = $state(false);
	let verifyTarget = $state<SurveyMeasurement | null>(null);
	let verifyBulk = $state(false);
	let verifying = $state(false);
	let verifyError = $state<string | null>(null);
	let lastVerifiedId = $state<string | null>(null);

	let transitionOpen = $state(false);
	let transitionAction = $state<SurveyAction | null>(null);
	let transitionSaving = $state(false);
	let transitionError = $state<string | null>(null);

	const user = $derived($sessionStore.user);
	const validId = $derived(isUuid(id));
	const survey = $derived(detail?.survey ?? null);

	const canVerifyRows = $derived(
		Boolean(
			user &&
			hasPermission(user.permissions, PERMISSIONS.SURVEY_APPROVE) &&
			(survey?.status === 'in_progress' || survey?.status === 'submitted')
		)
	);

	const unverified = $derived(
		measurements.filter((measurement) => measurement.verifiedAt === null)
	);
	const verifiedCount = $derived(measurements.length - unverified.length);
	const progress = $derived(
		measurements.length === 0 ? 100 : (verifiedCount / measurements.length) * 100
	);

	const roomLabels = $derived.by(() => {
		const entries: Array<[string, string]> = detail
			? detail.rooms.map((tree) => [tree.room.id, tree.room.caption])
			: [];
		return new Map(entries);
	});

	const gate = $derived({
		id: 'G8',
		title: 'G8 · Manufacturing-critical measurements',
		state: unverified.length === 0 ? ('passed' as const) : ('blocking' as const),
		reasons:
			unverified.length === 0
				? ['Every manufacturing-critical measurement is verified.']
				: unverified.map(
						(measurement) =>
							`${roomLabels.get(measurement.surveyRoomId) ?? 'Room'}: ${measurementTargetLabel(measurement)} · ${formatDimension(measurement.valueMm)}`
					)
	});

	const canVerifySurvey = $derived(
		Boolean(survey && canRunSurveyAction(user, 'verify', survey.status) && unverified.length === 0)
	);
	const canRejectSurvey = $derived(
		Boolean(survey && canRunSurveyAction(user, 'reject', survey.status))
	);

	const breadcrumb = $derived([
		{ label: 'Surveys', href: resolve('/surveys') },
		{
			label: survey?.caption ?? 'Survey',
			href: survey ? resolve(`/surveys/${survey.id}` as Pathname) : undefined
		},
		{ label: 'Verification' }
	]);

	$effect(() => {
		const value = id;
		if (!isUuid(value)) {
			requestSequence += 1;
			loading = false;
			detail = null;
			measurements = [];
			notFound = true;
			error = null;
			return;
		}
		void load(value);
	});

	async function load(value: string): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;
		notFound = false;

		try {
			const [surveyDetail, critical] = await Promise.all([
				surveysApi.get(value),
				surveysApi.criticalMeasurements(value)
			]);
			if (sequence !== requestSequence) return;
			detail = surveyDetail;
			measurements = critical;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			detail = null;
			measurements = [];
			if (isApiError(caught) && caught.isNotFound()) {
				notFound = true;
			} else {
				error = isApiError(caught)
					? caught.message
					: 'We could not load the critical measurements. Try again.';
			}
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	async function refresh(): Promise<void> {
		if (!isUuid(id)) return;
		try {
			detail = await surveysApi.get(id);
			measurements = await surveysApi.criticalMeasurements(id);
		} catch (caught) {
			error = isApiError(caught) ? caught.message : 'We could not refresh this survey. Try again.';
		}
	}

	function retry(): void {
		void load(id);
	}

	function openVerify(measurement: SurveyMeasurement): void {
		verifyTarget = measurement;
		verifyBulk = false;
		verifyError = null;
		verifyOpen = true;
	}

	function openBulk(): void {
		verifyTarget = null;
		verifyBulk = true;
		verifyError = null;
		verifyOpen = true;
	}

	async function handleVerify(method: VerificationMethod, note: string | null): Promise<void> {
		verifying = true;
		verifyError = null;
		try {
			if (verifyBulk) {
				for (const measurement of unverified) {
					await surveysApi.verifyMeasurement(measurement.id, { method, note });
				}
				lastVerifiedId = null;
				toast.success(
					`${unverified.length} ${unverified.length === 1 ? 'measurement' : 'measurements'} verified.`
				);
			} else if (verifyTarget) {
				await surveysApi.verifyMeasurement(verifyTarget.id, { method, note });
				lastVerifiedId = verifyTarget.id;
				toast.success(`${measurementTargetLabel(verifyTarget)} verified.`);
			}
			verifyOpen = false;
			await refresh();
		} catch (caught) {
			verifyError = isApiError(caught)
				? caught.message
				: 'We could not verify this measurement. Try again.';
			throw caught;
		} finally {
			verifying = false;
		}
	}

	function openTransition(action: SurveyAction): void {
		transitionAction = action;
		transitionError = null;
		transitionOpen = true;
	}

	async function handleTransition(reason: string): Promise<void> {
		const current = survey;
		const action = transitionAction;
		if (!current || !action) return;

		transitionSaving = true;
		transitionError = null;
		try {
			await surveysApi.transition(current.id, {
				action,
				reason: reason.length > 0 ? reason : null
			});
			toast.success(action === 'verify' ? 'Survey verified.' : 'Survey rejected.');
			transitionOpen = false;
			await refresh();
			if (action === 'reject') {
				await goto(resolve(`/surveys/${current.id}` as Pathname));
			}
		} catch (caught) {
			transitionError = isApiError(caught)
				? caught.message
				: 'We could not change this survey status. Try again.';
			throw caught;
		} finally {
			transitionSaving = false;
		}
	}

	const menuItems = $derived.by(() => {
		const items: Array<{ label: string; onSelect: () => void; danger?: boolean }> = [];
		if (canRejectSurvey) {
			items.push({
				label: 'Reject survey',
				danger: true,
				onSelect: () => openTransition('reject')
			});
		}
		return items;
	});
</script>

<svelte:head>
	<title>{survey?.caption ? `Verify ${survey.caption} · Interio` : 'Verify survey · Interio'}</title
	>
</svelte:head>

{#snippet cell({ row, column }: { row: SurveyMeasurement; column: Column })}
	{#if column.key === 'dimension'}
		<div class="flex min-w-0 flex-col gap-1">
			<span class="text-callout break-words text-ink">{measurementTargetLabel(row)}</span>
			<span class="inline-flex">
				<Badge
					label={row.verifiedAt ? 'Critical · verified' : 'Critical · unverified'}
					tone={row.verifiedAt ? 'success' : 'warning'}
				/>
			</span>
		</div>
	{:else if column.key === 'room'}
		<span class="break-words">{roomLabels.get(row.surveyRoomId) ?? 'Room'}</span>
	{:else if column.key === 'value'}
		<span class="text-callout text-ink tabular-nums">{formatDimension(row.valueMm)}</span>
	{:else if column.key === 'source'}
		<div class="flex min-w-0 flex-col gap-0.5">
			<span>{sourceLabel(row.source)}</span>
			{#if row.deviceInfo}
				<span class="text-footnote text-ink-tertiary">{row.deviceInfo}</span>
			{/if}
		</div>
	{:else if column.key === 'captured'}
		<time datetime={row.capturedAt}>{formatDateTime(row.capturedAt)}</time>
	{:else if column.key === 'state'}
		{#if row.verifiedAt}
			<div class="flex flex-col gap-0.5">
				<span class="text-footnote text-safe-ink">
					Verified with {verificationMethodLabel(row.verificationMethod)}
				</span>
				<time datetime={row.verifiedAt} class="text-footnote text-ink-tertiary">
					{formatDateTime(row.verifiedAt)}
				</time>
			</div>
		{:else}
			<span class="text-footnote text-caution-ink">Not verified</span>
		{/if}
	{/if}
{/snippet}

{#snippet rowActions(row: SurveyMeasurement)}
	{#if row.verifiedAt === null && canVerifyRows}
		<Button variant="secondary" onclick={() => openVerify(row)}>Verify</Button>
	{:else if row.verifiedAt}
		<span class="inline-flex items-center gap-1 text-footnote text-safe-ink">
			<ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
			Cleared
		</span>
	{:else}
		<span class="text-footnote text-ink-tertiary">Read only</span>
	{/if}
{/snippet}

{#if !validId}
	<ForbiddenPage
		variant="not-found"
		title="Survey not found."
		description="This survey does not exist or is no longer available."
		backHref={resolve('/surveys')}
		backLabel="Back to surveys"
	/>
{:else if loading}
	<div class="flex flex-col gap-6" aria-busy="true" aria-label="Loading verification">
		<h1 class="sr-only">Loading verification</h1>
		<Skeleton lines={1} class="max-w-content-reading" />
		<Skeleton variant="block" />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Survey not found."
		description="This survey does not exist or is no longer available."
		backHref={resolve('/surveys')}
		backLabel="Back to surveys"
	/>
{:else if error || !detail || !survey}
	<h1 class="sr-only">Verification</h1>
	<EmptyState title="We could not load this verification." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={retry}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	<Breadcrumb items={breadcrumb} class="pb-4" />

	<PageHeader
		title={`Verify ${survey.caption}`}
		description={`${detail.project.caption} · ${detail.project.reference}`}
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<StateChip entity="survey" state={survey.status} />
				<Button
					variant="secondary"
					onclick={openBulk}
					disabled={unverified.length === 0 || !canVerifyRows}
				>
					Verify all remaining
				</Button>
				{#if canVerifySurvey}
					<Button variant="primary" onclick={() => openTransition('verify')}>Verify survey</Button>
				{/if}
				{#if menuItems.length > 0}
					<Menu label="More verification actions" items={menuItems} />
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<div class="mt-8 flex flex-col gap-4">
		{#if survey.status !== 'submitted' && survey.status !== 'in_progress'}
			<p
				role="status"
				class="rounded-lg border border-hairline bg-canvas-grouped p-4 text-callout text-ink-secondary"
			>
				This survey is {survey.status.replace('_', ' ')}. Verification starts after submission; the
				measurements below stay read-only.
			</p>
		{/if}

		{#if !hasPermission(user?.permissions ?? [], PERMISSIONS.SURVEY_APPROVE)}
			<p
				role="status"
				class="rounded-lg border border-hairline bg-canvas-grouped p-4 text-callout text-ink-secondary"
			>
				You can review the critical measurements, but only a surveyor or production manager can
				verify them.
			</p>
		{/if}

		<GateBanner gates={[gate]} />

		{#if lastVerifiedId}
			<p class="sr-only" role="status" aria-live="polite">Measurement verified.</p>
		{/if}

		<div class="flex flex-col gap-3 rounded-lg border border-hairline bg-canvas p-4">
			<Progress
				label="Critical measurements verified"
				value={progress}
				valueLabel={`${formatCount(verifiedCount)} of ${formatCount(measurements.length)}`}
			/>
			<p class="text-footnote text-ink-secondary">
				{unverified.length === 0
					? 'Gate G8 is clear. The survey can be verified.'
					: `${formatCount(unverified.length)} ${unverified.length === 1 ? 'measurement still needs' : 'measurements still need'} a recorded method before the survey can be verified.`}
			</p>
		</div>

		<section aria-labelledby="critical-heading" class="flex flex-col gap-3">
			<h2 id="critical-heading" class="text-title-3 text-ink">Critical measurements</h2>
			<p class="max-w-content-reading text-callout text-ink-secondary">
				These are the design-driving dimensions. A verification records how the value was checked,
				who checked it and when; editing a verified survey requires an audited reopen.
			</p>

			{#if measurements.length === 0}
				<EmptyState
					title="No critical measurements."
					description="Nothing on this survey feeds gate G8. Verify the survey when the rest of the checklist passes."
				/>
			{:else}
				<DataTable
					caption="Critical measurements"
					columns={COLUMNS}
					rows={measurements}
					rowKey={(row) => row.id}
					{cell}
					actions={rowActions}
					density="compact"
				/>
			{/if}
		</section>

		<p class="flex items-start gap-2 text-footnote text-ink-secondary">
			<CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
			<span>
				Verifying the survey is final until a production manager reopens it. Reopening clears every
				verification and G8 must pass again.
			</span>
		</p>
	</div>

	<VerifyMeasurementDialog
		bind:open={verifyOpen}
		measurement={verifyTarget}
		bulk={verifyBulk}
		count={unverified.length}
		saving={verifying}
		error={verifyError}
		onconfirm={handleVerify}
	/>

	<SurveyTransitionDialog
		bind:open={transitionOpen}
		action={transitionAction}
		surveyCaption={survey.caption}
		saving={transitionSaving}
		error={transitionError}
		onconfirm={handleTransition}
	/>
{/if}
