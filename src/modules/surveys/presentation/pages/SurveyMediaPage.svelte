<script lang="ts">
	import { resolve } from '$app/paths';
	import { CircleAlert, RefreshCw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { assetsApi } from '$modules/assets/data/api';
	import { sha256Hex } from '$modules/assets/presentation/sha256';
	import type { Asset, AssetKind } from '$modules/assets/domain/types';
	import { MAX_ASSET_SIZE_BYTES } from '$modules/assets/domain/types';
	import { sessionStore } from '$shared/application/session';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { PERMISSIONS, hasPermission } from '$shared/domain/permissions';
	import { isUuid } from '$shared/domain/uuid';
	import { formatCount, formatFileSize } from '$shared/lib/format';
	import {
		Badge,
		Breadcrumb,
		Button,
		DetailSection,
		EmptyState,
		EntityLink,
		EvidenceUploader,
		ForbiddenPage,
		KeyValueGrid,
		MediaGrid,
		PageHeader,
		Select,
		Skeleton,
		type EvidenceFile,
		type MediaItem
	} from '$shared/presentation/ui';
	import { surveysApi } from '../../data/api';
	import type { SurveyDetail } from '../../domain/types';

	/**
	 * `/surveys/[id]/media` — the desk media library (phase-2 §3.1).
	 *
	 * Assets are grouped by the survey-tree row that owns them, because an
	 * asset inherits its owner's permission and its label ("Kitchen · Window
	 * A") is what the reviewer recognises. The desk can also add evidence to
	 * the survey itself: the upload queue runs the real Part 9 §12 handshake
	 * (`init` → `uploading` → SHA-256 → `complete`).
	 */
	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	const STATE_OPTIONS = [
		{ value: 'all', label: 'Every state' },
		{ value: 'complete', label: 'Uploaded' },
		{ value: 'pending', label: 'Waiting to upload' },
		{ value: 'uploading', label: 'Uploading' },
		{ value: 'failed', label: 'Upload failed' }
	];
	const KIND_OPTIONS = [
		{ value: 'all', label: 'Photos, plans and video' },
		{ value: 'photo', label: 'Photos' },
		{ value: 'plan', label: 'Plans' },
		{ value: 'video', label: 'Video' }
	];

	let detail = $state<SurveyDetail | null>(null);
	let assets = $state<Asset[]>([]);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let assetsLoading = $state(false);
	let assetsError = $state<string | null>(null);
	let requestSequence = 0;
	let assetsSequence = 0;

	let stateFilter = $state('all');
	let kindFilter = $state('all');

	let queue = $state<EvidenceFile[]>([]);
	let retryingId = $state<string | null>(null);

	const user = $derived($sessionStore.user);
	const validId = $derived(isUuid(id));
	const survey = $derived(detail?.survey ?? null);
	const canWrite = $derived(
		Boolean(user && hasPermission(user.permissions, PERMISSIONS.SURVEY_UPDATE))
	);
	const locked = $derived(
		survey?.status === 'verified' || survey?.status === 'cancelled' || !canWrite
	);

	const breadcrumb = $derived([
		{ label: 'Surveys', href: resolve('/surveys') },
		{
			label: survey?.caption ?? 'Survey',
			href: survey ? resolve(`/surveys/${survey.id}`) : undefined
		},
		{ label: 'Media' }
	]);

	/** Owner label map, e.g. `room:<uuid>` → "Kitchen". */
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

	const filtered = $derived(
		assets.filter(
			(asset) =>
				(stateFilter === 'all' || asset.uploadState === stateFilter) &&
				(kindFilter === 'all' || asset.assetKind === kindFilter)
		)
	);

	const groups = $derived.by(() => {
		const order = ['survey', 'room', 'wall', 'opening'];
		const buckets: Array<{
			key: string;
			ownerType: string;
			ownerId: string;
			rows: Asset[];
		}> = [];
		for (const asset of filtered) {
			const key = `${asset.ownerType}:${asset.ownerId}`;
			const bucket = buckets.find((candidate) => candidate.key === key);
			if (bucket) bucket.rows.push(asset);
			else buckets.push({ key, ownerType: asset.ownerType, ownerId: asset.ownerId, rows: [asset] });
		}
		return buckets
			.map((bucket) => ({
				key: bucket.key,
				ownerType: bucket.ownerType,
				ownerId: bucket.ownerId,
				label: ownerLabels.get(bucket.key) ?? `${bucket.ownerType} media`,
				items: bucket.rows.map(toMediaItem)
			}))
			.sort(
				(first, second) =>
					order.indexOf(first.ownerType) - order.indexOf(second.ownerType) ||
					first.label.localeCompare(second.label, 'en-GB')
			);
	});

	const summary = $derived.by(() => ({
		total: assets.length,
		complete: assets.filter((asset) => asset.uploadState === 'complete').length,
		pending: assets.filter(
			(asset) => asset.uploadState === 'pending' || asset.uploadState === 'uploading'
		).length,
		failed: assets.filter((asset) => asset.uploadState === 'failed').length
	}));

	const hasFilters = $derived(stateFilter !== 'all' || kindFilter !== 'all');

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
			await loadAssets(value);
		} catch (caught) {
			if (sequence !== requestSequence) return;
			detail = null;
			assets = [];
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else
				error = isApiError(caught) ? caught.message : 'We could not load this survey. Try again.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	async function loadAssets(value: string): Promise<void> {
		const sequence = ++assetsSequence;
		assetsLoading = true;
		assetsError = null;
		try {
			const page = await assetsApi.list({
				surveyId: value,
				uploadState: 'all',
				page: 1,
				pageSize: MAX_PAGE_SIZE
			});
			if (sequence !== assetsSequence) return;
			assets = page.items;
		} catch (caught) {
			if (sequence !== assetsSequence) return;
			assets = [];
			assetsError = isApiError(caught)
				? caught.message
				: 'We could not load this media. Try again.';
		} finally {
			if (sequence === assetsSequence) assetsLoading = false;
		}
	}

	function toMediaItem(asset: Asset): MediaItem {
		return {
			id: asset.id,
			fileName: asset.fileName,
			caption: asset.caption,
			kind: asset.assetKind,
			mimeType: asset.mimeType,
			previewUrl: asset.signedUrl,
			uploadState: asset.uploadState,
			ownerLabel: ownerLabels.get(`${asset.ownerType}:${asset.ownerId}`) ?? null,
			sizeBytes: asset.sizeBytes,
			alt: asset.caption
		};
	}

	function kindFor(mimeType: string): AssetKind {
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType === 'application/pdf') return 'plan';
		return 'photo';
	}

	async function handleAdd(files: File[]): Promise<void> {
		const current = survey;
		if (!current) return;

		for (const file of files) {
			const entry: EvidenceFile = {
				// UI-local queue key only; never persisted, so any UUID is fine.
				id: crypto.randomUUID(),
				name: file.name,
				sizeBytes: file.size,
				state: 'pending',
				progress: 0,
				mimeType: file.type
			};
			queue = [...queue, entry];

			if (file.size > MAX_ASSET_SIZE_BYTES) {
				updateQueue(entry.id, {
					state: 'failed',
					error: `This file is larger than ${formatFileSize(MAX_ASSET_SIZE_BYTES)}.`
				});
				continue;
			}

			try {
				updateQueue(entry.id, { state: 'uploading', progress: 20 });
				const sha256 = await sha256Hex(file);
				const kind = kindFor(file.type);
				const init = await assetsApi.init({
					ownerType: 'survey',
					ownerId: current.id,
					assetKind: kind,
					fileName: file.name,
					mimeType: file.type || 'application/octet-stream',
					sizeBytes: file.size,
					sha256,
					caption: null,
					capturedAt: null
				});
				updateQueue(entry.id, { progress: 60 });
				await assetsApi.setState(init.asset.id, { uploadState: 'uploading' });
				await assetsApi.complete(init.asset.id, { sha256 });
				updateQueue(entry.id, { state: 'complete', progress: 100 });
			} catch (caught) {
				updateQueue(entry.id, {
					state: 'failed',
					error: isApiError(caught) ? caught.message : 'This upload failed. Try again.'
				});
			}
		}

		await loadAssets(current.id);
		toast.success('Upload finished. Every file is listed with its state.');
	}

	function updateQueue(entryId: string, patch: Partial<EvidenceFile>): void {
		queue = queue.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry));
	}

	function removeQueueEntry(entryId: string): void {
		queue = queue.filter((entry) => entry.id !== entryId);
	}

	/**
	 * Retry a failed asset. The mock keeps no bytes, so the retry re-sends the
	 * digest registered with the row — the state machine (`failed` →
	 * `uploading` → `complete`) is still the real one.
	 */
	async function retryAsset(asset: Asset): Promise<void> {
		retryingId = asset.id;
		try {
			await assetsApi.setState(asset.id, { uploadState: 'uploading' });
			await assetsApi.complete(asset.id, { sha256: asset.sha256 });
			toast.success(`${asset.fileName} uploaded.`);
			if (survey) await loadAssets(survey.id);
		} catch (caught) {
			toast.error(
				isApiError(caught) ? caught.message : 'We could not retry this upload. Try again.'
			);
		} finally {
			retryingId = null;
		}
	}

	function clearFilters(): void {
		stateFilter = 'all';
		kindFilter = 'all';
	}

	function retryLoad(): void {
		void load(id);
	}

	function retryAssets(): void {
		void loadAssets(id);
	}
