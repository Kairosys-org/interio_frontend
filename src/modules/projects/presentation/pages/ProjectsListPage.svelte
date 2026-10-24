<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { Plus } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import {
		PROJECT_STATUSES,
		PROJECT_TYPES,
		PROJECT_TYPE_LABELS
	} from '$shared/domain/record-states';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { formatDate } from '$shared/lib/format';
	import { stateLabel } from '$shared/lib/status';
	import {
		Badge,
		DataTable,
		EmptyState,
		PageHeader,
		Pagination,
		PermissionGate,
		SearchInput,
		Select,
		StateChip
	} from '$shared/presentation/ui';
	import { projectsApi } from '../../data/api';
	import type { ProjectListRow, ProjectSort, ProjectStatus, ProjectType } from '../../domain/types';

	const PAGE_SIZE = 10;
	const DEFAULT_SORT: ProjectSort = 'createdAt';
	const DEFAULT_DIR: 'asc' | 'desc' = 'desc';

	interface TableColumn {
		key: string;
		label: string;
		sortable?: boolean;
		align?: 'start' | 'end';
	}

	interface ListUrlState {
		q: string;
		type: ProjectType | 'all';
		status: ProjectStatus | 'all';
		surveyor: string;
		sort: ProjectSort;
		dir: 'asc' | 'desc';
		page: number;
	}

	interface SurveyorChoice {
		id: string;
		displayName: string;
	}

	const SORTABLE_KEYS: ReadonlySet<string> = new Set([
		'caption',
		'reference',
		'status',
		'createdAt'
	]);

	const columns: TableColumn[] = [
		{ key: 'caption', label: 'Project', sortable: true },
		{ key: 'customer', label: 'Customer' },
		{ key: 'property', label: 'Property' },
		{ key: 'projectType', label: 'Type' },
		{ key: 'status', label: 'Status', sortable: true },
		{ key: 'surveyors', label: 'Surveyors' }
	];

	const typeOptions = [
		{ value: 'all', label: 'All types' },
		...PROJECT_TYPES.map((type) => ({ value: type, label: PROJECT_TYPE_LABELS[type] }))
	];

	const statusOptions = [
		{ value: 'all', label: 'All statuses' },
		...PROJECT_STATUSES.map((status) => ({ value: status, label: stateLabel(status) }))
	];

	function parseType(value: string | null): ProjectType | 'all' {
		return value !== null && (PROJECT_TYPES as readonly string[]).includes(value)
			? (value as ProjectType)
			: 'all';
	}

	function parseStatus(value: string | null): ProjectStatus | 'all' {
		return value !== null && (PROJECT_STATUSES as readonly string[]).includes(value)
			? (value as ProjectStatus)
			: 'all';
	}

	function parseSort(value: string | null): ProjectSort {
		return value !== null && SORTABLE_KEYS.has(value) ? (value as ProjectSort) : DEFAULT_SORT;
	}

	function parseDir(value: string | null): 'asc' | 'desc' {
		return value === 'asc' ? 'asc' : DEFAULT_DIR;
	}

	function parsePage(value: string | null): number {
		const parsed = Number(value);
		if (!Number.isInteger(parsed) || parsed < 1) return 1;
		return Math.min(parsed, 10);
	}

	/** URL is the single source of truth for every filter (DESIGN §10.3). */
	function readUrl(params: URLSearchParams): ListUrlState {
		return {
			q: params.get('q') ?? '',
			type: parseType(params.get('type')),
			status: parseStatus(params.get('status')),
			surveyor: params.get('surveyor') ?? 'all',
			sort: parseSort(params.get('sort')),
			dir: parseDir(params.get('dir')),
			page: parsePage(params.get('page'))
		};
	}

	function buildQuery(state: ListUrlState): string {
		const params = new SvelteURLSearchParams();
		const search = state.q.trim();
		if (search.length > 0) params.set('q', search);
		if (state.type !== 'all') params.set('type', state.type);
		if (state.status !== 'all') params.set('status', state.status);
		if (state.surveyor !== 'all') params.set('surveyor', state.surveyor);
		if (state.sort !== DEFAULT_SORT) params.set('sort', state.sort);
		if (state.dir !== DEFAULT_DIR) params.set('dir', state.dir);
		if (state.page > 1) params.set('page', String(state.page));
		return params.toString();
	}

	function applyUrl(next: ListUrlState): void {
		const suffix = buildQuery(next);
		const target = suffix.length > 0 ? `/projects?${suffix}` : '/projects';
		if (target === `${page.url.pathname}${page.url.search}`) return;
		void goto(suffix.length > 0 ? resolve(`/projects?${suffix}`) : resolve('/projects'), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	const urlState = $derived.by(() => readUrl(page.url.searchParams));

	let rows = $state<ProjectListRow[]>([]);
	let total = $state(0);
	let currentPage = $state(1);
	let hasMore = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let surveyors = $state<SurveyorChoice[]>([]);
	let surveyorsLoading = $state(true);
	let surveyorsNote = $state<string | null>(null);

	let requestSequence = 0;

	const hasFilters = $derived(
		urlState.q.trim().length > 0 ||
			urlState.type !== 'all' ||
			urlState.status !== 'all' ||
			urlState.surveyor !== 'all'
	);

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

	/** One load per URL state; a reload restores the same page. */
	$effect(() => {
		void load(urlState);
	});

	/**
	 * The surveyor filter needs the tenant-wide pool, but the only endpoint
	 * that returns it (`assignableSurveyors`) is keyed by an existing project.
	 * Ask the first listed project once: the mock returns every active
	 * Surveyor in the tenant, with `assigned` relative to that project. This
	 * is the reported backend gap in the phase-1 wizard notes.
	 */
	$effect(() => {
		void loadSurveyorOptions();
	});

	async function loadSurveyorOptions(): Promise<void> {
		surveyorsLoading = true;
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
		} finally {
			surveyorsLoading = false;
		}
	}

	async function load(state: ListUrlState): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;

		const collected: ProjectListRow[] = [];
		let result = null;
		let loadedPage = 1;

		try {
			for (let index = 1; index <= state.page; index += 1) {
				result = await projectsApi.list({
					search: state.q.trim().length > 0 ? state.q.trim() : undefined,
					type: state.type,
					status: state.status,
					surveyorId: state.surveyor === 'all' ? null : state.surveyor,
					sort: state.sort,
					sortDir: state.dir,
					page: index,
					pageSize: PAGE_SIZE
				});
				collected.push(...result.items);
				loadedPage = result.page;
				if (!result.hasMore) break;
			}

			if (sequence !== requestSequence) return;
			rows = collected;
			total = result?.total ?? 0;
			currentPage = loadedPage;
			hasMore = result?.hasMore ?? false;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			rows = [];
			total = 0;
			hasMore = false;
			error = isApiError(caught) ? caught.message : 'We could not load projects. Try again.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	function updateFilters(patch: Partial<ListUrlState>): void {
		applyUrl({
			...urlState,
			...patch,
			page: patch.page ?? 1
		});
	}

	function handleSort(key: string): void {
		if (!SORTABLE_KEYS.has(key)) return;
		const sort = key as ProjectSort;
		const dir =
			urlState.sort === sort
				? urlState.dir === 'asc'
					? 'desc'
					: 'asc'
				: sort === 'createdAt'
					? 'desc'
					: 'asc';
		updateFilters({ sort, dir });
	}

	function loadMore(): void {
		if (loading || !hasMore) return;
		applyUrl({ ...urlState, page: Math.min(currentPage + 1, 10) });
	}

	function resetFilters(): void {
		applyUrl({
			q: '',
			type: 'all',
			status: 'all',
			surveyor: 'all',
			sort: DEFAULT_SORT,
			dir: DEFAULT_DIR,
			page: 1
		});
	}

	function retry(): void {
		void load(urlState);
	}
</script>

<svelte:head>
	<title>Projects · Interio</title>
</svelte:head>

{#snippet newProjectAction()}
	<PermissionGate permission={PERMISSIONS.PROJECT_CREATE}>
		<a
			href={resolve('/projects/new')}
			class="inline-flex min-h-target min-w-target touch-manipulation items-center justify-center gap-2 rounded-md bg-brand px-4 text-subheadline whitespace-nowrap text-on-brand select-none hover:bg-brand-hover"
		>
			<Plus size={20} strokeWidth={1.75} aria-hidden="true" />
			New project
		</a>
	</PermissionGate>
{/snippet}

<PageHeader
	title="Projects"
	description="Every customer engagement, from enquiry through installation."
>
	{#snippet actions()}
		{@render newProjectAction()}
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-3 pt-6 pb-6 md:flex-row md:flex-wrap md:items-end">
	<SearchInput
		label="Search projects"
		value={urlState.q}
		placeholder="Caption, reference, customer or address"
		onsearch={(value) => updateFilters({ q: value })}
		debounceMs={250}
		class="md:min-w-64 md:flex-1"
	/>

	<Select
		label="Type"
		value={urlState.type}
		options={typeOptions}
		onchange={(event) =>
			updateFilters({
				type: parseType((event.currentTarget as HTMLSelectElement).value)
			})}
		class="md:w-44"
	/>

	<Select
		label="Status"
		value={urlState.status}
		options={statusOptions}
		onchange={(event) =>
			updateFilters({
				status: parseStatus((event.currentTarget as HTMLSelectElement).value)
			})}
		class="md:w-44"
	/>

	<Select
		label="Surveyor"
		value={urlState.surveyor}
		options={surveyorOptions}
		disabled={surveyorsLoading}
		hint={surveyorsNote ?? undefined}
		onchange={(event) =>
			updateFilters({
				surveyor: (event.currentTarget as HTMLSelectElement).value
			})}
		class="md:w-52"
	/>
</div>

<section aria-labelledby="projects-list-heading" class="flex flex-col gap-4">
	<h2 id="projects-list-heading" class="sr-only">Project list</h2>

	{#if error}
		<EmptyState title="We could not load projects." description={error}>
			{#snippet action()}
				<button
					type="button"
					onclick={retry}
					class="inline-flex min-h-target min-w-target items-center justify-center rounded-md border border-hairline-strong bg-canvas px-4 text-subheadline text-ink hover:bg-canvas-grouped"
				>
					Try again
				</button>
			{/snippet}
		</EmptyState>
	{:else if loading}
		<DataTable
			caption="Projects"
			{columns}
			rows={[]}
			rowKey={(row) => row.id}
			loading
			density="compact"
		>
			{#snippet cell({ row }: { row: ProjectListRow; column: TableColumn })}
				<span class="sr-only">{row.caption}</span>
			{/snippet}
		</DataTable>
	{:else if rows.length === 0}
		<EmptyState
			title={hasFilters ? 'No projects match these filters.' : 'No projects yet.'}
			description={hasFilters
				? 'Clear the search or filters to see every project.'
				: 'Create the first project to start the pipeline.'}
		>
			{#snippet action()}
				{#if hasFilters}
					<button
						type="button"
						onclick={resetFilters}
						class="inline-flex min-h-target min-w-target items-center justify-center rounded-md border border-hairline-strong bg-canvas px-4 text-subheadline text-ink hover:bg-canvas-grouped"
					>
						Clear filters
					</button>
				{:else}
					{@render newProjectAction()}
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<DataTable
			caption="Projects"
			{columns}
			{rows}
			rowKey={(row) => row.id}
			sort={{ key: urlState.sort, dir: urlState.dir }}
			onSort={handleSort}
			density="compact"
		>
			{#snippet cell({ row, column }: { row: ProjectListRow; column: TableColumn })}
				{#if column.key === 'caption'}
					<a
						href={resolve(`/projects/${row.id}`)}
						class="inline-flex min-h-target flex-col justify-center rounded-sm"
					>
						<span class="text-callout break-words text-brand underline underline-offset-2">
							{row.caption}
						</span>
					</a>
				{:else if column.key === 'reference'}
					<span class="font-mono text-footnote text-ink-secondary">{row.reference}</span>
				{:else if column.key === 'customer'}
					<span class="text-callout break-words text-ink">{row.customerCaption}</span>
				{:else if column.key === 'property'}
					<span class="text-callout break-words text-ink-secondary">{row.propertyAddress}</span>
				{:else if column.key === 'projectType'}
					<span class="text-callout text-ink">{PROJECT_TYPE_LABELS[row.projectType]}</span>
				{:else if column.key === 'status'}
					<span class="inline-flex flex-wrap items-center gap-2">
						<StateChip entity="project" state={row.status} />
						{#if row.state === 'pending_review'}
							<Badge label="Needs review" tone="warning" />
						{/if}
					</span>
				{:else if column.key === 'surveyors'}
					{#if row.surveyorNames.length > 0}
						<span class="text-callout break-words text-ink">{row.surveyorNames.join(', ')}</span>
					{:else}
						<span class="text-callout text-ink-tertiary">Unassigned</span>
					{/if}
				{:else if column.key === 'createdAt'}
					<span class="text-callout text-ink-secondary tabular-nums">
						{formatDate(row.createdAt)}
					</span>
				{/if}
			{/snippet}
		</DataTable>

		<Pagination
			{hasMore}
			onLoadMore={loadMore}
			totalLabel={`${total} ${total === 1 ? 'project' : 'projects'}`}
		/>
	{/if}
</section>
