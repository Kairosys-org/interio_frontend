<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { sessionStore } from '$shared/application/session';
	import type { AuditTrailRow } from '$shared/domain/audit';
	import { PERMISSIONS, hasPermission } from '$shared/domain/permissions';
	import { PROJECT_TYPE_LABELS } from '$shared/domain/record-states';
	import { isUuid } from '$shared/domain/uuid';
	import { formatDate, formatDateTime } from '$shared/lib/format';
	import { stateLabel } from '$shared/lib/status';
	import {
		AssignmentPanel,
		AuditTrailTab,
		Badge,
		Breadcrumb,
		Button,
		ConfirmDialog,
		DetailSection,
		EmptyState,
		EntityLink,
		ForbiddenPage,
		GateBanner,
		KeyValueGrid,
		Menu,
		PageHeader,
		Skeleton,
		StageIndicator,
		StateChip,
		Tabs
	} from '$shared/presentation/ui';
	import { projectsApi } from '../../data/api';
	import type { AssignableSurveyor, Project, ProjectHub, ProjectStatus } from '../../domain/types';
	import { nextProjectStatuses } from '../../domain/validations';
	import { PROJECT_TAB_ITEMS, resolveProjectTab } from '../project-tabs';
	import ProjectDedupReview from '../components/ProjectDedupReview.svelte';
	import ProjectSummaryCards from '../components/ProjectSummaryCards.svelte';
	import ProjectTransitionDialog from '../components/ProjectTransitionDialog.svelte';
	import { formatAddress } from '../wizard-types';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	const TRANSITION_ACTION_LABELS: Readonly<Record<ProjectStatus, string>> = {
		active: 'Resume project',
		on_hold: 'Put on hold',
		completed: 'Mark completed',
		cancelled: 'Cancel project'
	};

	const TRANSITION_TOAST: Readonly<Record<ProjectStatus, string>> = {
		active: 'Project resumed.',
		on_hold: 'Project put on hold.',
		completed: 'Project marked completed.',
		cancelled: 'Project cancelled.'
	};

	let hub = $state<ProjectHub | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let requestSequence = 0;

	let surveyors = $state<AssignableSurveyor[]>([]);
	let assignmentsError = $state<string | null>(null);
	let assignmentSaving = $state(false);

	let transitionOpen = $state(false);
	let transitionTarget = $state<ProjectStatus | null>(null);
	let transitionSaving = $state(false);
	let transitionError = $state<string | null>(null);

	let archiveOpen = $state(false);
	let archiveSaving = $state(false);
	let archiveError = $state<string | null>(null);

	let dedupOpen = $state(false);

	let auditRows = $state<AuditTrailRow[]>([]);
	let auditLoading = $state(false);
	let auditError = $state<string | null>(null);
	let auditLoadedFor: string | null = null;
	let auditSequence = 0;

	let tabValue = $state<string>(resolveProjectTab(page.url.searchParams.get('tab')));
	let lastUrlTab: string = resolveProjectTab(page.url.searchParams.get('tab'));

	const validId = $derived(isUuid(id));
	const canUpdate = $derived(
		Boolean(
			$sessionStore.user &&
			hasPermission($sessionStore.user.permissions, PERMISSIONS.PROJECT_UPDATE)
		)
	);
	const canArchive = $derived(
		Boolean(
			$sessionStore.user &&
			hasPermission($sessionStore.user.permissions, PERMISSIONS.PROJECT_ARCHIVE)
		)
	);

	const breadcrumb = $derived([
		{ label: 'Projects', href: resolve('/projects') },
		{ label: hub?.project.caption ?? 'Project' }
	]);

	const legalNext = $derived<readonly ProjectStatus[]>(
		hub ? nextProjectStatuses(hub.project.status) : []
	);

	/** Prefer the successful transition as the one primary action (DESIGN §10.3). */
	const primaryStatus = $derived<ProjectStatus | null>(
		legalNext.includes('completed')
			? 'completed'
			: legalNext.includes('active')
				? 'active'
				: legalNext.includes('on_hold')
					? 'on_hold'
					: null
	);
	const menuStatuses = $derived(legalNext.filter((status) => status !== primaryStatus));
	const transitionsAvailable = $derived(hub?.project.state === 'active');

	const isArchived = $derived(hub?.project.state === 'archived');
	const canToggleArchive = $derived(
		hub !== null && (hub.project.state === 'active' || hub.project.state === 'archived')
	);

	const menuItems = $derived.by(() => {
		const items: Array<{ label: string; onSelect: () => void; danger?: boolean }> = [];

		if (canUpdate && transitionsAvailable) {
			for (const status of menuStatuses) {
				items.push({
					label: TRANSITION_ACTION_LABELS[status],
					onSelect: () => openTransition(status),
					danger: status === 'cancelled'
				});
			}
		}

		if (canArchive && canToggleArchive) {
			items.push({
				label: isArchived ? 'Restore project' : 'Archive project',
				onSelect: () => {
					archiveError = null;
					archiveOpen = true;
				}
			});
		}

		return items;
	});

	const customerHref = $derived(
		hub?.customer ? resolve(`/customers/${hub.customer.id}`) : undefined
	);
	const propertyHref = $derived(
		hub?.property ? resolve(`/properties/${hub.property.id}`) : undefined
	);
	const dedupHref = $derived(
		hub?.project.dedupOfId ? resolve(`/projects/${hub.project.dedupOfId}`) : undefined
	);

	const detailItems = $derived.by(() => {
		if (!hub) return [];
		return [
			{ label: 'Reference', value: hub.project.reference, mono: true },
			{ label: 'Type', value: PROJECT_TYPE_LABELS[hub.project.projectType] },
			{ label: 'Status', value: stateLabel(hub.project.status) },
			{
				label: 'Customer',
				value: hub.customer?.caption ?? null,
				href: customerHref
			},
			{
				label: 'Property',
				value: hub.property ? formatAddress(hub.property) : null,
				href: propertyHref
			},
			{ label: 'Created', value: formatDate(hub.project.createdAt) },
			{ label: 'Updated', value: formatDateTime(hub.project.updatedAt) },
			{
				label: 'Archived',
				value: hub.project.archivedAt ? formatDate(hub.project.archivedAt) : null
			}
		];
	});

	$effect(() => {
		const value = id;
		if (!isUuid(value)) {
			requestSequence += 1;
			loading = false;
			hub = null;
			notFound = true;
			error = null;
			return;
		}
		void load(value);
	});

	$effect(() => {
		const fromUrl = resolveProjectTab(page.url.searchParams.get('tab'));
		/** Only a URL change may overwrite the tab the user just clicked. */
		if (fromUrl === lastUrlTab) return;
		lastUrlTab = fromUrl;
		tabValue = fromUrl;
	});

	$effect(() => {
		const current = tabValue;
		const fromUrl = resolveProjectTab(page.url.searchParams.get('tab'));
		if (fromUrl === current) {
			lastUrlTab = current;
			return;
		}

		lastUrlTab = current;
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (current === 'overview') params.delete('tab');
		else params.set('tab', current);
		const suffix = params.toString();
		void goto(
			suffix.length > 0 ? resolve(`/projects/${id}?${suffix}`) : resolve(`/projects/${id}`),
			{
				replaceState: true,
				keepFocus: true,
				noScroll: true
			}
		);
	});

	$effect(() => {
		if (tabValue !== 'audit') return;
		const projectId = hub?.project.id ?? null;
		if (!projectId || auditLoadedFor === projectId) return;
		auditLoadedFor = projectId;
		void loadAudit(projectId);
	});

	async function load(value: string): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;
		notFound = false;

		try {
			const [detail, pool] = await Promise.all([
				projectsApi.get(value),
				projectsApi.assignableSurveyors(value).catch(() => null)
			]);
			if (sequence !== requestSequence) return;
			hub = detail;
			if (pool) {
				surveyors = pool;
				assignmentsError = null;
			} else {
				surveyors = [];
				assignmentsError = 'We could not load available surveyors. Try again later.';
			}
		} catch (caught) {
			if (sequence !== requestSequence) return;
			hub = null;
			if (isApiError(caught) && caught.isNotFound()) {
				notFound = true;
			} else {
				error = isApiError(caught) ? caught.message : 'We could not load this project. Try again.';
			}
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	async function refreshAssignments(projectId: string): Promise<void> {
		try {
			const [detail, pool] = await Promise.all([
				projectsApi.get(projectId),
				projectsApi.assignableSurveyors(projectId)
			]);
			hub = detail;
			surveyors = pool;
			assignmentsError = null;
		} catch (caught) {
			assignmentsError = isApiError(caught)
				? caught.message
				: 'We could not refresh the surveyor assignments. Try again.';
		}
	}

	async function handleAdd(userId: string): Promise<void> {
		const projectId = hub?.project.id;
		if (!projectId) return;
		assignmentSaving = true;
		assignmentsError = null;
		try {
			await projectsApi.addAssignment(projectId, { userId });
			toast.success('Surveyor assigned.');
			await refreshAssignments(projectId);
		} catch (caught) {
			assignmentsError = isApiError(caught)
				? caught.message
				: 'We could not add this surveyor. Try again.';
			throw caught;
		} finally {
			assignmentSaving = false;
		}
	}

	async function handleRemove(userId: string): Promise<void> {
		const projectId = hub?.project.id;
		if (!projectId) return;
		assignmentSaving = true;
		assignmentsError = null;
		try {
			await projectsApi.removeAssignment(projectId, userId);
			toast.success('Surveyor removed.');
			await refreshAssignments(projectId);
		} catch (caught) {
			assignmentsError = isApiError(caught)
				? caught.message
				: 'We could not remove this surveyor. Try again.';
			throw caught;
		} finally {
			assignmentSaving = false;
		}
	}

	function openTransition(target: ProjectStatus): void {
		transitionTarget = target;
		transitionError = null;
		transitionOpen = true;
	}

	async function handleTransition(reason: string): Promise<void> {
		const current = hub;
		const target = transitionTarget;
		if (!current || !target) return;

		transitionSaving = true;
		transitionError = null;
		try {
			await projectsApi.transition(current.project.id, {
				status: target,
				reason: reason.length > 0 ? reason : null
			});
			toast.success(TRANSITION_TOAST[target]);
			transitionOpen = false;
			auditLoadedFor = null;
			await reload(current.project.id);
		} catch (caught) {
			transitionError = isApiError(caught)
				? caught.message
				: 'We could not change this project status. Try again.';
			throw caught;
		} finally {
			transitionSaving = false;
		}
	}

	async function reload(projectId: string): Promise<void> {
		try {
			const detail = await projectsApi.get(projectId);
			hub = detail;
		} catch (caught) {
			error = isApiError(caught) ? caught.message : 'We could not refresh this project. Try again.';
		}
	}

	async function handleArchive(): Promise<void> {
		const current = hub;
		if (!current) return;

		archiveSaving = true;
		archiveError = null;
		try {
			if (current.project.state === 'archived') {
				await projectsApi.unarchive(current.project.id);
				toast.success('Project restored.');
			} else {
				await projectsApi.archive(current.project.id);
				toast.success('Project archived.');
			}
			archiveOpen = false;
			auditLoadedFor = null;
			await reload(current.project.id);
		} catch (caught) {
			archiveError = isApiError(caught)
				? caught.message
				: 'We could not change the archive state. Try again.';
			throw caught;
		} finally {
			archiveSaving = false;
		}
	}

	async function loadAudit(projectId: string): Promise<void> {
		const sequence = ++auditSequence;
		auditLoading = true;
		auditError = null;
		try {
			const rows = await projectsApi.audit(projectId);
			if (sequence !== auditSequence) return;
			auditRows = rows;
		} catch (caught) {
			if (sequence !== auditSequence) return;
			auditRows = [];
			auditError = isApiError(caught)
				? caught.message
				: 'We could not load the activity trail. Try again.';
		} finally {
			if (sequence === auditSequence) auditLoading = false;
		}
	}

	function handleReviewed(project: Project): void {
		dedupOpen = false;
		if (project.state === 'cancelled' && project.dedupOfId) {
			void goto(resolve(`/projects/${project.dedupOfId}`));
			return;
		}
		auditLoadedFor = null;
		void reload(project.id);
	}

	function retry(): void {
		void load(id);
	}

	function retryAudit(): void {
		if (!hub) return;
		auditLoadedFor = hub.project.id;
		void loadAudit(hub.project.id);
	}
</script>

<svelte:head>
	<title>{hub?.project.caption ? `${hub.project.caption} · Interio` : 'Project · Interio'}</title>
</svelte:head>

{#if !validId}
	<ForbiddenPage
		variant="not-found"
		title="Project not found."
		description="This project does not exist or is no longer available."
		backHref={resolve('/projects')}
		backLabel="Back to projects"
	/>
{:else if loading}
	<div class="flex flex-col gap-6" aria-busy="true" aria-label="Loading project">
		<h1 class="sr-only">Loading project</h1>
		<Skeleton lines={1} class="max-w-content-reading" />
		<Skeleton variant="block" />
		<Skeleton variant="block" />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Project not found."
		description="This project does not exist or is no longer available."
		backHref={resolve('/projects')}
		backLabel="Back to projects"
	/>
{:else if error || !hub}
	<h1 class="sr-only">Project</h1>
	<EmptyState title="We could not load this project." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={retry}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else if hub}
	{@const loadedHub = hub}
	<Breadcrumb items={breadcrumb} class="pb-4" />

	<PageHeader
		title={loadedHub.project.caption}
		description={`${PROJECT_TYPE_LABELS[loadedHub.project.projectType]} · ${loadedHub.project.reference}`}
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<StateChip entity="project" state={loadedHub.project.status} />
				{#if isArchived}
					<Badge label="Archived" tone="neutral" />
				{/if}
				{#if loadedHub.project.state === 'pending_review'}
					<Badge label="Needs review" tone="warning" />
				{/if}

				{#if canUpdate && transitionsAvailable && primaryStatus}
					<Button variant="primary" onclick={() => openTransition(primaryStatus)}>
						{TRANSITION_ACTION_LABELS[primaryStatus]}
					</Button>
				{/if}

				{#if menuItems.length > 0}
					<Menu label="More project actions" items={menuItems} />
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<div class="mt-8 flex flex-col gap-4">
		{#if loadedHub.project.state === 'pending_review'}
			<section
				role="alert"
				class="flex flex-col gap-3 rounded-lg border border-caution bg-caution-soft p-4"
			>
				<div class="flex flex-col gap-1">
					<h2 class="text-title-3 text-caution-ink">This project is held for duplicate review.</h2>
					<p class="text-callout text-caution-ink">
						Confirm it is different or link it to the matching project before work starts. Nothing
						is merged automatically.
					</p>
				</div>
				<Button variant="secondary" onclick={() => (dedupOpen = true)}>Review duplicate</Button>
			</section>
		{:else if loadedHub.project.state === 'cancelled' && dedupHref}
			<p
				class="rounded-lg border border-hairline bg-canvas-grouped p-4 text-callout text-ink-secondary"
			>
				This project was linked to
				<EntityLink href={dedupHref}>the existing project</EntityLink>
				during duplicate review.
			</p>
		{/if}

		<GateBanner gates={loadedHub.gates} />

		<DetailSection title="Pipeline" description="Where this project sits across later phases.">
			<StageIndicator stages={loadedHub.stages} compact />
		</DetailSection>

		<DetailSection
			title="Summary"
			description="Counts from the modules that hang off this project."
		>
			<ProjectSummaryCards counts={loadedHub.counts} />
		</DetailSection>

		<Tabs label="Project sections" tabs={PROJECT_TAB_ITEMS} bind:value={tabValue}>
			{#snippet children(tabId)}
				{#if tabId === 'overview'}
					<div class="flex flex-col gap-4">
						<DetailSection title="Project details">
							<KeyValueGrid items={detailItems} columns={2} />
						</DetailSection>

						<DetailSection
							title="Access notes"
							description="Information the surveyor needs before visiting."
						>
							{#if loadedHub.property?.accessNotes}
								<p class="text-callout break-words whitespace-pre-line text-ink">
									{loadedHub.property.accessNotes}
								</p>
							{:else}
								<p class="text-callout text-ink-secondary">No access notes recorded.</p>
							{/if}
						</DetailSection>

						<div id="assignments">
							<DetailSection
								title="Surveyors"
								description="Only assigned surveyors can capture surveys for this project."
							>
								<AssignmentPanel
									assignments={loadedHub.assignments}
									{surveyors}
									loading={false}
									saving={assignmentSaving}
									error={assignmentsError}
									onadd={handleAdd}
									onremove={handleRemove}
								/>
							</DetailSection>
						</div>
					</div>
				{:else if tabId === 'audit'}
					<DetailSection title="Activity">
						<AuditTrailTab
							rows={auditRows}
							loading={auditLoading}
							error={auditError}
							emptyLabel="No project activity yet."
						/>
						{#if auditError}
							<div class="pt-2">
								<Button variant="secondary" onclick={retryAudit}>Try again</Button>
							</div>
						{/if}
					</DetailSection>
				{/if}
			{/snippet}
		</Tabs>
	</div>

	<ProjectTransitionDialog
		bind:open={transitionOpen}
		target={transitionTarget}
		saving={transitionSaving}
		error={transitionError}
		onconfirm={handleTransition}
	/>

	<ConfirmDialog
		bind:open={archiveOpen}
		title={isArchived
			? `Restore ${loadedHub.project.caption}?`
			: `Archive ${loadedHub.project.caption}?`}
		description={isArchived
			? 'The project returns to the active list. Nothing was deleted while it was archived.'
			: 'The project disappears from the default list and no new work can start. Nothing is deleted; you can restore it later.'}
		confirmLabel={isArchived ? 'Restore project' : 'Archive project'}
		loading={archiveSaving}
		error={archiveError}
		onconfirm={handleArchive}
	/>

	<ProjectDedupReview
		bind:open={dedupOpen}
		heldId={loadedHub.project.id}
		onReviewed={handleReviewed}
	/>
{/if}
