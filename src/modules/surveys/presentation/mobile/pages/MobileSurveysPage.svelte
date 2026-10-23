<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import { ArrowRight, CircleAlert, ClipboardList, Plus, RefreshCw } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { SurveyListRow } from '$modules/surveys/domain/types';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { formatDateTime } from '$shared/lib/format';
	import {
		Badge,
		Button,
		EmptyState,
		EntityLink,
		PermissionGate,
		Skeleton,
		StateChip
	} from '$shared/presentation/ui';
	import MobileHeader from '../components/MobileHeader.svelte';

	/**
	 * `/m/surveys` — capture list (phase-2 §3.2).
	 *
	 * Resume-first: in progress, then rejected (needs fixing), then submitted,
	 * then everything else. Each card states the state and the G8 backlog in
	 * words so an offline glance is enough.
	 */
	const PRIORITY: Record<string, number> = {
		in_progress: 0,
		rejected: 1,
		submitted: 2,
		draft: 3,
		verified: 4,
		cancelled: 5
	};

	let rows = $state<SurveyListRow[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let sequence = 0;

	const ordered = $derived(
		[...rows].sort(
			(first, second) =>
				(PRIORITY[first.status] ?? 9) - (PRIORITY[second.status] ?? 9) ||
				second.appointmentAt.localeCompare(first.appointmentAt)
		)
	);

	$effect(() => {
		void load();
	});

	async function load(): Promise<void> {
		const current = ++sequence;
		loading = true;
		error = null;
		try {
			const page = await surveysApi.list({
				scope: 'mine',
				status: 'all',
				pageSize: MAX_PAGE_SIZE,
				sort: 'appointmentAt',
				sortDir: 'desc'
			});
			if (current !== sequence) return;
			rows = page.items;
		} catch (caught) {
			if (current !== sequence) return;
			rows = [];
			error = isApiError(caught) ? caught.message : 'We could not load your surveys. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}
</script>

<svelte:head>
	<title>Surveys · Interio Survey</title>
</svelte:head>

<MobileHeader
	title="Your surveys"
	subtitle="Resume the visit in progress, then the rest of your work."
>
	{#snippet actions()}
		<Button variant="secondary" onclick={load} {loading} loadingLabel="Refreshing…">
			{#snippet icon()}
				<RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
			{/snippet}
			Refresh
		</Button>
	{/snippet}
</MobileHeader>

{#if loading}
	<div class="flex flex-col gap-3" aria-busy="true">
		<p class="sr-only" role="status">Loading your surveys</p>
		<Skeleton variant="block" />
		<Skeleton variant="block" />
	</div>
{:else if error}
	<div
		role="alert"
		class="flex flex-col items-start gap-3 rounded-lg border border-hairline bg-canvas p-4"
	>
		<p class="flex items-start gap-2 text-callout text-critical-ink">
			<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
			<span>{error}</span>
		</p>
		<Button variant="secondary" onclick={load}>Try again</Button>
	</div>
{:else if ordered.length === 0}
	<EmptyState
		title="No surveys assigned."
		description="Surveys appear here once a production manager creates one for you on an assigned project."
	>
		{#snippet icon()}
			<ClipboardList size={24} strokeWidth={1.75} aria-hidden="true" />
		{/snippet}
		{#snippet action()}
			<PermissionGate permission={PERMISSIONS.SURVEY_CREATE}>
				<Button variant="secondary" onclick={() => void goto(resolve('/m/projects'))}>
					{#snippet icon()}
						<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
					{/snippet}
					Open projects
				</Button>
			</PermissionGate>
		{/snippet}
	</EmptyState>
{:else}
	<ul class="flex list-none flex-col gap-3 p-0">
		{#each ordered as survey (survey.id)}
			{@const href = resolve(`/m/surveys/${survey.id}`)}
			<li>
				<EntityLink
					{href}
					class="flex min-h-target touch-manipulation flex-col gap-2 rounded-lg border border-hairline bg-canvas p-4 hover:bg-canvas-grouped"
				>
					<span class="flex w-full flex-wrap items-start justify-between gap-2">
						<span class="flex min-w-0 flex-col gap-0.5">
							<span class="text-headline break-words text-ink">{survey.caption}</span>
							<span class="text-footnote break-words text-ink-secondary">
								{survey.projectCaption} · {survey.projectReference}
							</span>
						</span>
						<StateChip entity="survey" state={survey.status} />
					</span>
					<span class="text-footnote break-words text-ink-secondary">{survey.propertyAddress}</span>
					<span class="flex w-full flex-wrap items-center justify-between gap-2 pt-1">
						<span class="text-footnote text-ink-tertiary">
							{formatDateTime(survey.appointmentAt)}
						</span>
						{#if survey.criticalUnverifiedCount > 0}
							<Badge
								label={`${survey.criticalUnverifiedCount} critical to verify`}
								tone="warning"
							/>
						{:else if survey.status === 'submitted' || survey.status === 'verified'}
							<Badge label="Critical verified" tone="success" />
						{:else}
							<Badge label="No critical backlog" tone="neutral" />
						{/if}
					</span>
					<span class="inline-flex w-full items-center justify-end gap-1 text-footnote text-brand">
						{survey.status === 'in_progress' ? 'Resume capture' : 'Open survey'}
						<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
					</span>
				</EntityLink>
			</li>
		{/each}
	</ul>
{/if}