</script>

<svelte:head>
	<title>{survey?.caption ? `Media · ${survey.caption} · Interio` : 'Survey media · Interio'}</title
	>
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
	<div class="flex flex-col gap-6" aria-busy="true" aria-label="Loading media">
		<h1 class="sr-only">Loading media</h1>
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
	<h1 class="sr-only">Survey media</h1>
	<EmptyState title="We could not load this media." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={retryLoad}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	{@const loadedSurvey = survey}
	{@const loadedDetail = detail}

	<Breadcrumb items={breadcrumb} class="pb-4" />

	<PageHeader
		title="Media"
		description={`${loadedSurvey.caption} · ${loadedDetail.project.caption}`}
	>
		{#snippet actions()}
			<EntityLink href={resolve(`/surveys/${loadedSurvey.id}`)}>Back to survey</EntityLink>
		{/snippet}
	</PageHeader>

	<div class="mt-8 flex flex-col gap-6">
		<DetailSection title="Summary" description="What the evidence set contains.">
			<KeyValueGrid
				columns={3}
				items={[
					{ label: 'Files', value: formatCount(summary.total) },
					{ label: 'Uploaded', value: formatCount(summary.complete) },
					{ label: 'Pending', value: formatCount(summary.pending) },
					{
						label: 'Failed',
						value: summary.failed === 0 ? 'None' : formatCount(summary.failed)
					}
				]}
			/>
		</DetailSection>

		{#if locked}
			<p
				role="status"
				class="rounded-lg border border-hairline bg-canvas-grouped p-4 text-callout text-ink-secondary"
			>
				{#if !canWrite}
					You can review this media, but only a surveyor or production manager can add files.
				{:else}
					This survey is {loadedSurvey.status}. Reopen it before adding new evidence.
				{/if}
			</p>
		{:else}
			<DetailSection
				title="Add evidence"
				description="Uploaded to the survey itself, so it is available to every room review."
			>
				<EvidenceUploader
					files={queue}
					onadd={handleAdd}
					onremove={removeQueueEntry}
					accept="image/*,application/pdf,video/mp4"
					hint={`Photos, PDF plans and MP4 video, up to ${formatFileSize(MAX_ASSET_SIZE_BYTES)} each. Each file is checked against its SHA-256 before it is marked complete.`}
				/>
			</DetailSection>
		{/if}

		<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
			<Select
				label="Upload state"
				value={stateFilter}
				options={STATE_OPTIONS}
				onchange={(event) => (stateFilter = (event.currentTarget as HTMLSelectElement).value)}
				class="sm:w-56"
			/>
			<Select
				label="File kind"
				value={kindFilter}
				options={KIND_OPTIONS}
				onchange={(event) => (kindFilter = (event.currentTarget as HTMLSelectElement).value)}
				class="sm:w-64"
			/>
			{#if hasFilters}
				<Button variant="tertiary" onclick={clearFilters}>Clear filters</Button>
			{/if}
		</div>

		{#if assetsLoading}
			<Skeleton variant="block" />
		{:else if assetsError}
			<div
				role="alert"
				class="flex flex-col items-start gap-3 rounded-lg border border-hairline bg-canvas p-4"
			>
				<p class="flex items-start gap-2 text-callout text-critical-ink">
					<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
					<span>{assetsError}</span>
				</p>
				<Button variant="secondary" onclick={retryAssets}>Try again</Button>
			</div>
		{:else if assets.length === 0}
			<EmptyState
				title="No media captured yet."
				description="Photos taken on site and plans uploaded from the desk appear here, grouped by the room or survey that owns them."
			/>
		{:else if filtered.length === 0}
			<EmptyState
				title="No files match these filters."
				description="Clear the state or kind filter to see every file."
			>
				{#snippet action()}
					<Button variant="secondary" onclick={clearFilters}>Clear filters</Button>
				{/snippet}
			</EmptyState>
		{:else}
			{#each groups as group (group.key)}
				<DetailSection
					title={group.label}
					description={group.ownerType === 'survey'
						? 'Survey-level evidence'
						: `${group.items.length} ${group.items.length === 1 ? 'file' : 'files'} attached to this ${group.ownerType}`}
				>
					{#snippet actions()}
						{#if group.items.length > 0}
							<Badge
								label={`${group.items.length} ${group.items.length === 1 ? 'file' : 'files'}`}
								tone="neutral"
							/>
						{/if}
					{/snippet}

					<MediaGrid items={group.items} columns={4} />

					{#if group.items.some((item) => item.uploadState === 'failed')}
						<div class="flex flex-col gap-2 border-t border-hairline pt-3">
							<h3 class="text-subheadline text-ink">Failed uploads</h3>
							{#each assets.filter((asset) => `${asset.ownerType}:${asset.ownerId}` === group.key && asset.uploadState === 'failed') as asset (asset.id)}
								<div class="flex flex-wrap items-center justify-between gap-2">
									<div class="flex min-w-0 flex-col gap-0.5">
										<span class="text-callout break-words text-ink">{asset.fileName}</span>
										<span class="text-footnote text-critical-ink">
											The uploaded file did not match its checksum ({formatFileSize(
												asset.sizeBytes
											)}).
										</span>
									</div>
									<Button
										variant="secondary"
										disabled={locked || retryingId === asset.id}
										loading={retryingId === asset.id}
										loadingLabel="Retrying…"
										onclick={() => retryAsset(asset)}
									>
										{#snippet icon()}
											<RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
										{/snippet}
										Retry upload
									</Button>
								</div>
							{/each}
						</div>
					{/if}
				</DetailSection>
			{/each}
		{/if}
	</div>
{/if}
