<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { CircleAlert, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { projectsApi } from '$modules/projects/data/api';
	import { sessionStore } from '$shared/application/session';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { PERMISSIONS, hasPermission } from '$shared/domain/permissions';
	import { ROLES } from '$shared/domain/roles';
	import type { SurveyState } from '$shared/domain/record-states';
	import { isUuid } from '$shared/domain/uuid';
	import { formatCount, formatDateTime } from '$shared/lib/format';
	import {
		Button,
		DataTable,
		EmptyState,
		EntityLink,
		Input,
		PageHeader,
		Pagination,
		PermissionGate,
		SearchInput,
		Select,
		StateChip
	} from '$shared/presentation/ui';
	import { surveysApi } from '../../data/api';
	import type { SurveyListRow, SurveySort } from '../../domain/types';
	import SurveyFormDialog from '../components/SurveyFormDialog.svelte';

	/**
	 * `/surveys` list (DESIGN §10.2 List): header, filters, data table,
	 * load-more pagination. Every filter and the page live in the URL so a
	 * reload restores the same review view (Part 11 §1).
	 */
	const PAGE_SIZE = 20;
	const PAGE_LIMIT = MAX_PAGE_SIZE / PAGE_SIZE;
	const DEFAULT_SORT: SurveySort = 'updatedAt';
	const DEFAULT_DIR: 'asc' | 'desc' = 'desc';

	const SURVEY_STATE_VALUES: readonly SurveyState[] = [
		'draft',
		'in_progress',
		'submitted',
		'verified',
		'rejected',
		'cancelled'
	];

	const SORTABLE_KEYS: ReadonlySet<string> = new Set([
		'caption',
		'appointmentAt',
		'status',
		'updatedAt'
	]);

	interface Column {
		key: string;
		label: string;
		sortable?: boolean;
		align?: 'start' | 'end';
	}

	interface ListUrlState {
		q: string;
		project: string;
		status: SurveyState | 'all';
		surveyor: string;
		from: string;
		to: string;
		sort: SurveySort;
		dir: 'asc' | 'desc';
		page: number;
	}

	const COLUMNS: Column[] = [
		{ key: 'caption', label: 'Survey', sortable: true },
		{ key: 'project', label: 'Project' },
		{ key: 'appointmentAt', label: 'Appointment', sortable: true },
		{ key: 'surveyorName', label: 'Surveyor' },
		{ key: 'status', label: 'Status', sortable: true },
		{ key: 'criticalUnverifiedCount', label: 'Critical', align: 'end' }
	];

	const STATE_OPTIONS = [
		{ value: 'all', label: 'All states' },
		{ value: 'draft', label: 'Draft' },
		{ value: 'in_progress', label: 'In progress' },
		{ value: 'submitted', label: 'Submitted' },
		{ value: 'verified', label: 'Verified' },
		{ value: 'rejected', label: 'Rejected' },
		{ value: 'cancelled', label: 'Cancelled' }
	];

	const user = $derived($sessionStore.user);
	const captureOnly = $derived(
		Boolean(user?.roles.includes(ROLES.SURVEYOR) && !user.roles.includes(ROLES.PRODUCTION_MANAGER))
	);
	const canApprove = $derived(
		Boolean(user && hasPermission(user.permissions, PERMISSIONS.SURVEY_APPROVE))
	);

	function isSurveyState(value: string | null): value is SurveyState {
		return value !== null && SURVEY_STATE_VALUES.includes(value as SurveyState);
	}

	function readState(value: string | null): SurveyState | 'all' {
		return isSurveyState(value) ? value : 'all';
	}

	function readId(value: string | null): string {
		return isUuid(value) ? value : 'all';
	}

	function readDate(value: string | null): string {
		return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
	}

	function readSort(value: string | null): SurveySort {
		return value !== null && SORTABLE_KEYS.has(value) ? (value as SurveySort) : DEFAULT_SORT;
	}

	function readDir(value: string | null): 'asc' | 'desc' {
		return value === 'asc' || value === 'desc' ? value : DEFAULT_DIR;
	}

	function readPage(value: string | null): number {
		const parsed = Number.parseInt(value ?? '', 10);
		if (!Number.isInteger(parsed) || parsed < 1) return 1;
		return Math.min(parsed, PAGE_LIMIT);
	}

	function readUrl(params: URLSearchParams): ListUrlState {
		return {
			q: params.get('q') ?? '',
			project: readId(params.get('project')),
			status: readState(params.get('status')),
			surveyor: readId(params.get('surveyor')),
			from: readDate(params.get('from')),
			to: readDate(params.get('to')),
			sort: readSort(params.get('sort')),
			dir: readDir(params.get('dir')),
			page: readPage(params.get('page'))
		};
	}

	function buildHref(state: ListUrlState): string {
		const params = new URLSearchParams();
		const search = state.q.trim();
		if (search.length > 0) params.set('q', search);
		if (state.project !== 'all') params.set('project', state.project);
		if (state.status !== 'all') params.set('status', state.status);
		if (state.surveyor !== 'all') params.set('surveyor', state.surveyor);
		if (state.from !== '') params.set('from', state.from);
		if (state.to !== '') params.set('to', state.to);
		params.set('sort', state.sort);
		params.set('dir', state.dir);
		if (state.page > 1) params.set('page', String(state.page));
		return `/surveys?${params.toString()}`;
	}

	function applyUrl(next: ListUrlState): void {
		const target = buildHref(next);
		if (target === `${page.url.pathname}${page.url.search}`) return;
		void goto(resolve(target as Pathname), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	const urlState = $derived.by(() => readUrl(page.url.searchParams));

	let query = $derived(urlState.q);
	let rows = $state<SurveyListRow[]>([]);
	let total = $state(0);
	let hasMore = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let projects = $state<{ id: string; caption: string; reference: string }[]>([]);
	let projectsError = $state<string | null>(null);
	let surveyors = $state<{ id: string; displayName: string }[]>([]);
	let surveyorsNote = $state<string | null>(null);

	let formOpen = $state(false);
	let requestSequence = 0;

	const hasFilters = $derived(
		urlState.q.trim().length > 0 ||
			urlState.project !== 'all' ||
			urlState.status !== 'all' ||
			urlState.surveyor !== 'all' ||
			urlState.from !== '' ||
			urlState.to !== ''
	);

	const projectOptions = $derived.by(() => {
		const options = [
			{ value: 'all', label: 'All projects' },
			...projects.map((project) => ({
				value: project.id,
				label: `${project.caption} · ${project.reference}`
			}))
		];
		if (urlState.project !== 'all' && !projects.some((row) => row.id === urlState.project)) {
			options.push({ value: urlState.project, label: 'Selected project' });
		}
		return options;
	});

	const surveyorOptions = $derived.by(() => {
		const options = [
			{ value: 'all', label: 'All surveyors' },
			...surveyors.map((surveyor) => ({ value: surveyor.id, label: surveyor.displayName }))
		];
		if (urlState.surveyor !== 'all' && !surveyors.some((row) => row.id === urlState.surveyor)) {
			options.push({ value: urlState.surveyor, label: 'Selected surveyor' });
		}
		return options;
	});

	$effect(() => {
		void load(urlState);
	});

	$effect(() => {
		void loadFilters();
	});

	async function loadFilters(): Promise<void> {
		projectsError = null;
		try {
			const pageResult = await projectsApi.list({ pageSize: 100, status: 'active' });
			projects = pageResult.items.map((row) => ({
				id: row.id,
				caption: row.caption,
				reference: row.reference
			}));
		} catch (caught) {
			projects = [];
			projectsError = isApiError(caught)
				? caught.message
				: 'We could not load projects. Try again.';
		}

		surveyorsNote = null;
		try {
			const firstPage = await projectsApi.list({ page: 1, pageSize: 1 });
			const firstProject = firstPage.items[0];
			if (!firstProject) {
				surveyors = [];
				surveyorsNote = 'No surveyors are available to filter yet.';
				return;
			}
			const pool = await projectsApi.assignableSurveyors(firstProject.id);
			surveyors = pool.map((surveyor) => ({
				id: surveyor.id,
				displayName: surveyor.displayName
			}));
		} catch (caught) {
			surveyors = [];
			surveyorsNote = isApiError(caught)
				? caught.message
				: 'We could not load the surveyor filter. Try again.';
		}
	}

	async function load(state: ListUrlState): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;

		try {
			const result = await surveysApi.list({
				search: state.q.trim().length > 0 ? state.q.trim() : undefined,
				projectId: state.project === 'all' ? null : state.project,
				status: state.status,
				surveyorId: state.surveyor === 'all' ? null : state.surveyor,
				scope: captureOnly ? 'mine' : 'all',
				appointmentFrom: state.from === '' ? null : state.from,
				appointmentTo: state.to === '' ? null : state.to,
				sort: state.sort,
				sortDir: state.dir,
				page: 1,
				pageSize: Math.min(state.page * PAGE_SIZE, MAX_PAGE_SIZE)
			});
			if (sequence !== requestSequence) return;
			rows = result.items;
			total = result.total;
			hasMore = result.hasMore;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			rows = [];
			total = 0;
			hasMore = false;
			error = isApiError(caught) ? caught.message : 'We could not load surveys. Try again.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	function reload(): void {
		void load(urlState);
	}

	function updateFilters(patch: Partial<ListUrlState>): void {
		applyUrl({ ...urlState, ...patch, page: patch.page ?? 1 });
	}

	function handleSort(key: string): void {
		if (!SORTABLE_KEYS.has(key)) return;
		const sort = key as SurveySort;
		const dir =
			urlState.sort === sort
				? urlState.dir === 'asc'
					? 'desc'
					: 'asc'
				: sort === 'updatedAt'
					? 'desc'
					: 'asc';
		updateFilters({ sort, dir });
	}

	function loadMore(): void {
		if (loading || !hasMore) return;
		applyUrl({ ...urlState, page: Math.min(urlState.page + 1, PAGE_LIMIT) });
	}

	function resetFilters(): void {
		applyUrl({
			q: '',
			project: 'all',
			status: 'all',
			surveyor: 'all',
			from: '',
			to: '',
			sort: DEFAULT_SORT,
			dir: DEFAULT_DIR,
			page: 1
		});
	}

	function handleSaved(saved: { id: string; caption: string }): void {
		toast.success(`${saved.caption} created.`);
		void goto(resolve(`/surveys/${saved.id}` as Pathname));
	}

	function verifyHref(id: string): string {
		return resolve(`/surveys/${id}/verify` as Pathname);
	}
</script>

<svelte:head>
	<title>Surveys · Interio</title>
</svelte:head>

{#snippet plusIcon()}
	<Plus size={20} strokeWidth={1.75} aria-hidden="true" />
{/snippet}

{#snippet headerActions()}
	<PermissionGate permission={PERMISSIONS.SURVEY_CREATE}>
		<Button variant="primary" icon={plusIcon} onclick={() => (formOpen = true)}>New survey</Button>
	</PermissionGate>
{/snippet}

{#snippet cell({ row, column }: { row: SurveyListRow; column: Column })}
	{#if column.key === 'caption'}
		<div class="flex min-w-0 flex-col gap-0.5">
			<EntityLink
				href={resolve(`/surveys/${row.id}` as Pathname)}
				class="inline-flex min-h-target items-center break-words"
			>
				{row.caption}
			</EntityLink>
			<span class="text-footnote text-ink-tertiary">{row.projectReference}</span>
		</div>
	{:else if column.key === 'project'}
		<div class="flex min-w-0 flex-col gap-0.5">
			<EntityLink
				href={resolve(`/projects/${row.projectId}` as Pathname)}
				class="inline-flex min-h-target items-center break-words"
			>
				{row.projectCaption}
			</EntityLink>
			<span class="text-footnote text-ink-tertiary">{row.propertyAddress}</span>
		</div>
	{:else if column.key === 'appointmentAt'}
		<time datetime={row.appointmentAt}>{formatDateTime(row.appointmentAt)}</time>
	{:else if column.key === 'surveyorName'}
		<span class="break-words">{row.surveyorName}</span>
	{:else if column.key === 'status'}
		<StateChip entity="survey" state={row.status} />
	{:else if column.key === 'criticalUnverifiedCount'}
		{#if row.criticalUnverifiedCount > 0}
			<span class="text-caution-ink">
				{formatCount(row.criticalUnverifiedCount)} unverified
			</span>
		{:else}
			<span class="text-ink-tertiary">None</span>
		{/if}
	{/if}
{/snippet}

{#snippet rowActions(row: SurveyListRow)}
	<EntityLink
		href={resolve(`/surveys/${row.id}` as Pathname)}
		class="inline-flex min-h-target min-w-target items-center justify-center"
	>
		Open
	</EntityLink>
	{#if row.status === 'submitted' && canApprove}
		<EntityLink
			href={verifyHref(row.id)}
			class="inline-flex min-h-target min-w-target items-center justify-center"
		>
			Verify
		</EntityLink>
	{/if}
{/snippet}

<PageHeader
	title="Surveys"
	description={captureOnly
		? 'Surveys assigned to you on the projects you are working on.'
		: 'Every site capture, its progress and its verification state.'}
	actions={headerActions}
/>

<div class="flex flex-col gap-3 pt-6 pb-4">
	<div class="flex flex-col gap-3 md:flex-row md:items-end">
		<SearchInput
			label="Search surveys"
			bind:value={query}
			placeholder="Caption, project, customer or surveyor"
			onsearch={(value) => updateFilters({ q: value })}
			class="md:flex-1"
		/>

		<Select
			label="Project"
			value={urlState.project}
			options={projectOptions}
			hint={projectsError ?? undefined}
			onchange={(event) =>
				updateFilters({ project: (event.currentTarget as HTMLSelectElement).value })}
			class="md:w-72"
		/>

		<Select
			label="Status"
			value={urlState.status}
			options={STATE_OPTIONS}
			onchange={(event) =>
				updateFilters({ status: readState((event.currentTarget as HTMLSelectElement).value) })}
			class="md:w-44"
		/>

		<Select
			label="Surveyor"
			value={urlState.surveyor}
			options={surveyorOptions}
			hint={surveyorsNote ?? undefined}
			onchange={(event) =>
				updateFilters({ surveyor: (event.currentTarget as HTMLSelectElement).value })}
			class="md:w-56"
		/>
	</div>

	<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
		<Input
			label="Appointment from"
			type="date"
			value={urlState.from}
			onchange={(event) =>
				updateFilters({ from: readDate((event.currentTarget as HTMLInputElement).value) })}
			class="sm:w-48"
		/>
		<Input
			label="Appointment to"
			type="date"
			value={urlState.to}
			onchange={(event) =>
				updateFilters({ to: readDate((event.currentTarget as HTMLInputElement).value) })}
			class="sm:w-48"
		/>
		{#if hasFilters}
			<Button variant="tertiary" onclick={resetFilters}>Clear filters</Button>
		{/if}
	</div>
</div>

<section
	aria-labelledby="surveys-heading"
	class="flex flex-col gap-4"
	aria-busy={loading ? 'true' : undefined}
>
	<h2 id="surveys-heading" class="sr-only">Survey list</h2>

	<p class="sr-only" role="status" aria-live="polite">
		{loading
			? 'Loading surveys.'
			: `${formatCount(total)} ${total === 1 ? 'survey' : 'surveys'} match this view.`}
	</p>

	{#if loading}
		<DataTable
			caption="Surveys"
			columns={COLUMNS}
			rows={[]}
			rowKey={(row) => row.id}
			{cell}
			actions={rowActions}
			loading
			density="compact"
		/>
	{:else if error}
		<div
			role="alert"
			class="flex flex-col items-start gap-3 rounded-lg border border-hairline bg-canvas p-4"
		>
			<p class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{error}</span>
			</p>
			<Button variant="secondary" onclick={reload}>Try again</Button>
		</div>
	{:else if rows.length === 0}
		<EmptyState
			title={hasFilters ? 'No surveys match these filters.' : 'No surveys yet.'}
			description={hasFilters
				? 'Clear the search, project, status, surveyor or appointment filter to see every survey.'
				: captureOnly
					? 'No survey is assigned to you yet. A production manager assigns surveyors to projects.'
					: 'Create the first survey to plan a site visit and start capturing.'}
		>
			{#snippet action()}
				{#if hasFilters}
					<Button variant="secondary" onclick={resetFilters}>Clear filters</Button>
				{:else}
					<PermissionGate permission={PERMISSIONS.SURVEY_CREATE}>
						<Button variant="primary" icon={plusIcon} onclick={() => (formOpen = true)}>
							New survey
						</Button>
					</PermissionGate>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<DataTable
			caption="Surveys"
			columns={COLUMNS}
			{rows}
			rowKey={(row) => row.id}
			{cell}
			actions={rowActions}
			sort={{ key: urlState.sort, dir: urlState.dir }}
			onSort={handleSort}
			density="compact"
		/>

		<p class="text-footnote text-ink-secondary" role="status" aria-live="polite">
			Showing {formatCount(rows.length)} of {formatCount(total)}
			{total === 1 ? 'survey' : 'surveys'}.
		</p>

		<Pagination
			{hasMore}
			onLoadMore={loadMore}
			totalLabel={`${formatCount(total)} ${total === 1 ? 'survey' : 'surveys'}`}
		/>
	{/if}
</section>

<SurveyFormDialog bind:open={formOpen} onSaved={handleSaved} onClose={() => (formOpen = false)} />
