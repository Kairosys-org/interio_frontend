<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import {
		CircleAlert,
		ClipboardCheck,
		Images,
		Ruler,
		ShieldCheck,
		DoorOpen
	} from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { sessionStore } from '$shared/application/session';
	import { isUuid } from '$shared/domain/uuid';
	import { formatCount, formatDateTime } from '$shared/lib/format';
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
	import type { SurveyDetail, SurveyProgressCounts } from '$modules/surveys/domain/types';
	import { canRunSurveyAction } from '$modules/surveys/presentation/transitions';
	import MobileHeader from '../components/MobileHeader.svelte';
	import MobileActionBar from '../components/MobileActionBar.svelte';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let detail = $state<SurveyDetail | null>(null);
	let progress = $state<SurveyProgressCounts | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let sequence = 0;

	const user = $derived($sessionStore.user);
	const survey = $derived(detail?.survey ?? null);
	const validId = $derived(isUuid(id));

	const canSubmit = $derived(survey ? canRunSurveyAction(user, 'submit', survey.status) : false);
	const canStart = $derived(survey ? canRunSurveyAction(user, 'start', survey.status) : false);
	const canResume = $derived(survey ? canRunSurveyAction(user, 'resume', survey.status) : false);
	const canVerify = $derived(Boolean(user) && Boolean(survey?.status === 'submitted'));

	const sections = $derived.by(() => {
		if (!detail || !progress) return [];
		return [
			{
				id: 'rooms',
				label: 'Rooms',
				detail: `${formatCount(progress.rooms)} captured`,
				href: resolve(`/m/surveys/${detail.survey.id}/rooms`),
				Icon: DoorOpen,
				badge: null
			},
			{
				id: 'measurements',
				label: 'Measurements',
				detail: `${formatCount(progress.measurements)} readings · ${formatCount(progress.criticalMeasurements)} critical`,
				href: resolve(`/m/surveys/${detail.survey.id}/measurements`),
				Icon: Ruler,
				badge:
					progress.criticalUnverified > 0
						? `${progress.criticalUnverified} unverified`
						: 'Critical clear'
			},
			{
				id: 'media',
				label: 'Photos and plans',
				detail: `${formatCount(progress.photos)} files attached`,
				href: resolve(`/m/surveys/${detail.survey.id}/media`),
				Icon: Images,
				badge: null
			},
			{
				id: 'submit',
				label: 'Checklist and submit',
				detail: `${formatCount(progress.requiredComplete)} of ${formatCount(progress.requiredTotal)} required fields complete`,
				href: resolve(`/m/surveys/${detail.survey.id}/submit`),
				Icon: ClipboardCheck,
				badge: null
			},
			{
				id: 'verify',
				label: 'Verify survey',
				detail: 'Critical measurements and the final decision',
				href: resolve(`/m/surveys/${detail.survey.id}/verify`),
				Icon: ShieldCheck,
				badge: null
			}
		];
	});

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
			const [hub, counts] = await Promise.all([surveysApi.get(value), surveysApi.progress(value)]);
			if (current !== sequence) return;
			detail = hub;
			progress = counts;
		} catch (caught) {
			if (current !== sequence) return;
			detail = null;
			progress = null;
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else
				error = isApiError(caught) ? caught.message : 'We could not load this survey. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}

	async function startOrResume(): Promise<void> {
		if (!survey) return;
		const action = canStart ? 'start' : 'resume';
		try {
			await surveysApi.transition(survey.id, { action, reason: null });
			await load(survey.id);
		} catch (caught) {
			error = isApiError(caught) ? caught.message : 'We could not start this survey. Try again.';
		}
	}

	function retry(): void {
		void load(id);
	}
</script>

<svelte:head>
	<title>{survey?.caption ? `${survey.caption} · Interio Survey` : 'Survey · Interio Survey'}</title
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
		<h1 class="sr-only">Loading survey</h1>
		<Skeleton variant="block" />
		<Skeleton lines={4} />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Survey not found."
		description="This survey does not exist or is no longer available."
		backHref={resolve('/m/surveys')}
		backLabel="Back to surveys"
	/>
{:else if error || !detail || !survey || !progress}
	<h1 class="sr-only">Survey</h1>
	<EmptyState title="We could not load this survey." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={retry}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	{@const loadedSurvey = survey}
	{@const loadedDetail = detail}
	{@const counts = progress}

	<MobileHeader
		title={loadedSurvey.caption}
		subtitle={`${loadedDetail.project.caption} · ${loadedDetail.project.reference}`}
		backHref={resolve('/m/surveys')}
		backLabel="All surveys"
	>
		{#snippet actions()}
			<StateChip entity="survey" state={loadedSurvey.status} />
		{/snippet}
	</MobileHeader>

	<div class="flex flex-col gap-4">
		{#if loadedSurvey.status === 'rejected' && loadedSurvey.rejectedReason}
			<section role="alert" class="rounded-lg border border-critical bg-critical-soft p-4">
				<h2 class="text-subheadline text-critical-ink">Rejected — fix and resubmit</h2>
				<p class="pt-1 text-callout text-critical-ink">{loadedSurvey.rejectedReason}</p>
			</section>
		{/if}

		<section class="rounded-lg border border-hairline bg-canvas p-4">
			<Progress
				label="Required fields complete"
				value={counts.percent}
				valueLabel={`${counts.requiredComplete} of ${counts.requiredTotal}`}
			/>
			<dl class="grid grid-cols-3 gap-3 pt-4">
				<div class="flex flex-col gap-0.5">
					<dt class="text-footnote text-ink-secondary">Rooms</dt>
					<dd class="text-headline text-ink tabular-nums">{formatCount(counts.rooms)}</dd>
				</div>
				<div class="flex flex-col gap-0.5">
					<dt class="text-footnote text-ink-secondary">Measurements</dt>
					<dd class="text-headline text-ink tabular-nums">{formatCount(counts.measurements)}</dd>
				</div>
				<div class="flex flex-col gap-0.5">
					<dt class="text-footnote text-ink-secondary">Critical open</dt>
					<dd
						class="text-headline tabular-nums {counts.criticalUnverified > 0
							? 'text-caution-ink'
							: 'text-ink'}"
					>
						{formatCount(counts.criticalUnverified)}
					</dd>
				</div>
			</dl>
		</section>

		{#if counts.criticalUnverified > 0}
			<p
				class="flex items-start gap-2 rounded-lg border border-caution bg-caution-soft p-3 text-footnote text-caution-ink"
			>
				<CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>
					{counts.criticalUnverified}
					{counts.criticalUnverified === 1
						? 'critical measurement needs'
						: 'critical measurements need'}
					a verification method before this survey can be verified.
				</span>
			</p>
		{/if}

		<nav aria-label="Survey sections">
			<ul class="flex list-none flex-col gap-2 p-0">
				{#each sections as section (section.id)}
					{#if section.id !== 'verify' || canVerify}
						<li>
							<a
								{...{ href: section.href }}
								class="flex min-h-target touch-manipulation items-center gap-3 rounded-lg border border-hairline bg-canvas p-4 hover:bg-canvas-grouped"
							>
								<span
									class="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-canvas-nested text-ink"
								>
									<section.Icon size={20} strokeWidth={1.75} aria-hidden="true" />
								</span>
								<span class="flex min-w-0 flex-1 flex-col gap-0.5">
									<span class="text-headline text-ink">{section.label}</span>
									<span class="text-footnote break-words text-ink-secondary">{section.detail}</span>
								</span>
								{#if section.badge}
									<Badge
										label={section.badge}
										tone={section.badge.endsWith('unverified') ? 'warning' : 'success'}
									/>
								{/if}
							</a>
						</li>
					{/if}
				{/each}
			</ul>
		</nav>

		<p class="text-footnote text-ink-tertiary">
			Appointment {formatDateTime(loadedSurvey.appointmentAt)}
			{#if loadedSurvey.submittedAt}
				· submitted {formatDateTime(loadedSurvey.submittedAt)}
			{/if}
		</p>
	</div>

	{#if canSubmit || canStart || canResume}
		<MobileActionBar
			hint={canSubmit
				? 'The checklist decides whether submission is allowed.'
				: canStart
					? 'Starting moves the survey to In progress.'
					: 'Resuming returns the rejected survey to capture.'}
		>
			{#if canSubmit}
				<Button
					variant="primary"
					fullWidth
					onclick={() => void goto(resolve(`/m/surveys/${loadedSurvey.id}/submit`))}
				>
					Open checklist
				</Button>
			{:else}
				<Button variant="primary" fullWidth onclick={startOrResume}>
					{canStart ? 'Start capture' : 'Resume capture'}
				</Button>
			{/if}
		</MobileActionBar>
	{/if}
{/if}
