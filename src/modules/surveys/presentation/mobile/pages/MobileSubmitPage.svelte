<script lang="ts">
	import { resolve } from '$app/paths';

	import { CircleAlert, CircleCheck, CircleDot, MinusCircle } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { sessionStore } from '$shared/application/session';
	import { isUuid } from '$shared/domain/uuid';
	import { formatCount } from '$shared/lib/format';
	import {
		Badge,
		Button,
		EmptyState,
		ForbiddenPage,
		Progress,
		Skeleton,
		StateChip
	} from '$shared/presentation/ui';
	import { surveysApi } from '$modules/surveys/data/api';
	import type {
		SurveyChecklist,
		SurveyDetail,
		SurveyGateDetail
	} from '$modules/surveys/domain/types';
	import { canRunSurveyAction } from '$modules/surveys/presentation/transitions';
	import SurveyTransitionDialog from '$modules/surveys/presentation/components/SurveyTransitionDialog.svelte';
	import MobileActionBar from '../components/MobileActionBar.svelte';
	import MobileHeader from '../components/MobileHeader.svelte';

	/**
	 * `/m/surveys/[id]/submit` — the submit checklist (phase-2 §3.2, Part 9 §14).
	 *
	 * Every blocking row is named before the button is pressed, and a
	 * `gate_blocked` response repeats the server's own reasons verbatim. Submit
	 * is never optimistic: the survey only moves after the server agrees.
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

	let dialogOpen = $state(false);
	let saving = $state(false);
	let dialogError = $state<string | null>(null);
	let gateReasons = $state<string[]>([]);

	const user = $derived($sessionStore.user);
	const survey = $derived(detail?.survey ?? null);
	const validId = $derived(isUuid(id));
	const canSubmit = $derived(survey !== null && canRunSurveyAction(user, 'submit', survey.status));
	const ready = $derived(Boolean(checklist?.canSubmit));

	const blockingRows = $derived(checklist?.items.filter((item) => item.blocking) ?? []);
	const optionalRows = $derived(checklist?.items.filter((item) => !item.blocking) ?? []);

	const satisfied = $derived(blockingRows.filter((item) => item.satisfied).length);
	const percent = $derived(
		blockingRows.length === 0 ? 0 : Math.round((satisfied / blockingRows.length) * 100)
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
					: 'We could not load this checklist. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}

	function openDialog(): void {
		dialogError = null;
		dialogOpen = true;
	}

	async function confirmSubmit(reason: string): Promise<void> {
		if (!survey) return;
		saving = true;
		dialogError = null;
		gateReasons = [];
		try {
			await surveysApi.transition(survey.id, { action: 'submit', reason: reason || null });
			dialogOpen = false;
			toast.success('Survey submitted for verification.');
			await load(survey.id);
		} catch (caught) {
			if (isApiError(caught)) {
				dialogError = caught.message;
				if (caught.code === 'gate_blocked') {
					const details = caught.details as SurveyGateDetail | undefined;
					if (details?.blocking_reasons) gateReasons = details.blocking_reasons;
				}
			} else {
				dialogError = 'We could not submit this survey. Try again.';
			}
		} finally {
			saving = false;
		}
	}

	function retry(): void {
		void load(id);
	}
</script>

<svelte:head>
	<title>{survey?.caption ? `Submit · ${survey.caption}` : 'Submit · Interio Survey'}</title>
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
		<h1 class="sr-only">Loading checklist</h1>
		<Skeleton variant="block" />
		<Skeleton lines={6} />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Survey not found."
		description="This survey does not exist or is no longer available."
		backHref={resolve('/m/surveys')}
		backLabel="Back to surveys"
	/>
{:else if error || !detail || !survey || !checklist}
	<h1 class="sr-only">Submit survey</h1>
	<EmptyState title="We could not load this checklist." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={retry}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	{@const loadedSurvey = survey}
	{@const loadedChecklist = checklist}

	<MobileHeader
		title="Submit survey"
		subtitle={`${loadedSurvey.caption} · ${formatCount(blockingRows.length)} required checks`}
		backHref={resolve(`/m/surveys/${loadedSurvey.id}`)}
		backLabel="Survey"
	>
		{#snippet actions()}
			<StateChip entity="survey" state={loadedSurvey.status} />
		{/snippet}
	</MobileHeader>

	<div class="flex flex-col gap-4">
		{#if loadedSurvey.status === 'rejected' && loadedSurvey.rejectedReason}
			<section role="alert" class="rounded-lg border border-critical bg-critical-soft p-3">
				<h2 class="text-subheadline text-critical-ink">Rejected — fix and resubmit</h2>
				<p class="pt-1 text-callout text-critical-ink">{loadedSurvey.rejectedReason}</p>
			</section>
		{/if}

		<section class="flex flex-col gap-3 rounded-lg border border-hairline bg-canvas p-3">
			<Progress
				label="Required checks complete"
				value={percent}
				valueLabel={`${satisfied} of ${blockingRows.length}`}
			/>
			{#if loadedChecklist.canSubmit}
				<p class="flex items-start gap-2 text-footnote text-safe-ink">
					<CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
					<span>Every blocking check passes. The survey can be submitted.</span>
				</p>
			{:else}
				<p class="flex items-start gap-2 text-footnote text-caution-ink">
					<CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
					<span>
						{loadedChecklist.blockingReasons.length}
						{loadedChecklist.blockingReasons.length === 1 ? 'check is' : 'checks are'} still blocking
						submission. Each one is named below.
					</span>
				</p>
			{/if}
		</section>

		{#if loadedChecklist.blockingReasons.length > 0}
			<section
				role="alert"
				class="flex flex-col gap-2 rounded-lg border border-caution bg-caution-soft p-3"
			>
				<h2 class="text-subheadline text-caution-ink">Blocking reasons</h2>
				<ul class="flex list-none flex-col gap-1 p-0 text-footnote text-caution-ink">
					{#each loadedChecklist.blockingReasons as reason (reason)}
						<li class="flex items-start gap-1.5">
							<MinusCircle
								size={14}
								strokeWidth={1.75}
								aria-hidden="true"
								class="mt-0.5 shrink-0"
							/>
							<span>{reason}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if gateReasons.length > 0}
			<section
				role="alert"
				class="flex flex-col gap-2 rounded-lg border border-critical bg-critical-soft p-3"
			>
				<h2 class="text-subheadline text-critical-ink">The server refused this submission</h2>
				<ul class="flex list-none flex-col gap-1 p-0 text-footnote text-critical-ink">
					{#each gateReasons as reason (reason)}
						<li>{reason}</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="flex flex-col gap-2" aria-labelledby="checklist-heading">
			<h2 id="checklist-heading" class="text-title-3 text-ink">Required checks</h2>
			<ul class="flex list-none flex-col gap-2 p-0">
				{#each blockingRows as item (item.id)}
					<li
						class="flex items-start justify-between gap-3 rounded-lg border border-hairline bg-canvas p-3"
					>
						<div class="flex min-w-0 flex-col gap-0.5">
							<span class="text-callout break-words text-ink">{item.label}</span>
							{#if item.detail}
								<span class="text-footnote break-words text-ink-secondary">{item.detail}</span>
							{/if}
						</div>
						<Badge
							label={item.satisfied ? 'Complete' : 'Missing'}
							tone={item.satisfied ? 'success' : 'warning'}
						/>
					</li>
				{/each}
			</ul>
		</section>

		{#if optionalRows.length > 0}
			<section class="flex flex-col gap-2" aria-labelledby="optional-heading">
				<h2 id="optional-heading" class="text-title-3 text-ink">Also worth checking</h2>
				<p class="text-footnote text-ink-secondary">
					These do not block submission, but the office will see them.
				</p>
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each optionalRows as item (item.id)}
						<li
							class="flex items-start justify-between gap-3 rounded-lg border border-hairline bg-canvas p-3"
						>
							<div class="flex min-w-0 flex-col gap-0.5">
								<span class="text-callout break-words text-ink">{item.label}</span>
								{#if item.detail}
									<span class="text-footnote break-words text-ink-secondary">{item.detail}</span>
								{/if}
							</div>
							{#if item.satisfied}
								<Badge label="Done" tone="success" />
							{:else}
								<Badge label="Optional" tone="neutral" />
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if loadedChecklist.criticalUnverified.length > 0}
			<p
				class="flex items-start gap-2 rounded-lg border border-hairline bg-canvas-grouped p-3 text-footnote text-ink-secondary"
			>
				<CircleDot size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>
					{loadedChecklist.criticalUnverified.length}
					{loadedChecklist.criticalUnverified.length === 1
						? 'critical measurement is'
						: 'critical measurements are'}
					still unverified. That blocks survey verification, not submission.
				</span>
			</p>
		{/if}

		{#if !canSubmit}
			<p
				class="rounded-lg border border-hairline bg-canvas-grouped p-3 text-footnote text-ink-secondary"
			>
				{#if loadedSurvey.status === 'submitted'}
					This survey is already submitted and waits for a production manager.
				{:else if loadedSurvey.status === 'verified' || loadedSurvey.status === 'cancelled'}
					This survey is {loadedSurvey.status}, so it cannot be submitted again.
				{:else}
					Your role cannot submit this survey.
				{/if}
			</p>
		{/if}
	</div>

	{#if canSubmit && ready}
		<MobileActionBar
			hint="Submission locks the survey for capture until a production manager acts."
		>
			<Button variant="primary" fullWidth onclick={openDialog}>Submit for verification</Button>
		</MobileActionBar>
	{:else if canSubmit}
		<MobileActionBar hint="Fix every blocking reason above before submitting.">
			<Button variant="primary" fullWidth disabled>Submit for verification</Button>
		</MobileActionBar>
	{/if}

	<SurveyTransitionDialog
		bind:open={dialogOpen}
		action="submit"
		surveyCaption={loadedSurvey.caption}
		{saving}
		error={dialogError}
		onconfirm={confirmSubmit}
	/>
{/if}
