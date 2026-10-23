<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { CircleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { sessionStore } from '$shared/application/session';
	import type { AuditTrailRow } from '$shared/domain/audit';
	import { PERMISSIONS, hasPermission } from '$shared/domain/permissions';
	import { isUuid } from '$shared/domain/uuid';
	import { formatCount, formatDateTime, formatDimension, formatPercent } from '$shared/lib/format';
	import {
		Accordion,
		AuditTrailTab,
		Badge,
		Breadcrumb,
		Button,
		ChecklistDrawer,
		DetailSection,
		EmptyState,
		EntityLink,
		ForbiddenPage,
		GateBanner,
		KeyValueGrid,
		MediaGrid,
		Menu,
		PageHeader,
		Progress,
		Skeleton,
		StateChip,
		type ChecklistSection,
		type MediaItem
	} from '$shared/presentation/ui';
	import { surveysApi } from '../../data/api';
	import type {
		SurveyAction,
		SurveyChecklist,
		SurveyDetail,
		SurveyMeasurement,
		SurveyMediaItem
	} from '../../domain/types';
	import { measurementTargetLabel, NOTE_CATEGORY_LABELS, ROOM_TYPE_LABELS } from '../survey-labels';
	import { canRunSurveyAction, surveyActionsFor } from '../transitions';
	import MeasurementRow from '../components/MeasurementRow.svelte';
	import RoomBoard from '../components/RoomBoard.svelte';
	import RoomDetails from '../components/RoomDetails.svelte';
	import SectionNav from '../components/SectionNav.svelte';
	import SurveyTransitionDialog from '../components/SurveyTransitionDialog.svelte';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	const TRANSITION_TOAST: Readonly<Record<SurveyAction, string>> = Object.freeze({
		start: 'Survey capture started.',
		submit: 'Survey submitted for verification.',
		verify: 'Survey verified.',
		reject: 'Survey rejected and returned to the surveyor.',
		reopen: 'Survey reopened. Every measurement must be verified again.',
		cancel: 'Survey cancelled.',
		resume: 'Survey resumed for capture.'
	});

	const ACTION_LABELS: Readonly<Record<SurveyAction, string>> = Object.freeze({
		start: 'Start capture',
		submit: 'Submit survey',
		verify: 'Verify survey',
		reject: 'Reject survey',
		reopen: 'Reopen survey',
		cancel: 'Cancel survey',
		resume: 'Resume capture'
	});

	let detail = $state<SurveyDetail | null>(null);
	let checklist = $state<SurveyChecklist | null>(null);
	let checklistLoading = $state(false);
	let checklistError = $state<string | null>(null);

	let auditRows = $state<AuditTrailRow[]>([]);
	let auditLoading = $state(false);
	let auditError = $state<string | null>(null);

	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);

	let checklistOpen = $state(false);
	let transitionOpen = $state(false);
	let transitionAction = $state<SurveyAction | null>(null);
	let transitionSaving = $state(false);
	let transitionError = $state<string | null>(null);

	let requestSequence = 0;
	let auditSequence = 0;

	const user = $derived($sessionStore.user);
	const validId = $derived(isUuid(id));

	const survey = $derived(detail?.survey ?? null);
	const rooms = $derived(detail?.rooms ?? []);

	const availableActions = $derived(
		survey ? surveyActionsFor(user, survey.status) : ([] as SurveyAction[])
	);

	const canApprove = $derived(
		Boolean(user && hasPermission(user.permissions, PERMISSIONS.SURVEY_APPROVE))
	);

	const breadcrumb = $derived([
		{ label: 'Surveys', href: resolve('/surveys') },
		{ label: survey?.caption ?? 'Survey' }
	]);

	const verifyHref = $derived(
		survey ? resolve(`/surveys/${survey.id}/verify`) : resolve('/surveys')
	);
	const mediaHref = $derived(survey ? resolve(`/surveys/${survey.id}/media`) : resolve('/surveys'));

	const measurements = $derived.by(() => {
		if (!detail) return [] as Array<{ measurement: SurveyMeasurement; roomCaption: string }>;
		return detail.rooms.flatMap((tree) =>
			tree.measurements.map((measurement) => ({
				measurement,
				roomCaption: tree.room.caption
			}))
		);
	});

	const criticalMeasurements = $derived(
		measurements.filter((entry) => entry.measurement.isManufacturingCritical)
	);

	const criticalUnverified = $derived(
		criticalMeasurements.filter((entry) => entry.measurement.verifiedAt === null)
	);

	const orderedMeasurements = $derived([
		...criticalMeasurements,
		...measurements.filter((entry) => !entry.measurement.isManufacturingCritical)
	]);

	/** G8 is blocking once the survey is submitted; before that it is advice. */
	const gate = $derived.by(() => {
		if (!survey || criticalMeasurements.length === 0) return null;
		const state =
			criticalUnverified.length === 0
				? ('passed' as const)
				: survey.status === 'submitted'
					? ('blocking' as const)
					: ('warning' as const);
		return {
			id: 'G8',
			title: 'G8 · Manufacturing-critical measurements',
			state,
			reasons:
				criticalUnverified.length === 0
					? ['Every manufacturing-critical measurement is verified.']
					: criticalUnverified.map(
							(entry) =>
								`${entry.roomCaption}: ${measurementTargetLabel(entry.measurement)} · ${formatDimension(entry.measurement.valueMm)}`
						)
		};
	});

	const gates = $derived(gate ? [gate] : []);

	const checklistSections = $derived.by<ChecklistSection[]>(() => {
		if (!checklist) return [];
		const statusOf = (itemId: string, satisfied: boolean, blocking: boolean) => {
			if (satisfied) return 'pass' as const;
			if (!blocking) return 'pending' as const;
			if (itemId === 'critical_verified' && survey?.status !== 'submitted')
				return 'pending' as const;
			return 'fail' as const;
		};
		const rows = checklist.items.map((item) => ({
			id: item.id,
			label: item.label,
			status: statusOf(item.id, item.satisfied, item.blocking),
			detail: item.detail,
			blocking: item.blocking
		}));
		return [
			{
				id: 'structure',
				label: 'Rooms and geometry',
				rows: rows.filter((row) =>
					['rooms', 'room_dimensions', 'openings', 'geometry'].includes(row.id)
				)
			},
			{
				id: 'media',
				label: 'Media',
				rows: rows.filter((row) => ['media_uploaded', 'room_photos'].includes(row.id))
			},
			{
				id: 'verification',
				label: 'Assignment and verification',
				rows: rows.filter((row) => ['assignment', 'critical_verified'].includes(row.id))
			}
		];
	});

	const blockerCount = $derived(
		checklistSections.flatMap((section) => section.rows).filter((row) => row.status === 'fail')
			.length
	);

	const ownerLabels = $derived.by(() => {
		if (!detail) return new Map<string, string>();
		const entries: Array<[string, string]> = [[`survey:${detail.survey.id}`, 'Survey']];
		for (const tree of detail.rooms) {
			entries.push([`room:${tree.room.id}`, tree.room.caption]);
			for (const wall of tree.walls) {
				entries.push([`wall:${wall.id}`, `${tree.room.caption} · ${wall.caption}`]);
			}
			for (const opening of tree.openings) {
				entries.push([
					`opening:${opening.id}`,
					`${tree.room.caption} · ${opening.caption ?? 'Opening'}`
				]);
			}
		}
		return new Map(entries);
	});

	const mediaItems = $derived.by<MediaItem[]>(() => {
		if (!detail) return [];
		return detail.media.map((item) => toMediaItem(item, ownerLabels));
	});

	const mediaSummary = $derived.by(() => {
		const media = detail?.media ?? [];
		return {
			complete: media.filter((item) => item.uploadState === 'complete').length,
			pending: media.filter(
				(item) => item.uploadState === 'pending' || item.uploadState === 'uploading'
			).length,
			failed: media.filter((item) => item.uploadState === 'failed').length
		};
	});

	const roomNotes = $derived(rooms.reduce((total, tree) => total + tree.notes.length, 0));

	const detailItems = $derived.by(() => {
		if (!detail || !survey) return [];
		const property = detail.property;
		const address = property
			? [property.addressLine1, property.addressLine2, property.town, property.postcode]
					.filter((value): value is string => Boolean(value))
					.join(', ')
			: null;
		return [
			{
				label: 'Project',
				value: detail.project.caption,
				href: resolve(`/projects/${detail.project.id}`)
			},
			{ label: 'Reference', value: detail.project.reference, mono: true },
			{ label: 'Customer', value: detail.customer?.caption ?? null },
			{ label: 'Property', value: address },
			{ label: 'Appointment', value: formatDateTime(survey.appointmentAt) },
			{ label: 'Submitted', value: survey.submittedAt ? formatDateTime(survey.submittedAt) : null },
			{ label: 'Verified', value: survey.verifiedAt ? formatDateTime(survey.verifiedAt) : null },
			{
				label: 'Reopened',
				value: survey.reopenCount === 0 ? null : `${formatCount(survey.reopenCount)} times`
			}
		];
	});

	const sectionLinks = $derived([
		{ id: 'rooms', label: 'Rooms', count: rooms.length },
		{ id: 'measurements', label: 'Measurements', count: measurements.length },
		{ id: 'notes', label: 'Notes', count: (detail?.surveyNotes.length ?? 0) + roomNotes },
		{ id: 'media', label: 'Media', count: mediaItems.length }
	]);

	const accordionItems = $derived(
		rooms.map((tree) => ({
			id: tree.room.id,
			title: tree.room.caption,
			description: `${ROOM_TYPE_LABELS[tree.room.roomType]} · ${tree.walls.length} walls · ${tree.openings.length} openings · ${tree.measurements.length} measurements`
		}))
	);

	const roomById = $derived(new Map(rooms.map((tree) => [tree.room.id, tree])));

	const primaryAction = $derived.by<SurveyAction | null>(() => {
		if (availableActions.includes('submit')) return 'submit';
		if (availableActions.includes('verify')) return 'verify';
		if (availableActions.includes('start')) return 'start';
		if (availableActions.includes('resume')) return 'resume';
		return null;
	});

	const menuActions = $derived(
		availableActions.filter((action) => action !== primaryAction && action !== 'submit')
	);

	const menuItems = $derived(
		menuActions.map((action) => ({
			label: ACTION_LABELS[action],
			danger: action === 'cancel' || action === 'reject',
			onSelect: () => openTransition(action)
		}))
	);

	$effect(() => {
		const value = id;
		if (!isUuid(value)) {
			requestSequence += 1;
			loading = false;
			detail = null;
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
			const result = await surveysApi.get(value);
			if (sequence !== requestSequence) return;
			detail = result;
			void loadChecklist(value);
			void loadAudit(value);
		} catch (caught) {
			if (sequence !== requestSequence) return;
			detail = null;
			if (isApiError(caught) && caught.isNotFound()) {
				notFound = true;
			} else {
				error = isApiError(caught) ? caught.message : 'We could not load this survey. Try again.';
			}
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	async function loadChecklist(value: string): Promise<void> {
		checklistLoading = true;
		checklistError = null;
		try {
			checklist = await surveysApi.checklist(value);
		} catch (caught) {
			checklist = null;
			checklistError = isApiError(caught)
				? caught.message
				: 'We could not load the submission checklist.';
		} finally {
			checklistLoading = false;
		}
	}

	async function loadAudit(value: string): Promise<void> {
		const sequence = ++auditSequence;
		auditLoading = true;
		auditError = null;
		try {
			const rows = await surveysApi.audit(value);
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

	async function refresh(): Promise<void> {
		const value = id;
		if (!isUuid(value)) return;
		try {
			detail = await surveysApi.get(value);
		} catch (caught) {
			error = isApiError(caught) ? caught.message : 'We could not refresh this survey. Try again.';
			return;
		}
		void loadChecklist(value);
		void loadAudit(value);
	}

	function retry(): void {
		void load(id);
	}

	function retryAudit(): void {
		void loadAudit(id);
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
			toast.success(TRANSITION_TOAST[action]);
			transitionOpen = false;
			checklistOpen = false;
			await refresh();
		} catch (caught) {
			transitionError = isApiError(caught)
				? caught.message
				: 'We could not change this survey status. Try again.';
			throw caught;
		} finally {
			transitionSaving = false;
		}
	}

	async function openChecklist(): Promise<void> {
		checklistOpen = true;
		if (checklist || checklistLoading) return;
		await loadChecklist(id);
		if (!checklist) {
			checklistOpen = false;
			toast.error(checklistError ?? 'We could not load the submission checklist.');
		}
	}

	function handlePrimary(): void {
		const action = primaryAction;
		if (!action) return;
		if (action === 'submit') {
			void openChecklist();
			return;
		}
		if (action === 'verify') {
			void goto(resolve(`/surveys/${survey?.id ?? ''}/verify`));
			return;
		}
		openTransition(action);
	}

	function handleVerifyFromChecklist(): void {
		checklistOpen = false;
		void goto(resolve(`/surveys/${survey?.id ?? ''}/verify`));
	}

	function toMediaItem(item: SurveyMediaItem, labels: Map<string, string>): MediaItem {
		const ownerLabel = labels.get(`${item.ownerType}:${item.ownerId}`) ?? 'Survey media';
		const mimeType =
			item.assetKind === 'plan'
				? 'application/pdf'
				: item.assetKind === 'video'
					? 'video/mp4'
					: 'image/jpeg';
		return {
			id: item.id,
			fileName: item.caption?.trim() || `${item.assetKind}-${item.id.slice(0, 8)}`,
			caption: item.caption,
			kind: item.assetKind,
			mimeType,
			previewUrl: item.url,
			uploadState: item.uploadState,
			ownerLabel,
			alt: item.caption
		};
	}
</script>

<svelte:head>
	<title>{survey?.caption ? `${survey.caption} · Interio` : 'Survey · Interio'}</title>
</svelte:head>

{#if !validId}
	<ForbiddenPage
		variant="not-found"
		title="Survey not found."
		description="This survey does not exist or is no longer available."
		backHref={resolve('/surveys')}
		backLabel="Back to surveys"
	/>
{:else if loading}
	<div class="flex flex-col gap-6" aria-busy="true" aria-label="Loading survey">
		<h1 class="sr-only">Loading survey</h1>
		<Skeleton lines={1} class="max-w-content-reading" />
		<Skeleton variant="block" />
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
	<h1 class="sr-only">Survey</h1>
	<EmptyState title="We could not load this survey." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={retry}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	{@const loadedDetail = detail}
	{@const loadedSurvey = survey}
	{@const counts = loadedDetail.counts}

	<Breadcrumb items={breadcrumb} class="pb-4" />

	<PageHeader
		title={loadedSurvey.caption}
		description={`${loadedDetail.project.caption} · ${loadedDetail.project.reference}`}
	>
		{#snippet actions()}
			<div class="flex flex-wrap items-center gap-2">
				<StateChip entity="survey" state={loadedSurvey.status} />
				{#if loadedSurvey.reopenCount > 0}
					<Badge label={`Reopened ${loadedSurvey.reopenCount}×`} tone="warning" />
				{/if}

				<Button variant="secondary" onclick={openChecklist}>
					Checklist{checklist ? ` · ${blockerCount} blocking` : ''}
				</Button>

				{#if primaryAction}
					<Button variant="primary" onclick={handlePrimary}>
						{primaryAction === 'submit'
							? 'Submit survey'
							: primaryAction === 'verify'
								? 'Open verification'
								: ACTION_LABELS[primaryAction]}
					</Button>
				{/if}

				{#if menuItems.length > 0}
					<Menu label="More survey actions" items={menuItems} />
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<div class="mt-8 flex flex-col gap-4">
		{#if loadedSurvey.status === 'rejected' && loadedSurvey.rejectedReason}
			<section
				role="alert"
				class="flex flex-col gap-1 rounded-lg border border-critical bg-critical-soft p-4"
			>
				<h2 class="text-title-3 text-critical-ink">This survey was rejected.</h2>
				<p class="text-callout text-critical-ink">{loadedSurvey.rejectedReason}</p>
			</section>
		{/if}

		<GateBanner
			{gates}
			fixHref={loadedSurvey.status === 'submitted' && canApprove ? verifyHref : undefined}
			fixLabel="Open verification"
		/>

		{#if checklistError}
			<p
				role="alert"
				class="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-canvas p-4 text-callout text-ink-secondary"
			>
				<CircleAlert
					size={20}
					strokeWidth={1.75}
					aria-hidden="true"
					class="shrink-0 text-critical-ink"
				/>
				<span>{checklistError}</span>
				<Button variant="secondary" onclick={() => openChecklist()}>Try again</Button>
			</p>
		{/if}

		<DetailSection
			title="Progress"
			description="What has been captured, and what still blocks submission."
		>
			<Progress
				label="Required fields complete"
				value={counts.percent}
				valueLabel={`${formatPercent(counts.percent)} · ${formatCount(counts.requiredComplete)} of ${formatCount(counts.requiredTotal)}`}
			/>

			<KeyValueGrid
				columns={3}
				items={[
					{ label: 'Rooms', value: formatCount(counts.rooms) },
					{ label: 'Walls', value: formatCount(counts.walls) },
					{ label: 'Openings', value: formatCount(counts.openings) },
					{ label: 'Utilities', value: formatCount(counts.utilities) },
					{ label: 'Obstacles', value: formatCount(counts.obstacles) },
					{ label: 'Measurements', value: formatCount(counts.measurements) },
					{
						label: 'Critical unverified',
						value: counts.criticalUnverified === 0 ? 'None' : formatCount(counts.criticalUnverified)
					},
					{ label: 'Notes', value: formatCount(counts.notes) },
					{ label: 'Photos', value: formatCount(counts.photos) }
				]}
			/>
		</DetailSection>

		<DetailSection title="Record">
			<KeyValueGrid items={detailItems} columns={2} />
		</DetailSection>

		<SectionNav sections={sectionLinks} />

		<div id="rooms" class="scroll-mt-24">
			<DetailSection
				title="Rooms"
				description="Every room in the survey, with the children captured in it."
			>
				<RoomBoard {rooms} />

				{#if rooms.length > 0}
					<div class="flex flex-col gap-2 pt-2">
						<h3 class="text-subheadline text-ink">Room details</h3>
						{#each rooms as tree (tree.room.id)}
							<span id={`room-${tree.room.id}`} class="block scroll-mt-24"></span>
						{/each}
						<Accordion items={accordionItems} multiple>
							{#snippet children(roomId)}
								{@const tree = roomById.get(roomId)}
								{#if tree}
									<RoomDetails {tree} />
								{/if}
							{/snippet}
						</Accordion>
					</div>
				{/if}
			</DetailSection>
		</div>

		<div id="measurements" class="scroll-mt-24">
			<DetailSection
				title="Measurements"
				description="Captured values, their source and their verification state. Critical rows come first."
			>
				{#if measurements.length === 0}
					<EmptyState
						title="No measurements yet."
						description="Captured readings appear here once the surveyor records them."
					/>
				{:else}
					<ul class="flex list-none flex-col p-0">
						{#each orderedMeasurements as entry (entry.measurement.id)}
							<MeasurementRow measurement={entry.measurement} roomCaption={entry.roomCaption} />
						{/each}
					</ul>
				{/if}
			</DetailSection>
		</div>

		<div id="notes" class="scroll-mt-24">
			<DetailSection
				title="Notes"
				description="Survey-level notes. Room notes appear inside each room above."
			>
				{#if loadedDetail.surveyNotes.length === 0}
					<p class="text-callout text-ink-secondary">No survey-level notes recorded.</p>
				{:else}
					<ul class="flex list-none flex-col gap-4 p-0">
						{#each loadedDetail.surveyNotes as note (note.id)}
							<li
								class="flex flex-col gap-1 border-t border-hairline pt-3 first:border-t-0 first:pt-0"
							>
								<span class="flex flex-wrap items-center gap-2 text-footnote text-ink-secondary">
									<Badge label={NOTE_CATEGORY_LABELS[note.category]} tone="neutral" />
									{#if note.revision > 1}
										<span>Revision {note.revision}</span>
									{/if}
									<time datetime={note.createdAt}>{formatDateTime(note.createdAt)}</time>
								</span>
								<p class="text-callout break-words whitespace-pre-line text-ink">{note.body}</p>
							</li>
						{/each}
					</ul>
				{/if}
			</DetailSection>
		</div>

		<div id="media" class="scroll-mt-24">
			<DetailSection
				title="Media"
				description="Photos, plans and videos attached to the survey and its rooms."
			>
				{#snippet actions()}
					<EntityLink href={mediaHref}>Open media library</EntityLink>
				{/snippet}

				<div class="flex flex-wrap gap-2">
					<Badge label={`${mediaSummary.complete} complete`} tone="success" />
					<Badge label={`${mediaSummary.pending} pending`} tone="warning" />
					<Badge
						label={`${mediaSummary.failed} failed`}
						tone={mediaSummary.failed > 0 ? 'danger' : 'neutral'}
					/>
				</div>

				<MediaGrid items={mediaItems} columns={4} />
			</DetailSection>
		</div>

		<DetailSection
			title="Activity"
			description="Every transition, verification and reopen on this survey."
		>
			<AuditTrailTab
				rows={auditRows}
				loading={auditLoading}
				error={auditError}
				emptyLabel="No survey activity yet."
			/>
			{#if auditError}
				<div class="pt-2">
					<Button variant="secondary" onclick={retryAudit}>Try again</Button>
				</div>
			{/if}
		</DetailSection>
	</div>

	<ChecklistDrawer
		bind:open={checklistOpen}
		sections={checklistSections}
		blockers={blockerCount}
		loading={checklistLoading}
		description={loadedSurvey.status === 'in_progress'
			? 'Fix every blocking item before submitting the survey.'
			: 'Verification needs every manufacturing-critical measurement cleared.'}
	>
		{#snippet footer()}
			{#if loadedSurvey.status === 'in_progress' && canRunSurveyAction(user, 'submit', loadedSurvey.status)}
				<Button
					variant="primary"
					disabled={!checklist?.canSubmit}
					loading={transitionSaving}
					loadingLabel="Submitting…"
					onclick={() => {
						transitionAction = 'submit';
						void handleTransition('');
					}}
				>
					Submit survey
				</Button>
			{:else if loadedSurvey.status === 'submitted' && canApprove}
				<Button
					variant="primary"
					disabled={!checklist?.canVerify}
					onclick={handleVerifyFromChecklist}
				>
					Open verification
				</Button>
			{:else}
				<Button variant="secondary" onclick={() => (checklistOpen = false)}>Close</Button>
			{/if}
		{/snippet}
	</ChecklistDrawer>

	<SurveyTransitionDialog
		bind:open={transitionOpen}
		action={transitionAction}
		surveyCaption={loadedSurvey.caption}
		saving={transitionSaving}
		error={transitionError}
		onconfirm={handleTransition}
	/>
{/if}
