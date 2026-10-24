<script lang="ts">
	import { resolve } from '$app/paths';

	import { ArrowRight, CircleAlert, Plus, RefreshCw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { projectsApi } from '$modules/projects/data/api';
	import type { ProjectHub } from '$modules/projects/domain/types';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { SurveyListRow, Survey } from '$modules/surveys/domain/types';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { isUuid } from '$shared/domain/uuid';
	import { formatCount, formatDateTime } from '$shared/lib/format';
	import {
		Badge,
		Button,
		EmptyState,
		EntityLink,
		ForbiddenPage,
		KeyValueGrid,
		PermissionGate,
		Skeleton,
		StateChip
	} from '$shared/presentation/ui';
	import MobileHeader from '../components/MobileHeader.svelte';
	import MobileSurveyFormDialog from '../components/MobileSurveyFormDialog.svelte';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let hub = $state<ProjectHub | null>(null);
	let surveys = $state<SurveyListRow[]>([]);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let sequence = 0;
	let formOpen = $state(false);

	const validId = $derived(isUuid(id));
	const project = $derived(hub?.project ?? null);

	const address = $derived.by(() => {
		const property = hub?.property;
		if (!property) return null;
		return [property.addressLine1, property.town, property.postcode]
			.filter((value): value is string => Boolean(value))
			.join(', ');
	});

	$effect(() => {
		const value = id;
		if (!isUuid(value)) {
			sequence += 1;
			loading = false;
			hub = null;
			notFound = true;
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
			const [projectHub, page] = await Promise.all([
				projectsApi.get(value),
				surveysApi.list({ projectId: value, status: 'all', pageSize: MAX_PAGE_SIZE })
			]);
			if (current !== sequence) return;
			hub = projectHub;
			surveys = page.items;
		} catch (caught) {
			if (current !== sequence) return;
			hub = null;
			surveys = [];
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else
				error = isApiError(caught) ? caught.message : 'We could not load this project. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}

	function handleCreated(survey: Survey): void {
		toast.success(`${survey.caption} created.`);
		formOpen = false;
		void load(id);
	}
</script>

<svelte:head>
	<title
		>{project?.caption ? `${project.caption} · Interio Survey` : 'Project · Interio Survey'}</title
	>
</svelte:head>

{#if !validId}
	<ForbiddenPage
		variant="not-found"
		title="Project not found."
		description="This project does not exist or is no longer available."
		backHref={resolve('/m/projects')}
		backLabel="Back to projects"
	/>
{:else if loading}
	<div class="flex flex-col gap-4" aria-busy="true">
		<h1 class="sr-only">Loading project</h1>
		<Skeleton variant="block" />
		<Skeleton lines={4} />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Project not found."
		description="This project does not exist or is no longer available."
		backHref={resolve('/m/projects')}
		backLabel="Back to projects"
	/>
{:else if error || !hub || !project}
	<h1 class="sr-only">Project</h1>
	<EmptyState title="We could not load this project." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={() => void load(id)}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	{@const loadedHub = hub}
	{@const loadedProject = project}

	<MobileHeader
		title={loadedProject.caption}
		subtitle={loadedProject.reference}
		backHref={resolve('/m/projects')}
		backLabel="All projects"
	>
		{#snippet actions()}
			<StateChip entity="project" state={loadedProject.status} />
		{/snippet}
	</MobileHeader>

	<div class="flex flex-col gap-4">
		<section class="rounded-lg border border-hairline bg-canvas p-4">
			<KeyValueGrid
				columns={1}
				items={[
					{ label: 'Customer', value: loadedHub.customer?.caption ?? null },
					{ label: 'Property', value: address }
				]}
			/>
			<p class="pt-3 text-footnote text-ink-secondary">
				{`${formatCount(loadedHub.assignments.length)} ${
					loadedHub.assignments.length === 1 ? 'person' : 'people'
				} assigned · ${formatCount(surveys.length)} ${surveys.length === 1 ? 'survey' : 'surveys'}`}
			</p>
		</section>

		<section class="flex flex-col gap-3" aria-labelledby="project-surveys-heading">
			<div class="flex items-center justify-between gap-2">
				<h2 id="project-surveys-heading" class="text-title-3 text-ink">Surveys</h2>
				<Button
					variant="secondary"
					onclick={() => void load(id)}
					{loading}
					loadingLabel="Refreshing…"
				>
					{#snippet icon()}
						<RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
					{/snippet}
					Refresh
				</Button>
			</div>

			{#if surveys.length === 0}
				<EmptyState
					title="No surveys on this project."
					description="Create the first survey to plan a site visit."
				>
					{#snippet action()}
						<PermissionGate permission={PERMISSIONS.SURVEY_CREATE}>
							<Button variant="primary" onclick={() => (formOpen = true)}>New survey</Button>
						</PermissionGate>
					{/snippet}
				</EmptyState>
			{:else}
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each surveys as survey (survey.id)}
						<li>
							<EntityLink
								href={resolve(`/m/surveys/${survey.id}`)}
								class="flex min-h-target touch-manipulation flex-col items-stretch gap-1 rounded-lg border border-hairline bg-canvas p-4 hover:bg-canvas-grouped"
							>
								<span class="flex w-full flex-wrap items-start justify-between gap-2">
									<span class="text-headline break-words text-ink">{survey.caption}</span>
									<StateChip entity="survey" state={survey.status} />
								</span>
								<span class="flex w-full flex-wrap items-center justify-between gap-2">
									<span class="text-footnote text-ink-secondary">
										{formatDateTime(survey.appointmentAt)}
									</span>
									{#if survey.criticalUnverifiedCount > 0}
										<Badge
											label={`${survey.criticalUnverifiedCount} critical open`}
											tone="warning"
										/>
									{:else}
										<Badge label={`${survey.roomCount} rooms`} tone="neutral" />
									{/if}
									<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" class="text-brand" />
								</span>
							</EntityLink>
						</li>
					{/each}
				</ul>

				<PermissionGate permission={PERMISSIONS.SURVEY_CREATE}>
					<Button variant="primary" fullWidth onclick={() => (formOpen = true)}>
						{#snippet icon()}
							<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
						{/snippet}
						New survey
					</Button>
				</PermissionGate>
			{/if}
		</section>

		{#each loadedHub.gates.filter((gate) => gate.state === 'blocking') as gate (gate.id)}
			<p
				role="status"
				class="flex items-start gap-2 rounded-lg border border-caution bg-caution-soft p-3 text-footnote text-caution-ink"
			>
				<CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{gate.title}: {gate.reasons.join(' ')}</span>
			</p>
		{/each}
	</div>

	<MobileSurveyFormDialog
		bind:open={formOpen}
		projectId={loadedProject.id}
		projectCaption={loadedProject.caption}
		oncreated={handleCreated}
		onclose={() => (formOpen = false)}
	/>
{/if}
