<script lang="ts">
	import { resolve } from '$app/paths';

	import { ArrowRight, CircleAlert, FolderKanban, RefreshCw } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { projectsApi } from '$modules/projects/data/api';
	import type { ProjectListRow } from '$modules/projects/domain/types';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { formatDate } from '$shared/lib/format';
	import { Button, EmptyState, EntityLink, Skeleton, StateChip } from '$shared/presentation/ui';
	import MobileHeader from '../components/MobileHeader.svelte';

	/**
	 * `/m/projects` — the surveyor's assigned work (phase-2 §3.2).
	 *
	 * Only active projects the user is assigned to, most recently updated
	 * first. A capture-only surveyor never sees the tenant-wide list.
	 */
	let rows = $state<ProjectListRow[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let sequence = 0;

	$effect(() => {
		void load();
	});

	async function load(): Promise<void> {
		const current = ++sequence;
		loading = true;
		error = null;
		try {
			const page = await projectsApi.list({
				scope: 'mine',
				status: 'active',
				pageSize: MAX_PAGE_SIZE,
				sort: 'updatedAt',
				sortDir: 'desc'
			});
			if (current !== sequence) return;
			rows = page.items;
		} catch (caught) {
			if (current !== sequence) return;
			rows = [];
			error = isApiError(caught) ? caught.message : 'We could not load your projects. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}
</script>

<svelte:head>
	<title>Projects · Interio Survey</title>
</svelte:head>

<MobileHeader
	title="Your projects"
	subtitle="Active work you are assigned to. Open a project to see its surveys."
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
		<p class="sr-only" role="status">Loading your projects</p>
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
{:else if rows.length === 0}
	<EmptyState
		title="No projects assigned."
		description="A production manager assigns surveyors to projects. Once you are assigned, the project appears here."
	>
		{#snippet icon()}
			<FolderKanban size={24} strokeWidth={1.75} aria-hidden="true" />
		{/snippet}
	</EmptyState>
{:else}
	<ul class="flex list-none flex-col gap-3 p-0">
		{#each rows as project (project.id)}
			{@const href = resolve(`/m/projects/${project.id}`)}
			<li>
				<EntityLink
					{href}
					class="flex min-h-target touch-manipulation flex-col gap-2 rounded-lg border border-hairline bg-canvas p-4 hover:bg-canvas-grouped"
				>
					<span class="flex w-full flex-wrap items-start justify-between gap-2">
						<span class="flex min-w-0 flex-col gap-0.5">
							<span class="text-headline break-words text-ink">{project.caption}</span>
							<span class="text-footnote text-ink-tertiary">{project.reference}</span>
						</span>
						<StateChip entity="project" state={project.status} />
					</span>
					<span class="text-callout break-words text-ink-secondary">{project.customerCaption}</span>
					<span class="text-footnote break-words text-ink-secondary">
						{project.propertyAddress}
					</span>
					<span
						class="flex w-full items-center justify-between gap-2 pt-1 text-footnote text-ink-tertiary"
					>
						<span>Created {formatDate(project.createdAt)}</span>
						<span class="inline-flex items-center gap-1 text-brand">
							Open
							<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
						</span>
					</span>
				</EntityLink>
			</li>
		{/each}
	</ul>
{/if}
