<script lang="ts">
	import { resolve } from '$app/paths';

	import { Camera, CircleAlert, RefreshCw, UploadCloud } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { isOnline } from '$shared/application/connectivity.svelte';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { isUuid } from '$shared/domain/uuid';
	import { formatCount, formatFileSize } from '$shared/lib/format';
	import {
		Badge,
		Button,
		EmptyState,
		EvidenceUploader,
		ForbiddenPage,
		MediaGrid,
		Skeleton,
		StateChip,
		type EvidenceFile,
		type MediaItem
	} from '$shared/presentation/ui';
	import { assetsApi } from '$modules/assets/data/api';
	import { MAX_ASSET_SIZE_BYTES, type Asset, type AssetKind } from '$modules/assets/domain/types';
	import { sha256Hex } from '$modules/assets/presentation/sha256';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { SurveyDetail } from '$modules/surveys/domain/types';
	import MobileHeader from '../components/MobileHeader.svelte';

	/**
	 * `/m/surveys/[id]/media` — site evidence (phase-2 §3.2, Part 9 §12).
	 *
	 * Capture works offline: the file becomes a pending asset row on this
	 * device and is counted by the sync chip. Reconnecting does not fabricate
	 * an upload — the surveyor or the sync queue completes the same
	 * `pending → uploading → complete` handshake, including the SHA-256 check.
	 * No stock photography is ever shown: a row with no bytes is a labelled
	 * placeholder.
	 */
	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let detail = $state<SurveyDetail | null>(null);
	let assets = $state<Asset[]>([]);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let assetsError = $state<string | null>(null);
	let sequence = 0;
	let assetsSequence = 0;

	let uploads = $state<EvidenceFile[]>([]);
	let retryingId = $state<string | null>(null);
	let cameraInput = $state<HTMLInputElement | null>(null);

	const online = $derived(isOnline());
	const validId = $derived(isUuid(id));
	const survey = $derived(detail?.survey ?? null);
	const editable = $derived(
		survey !== null &&
			(survey.status === 'draft' || survey.status === 'in_progress' || survey.status === 'rejected')
	);

	const ownerLabels = $derived.by(() => {
		if (!detail) return new Map<string, string>();
		const entries: Array<[string, string]> = [[`survey:${detail.survey.id}`, 'Survey evidence']];
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

	const mediaItems = $derived.by<MediaItem[]>(() =>
		assets.map((asset) => ({
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
		}))
	);

	const pendingAssets = $derived(
		assets.filter((asset) => asset.uploadState === 'pending' || asset.uploadState === 'failed')
	);

	const summary = $derived.by(() => ({
		total: assets.length,
		complete: assets.filter((asset) => asset.uploadState === 'complete').length,
		pending: assets.filter((asset) => asset.uploadState === 'pending').length,
		failed: assets.filter((asset) => asset.uploadState === 'failed').length
	}));

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
			const hub = await surveysApi.get(value);
			if (current !== sequence) return;
			detail = hub;
			await loadAssets(value);
		} catch (caught) {
			if (current !== sequence) return;
			detail = null;
			assets = [];
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else
				error = isApiError(caught) ? caught.message : 'We could not load this survey. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}

	async function loadAssets(value: string): Promise<void> {
		const current = ++assetsSequence;
		assetsError = null;
		try {
			const page = await assetsApi.list({
				surveyId: value,
				uploadState: 'all',
				page: 1,
				pageSize: MAX_PAGE_SIZE
			});
			if (current !== assetsSequence) return;
			assets = page.items;
		} catch (caught) {
			if (current !== assetsSequence) return;
			assets = [];
			assetsError = isApiError(caught)
				? caught.message
				: 'We could not load this evidence. Try again.';
		}
	}

	function kindFor(mimeType: string): AssetKind {
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType === 'application/pdf') return 'plan';
		return 'photo';
	}

	function announceQueueChange(): void {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new Event('interio:sync-changed'));
		}
	}

	async function handleAdd(files: File[]): Promise<void> {
		const current = survey;
		if (!current) return;

		for (const file of files) {
			if (file.size > MAX_ASSET_SIZE_BYTES) {
				toast.error(`${file.name} is larger than ${formatFileSize(MAX_ASSET_SIZE_BYTES)}.`);
				continue;
			}
			await capture(current.id, file);
		}

		announceQueueChange();
		if (survey) await loadAssets(survey.id);
	}

	async function capture(surveyId: string, file: File): Promise<void> {
		const entryId = crypto.randomUUID();
		const entry: EvidenceFile = {
			id: entryId,
			name: file.name,
			sizeBytes: file.size,
			state: 'pending',
			progress: 0,
			mimeType: file.type
		};
		uploads = [...uploads, entry];

		updateQueue(entryId, { state: 'uploading', progress: online ? 15 : 5 });

		try {
			const sha256 = await sha256Hex(file);
			const init = await assetsApi.init({
				ownerType: 'survey',
				ownerId: surveyId,
				assetKind: kindFor(file.type),
				fileName: file.name,
				mimeType: file.type || 'application/octet-stream',
				sizeBytes: file.size,
				sha256,
				caption: null,
				capturedAt: new Date().toISOString()
			});
			updateQueue(entryId, { progress: online ? 55 : 10 });

			if (!online) {
				// The bytes stay on this device. The row is pending and the sync
				// chip counts it until the handshake can run.
				updateQueue(entryId, {
					state: 'pending',
					progress: 0,
					error: 'Saved on this device. It will upload when you are back online.'
				});
				return;
			}

			await assetsApi.setState(init.asset.id, { uploadState: 'uploading' });
			updateQueue(entryId, { progress: 80 });
			await assetsApi.complete(init.asset.id, { sha256 });
			updateQueue(entryId, { state: 'complete', progress: 100, error: null });
		} catch (caught) {
			updateQueue(entryId, {
				state: 'failed',
				error: isApiError(caught) ? caught.message : 'This upload failed. Try again.'
			});
		}
	}

	function updateQueue(entryId: string, patch: Partial<EvidenceFile>): void {
		uploads = uploads.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry));
	}

	function removeQueueEntry(entryId: string): void {
		uploads = uploads.filter((entry) => entry.id !== entryId);
	}

	function retryQueueEntry(entryId: string): void {
		uploads = uploads.filter((entry) => entry.id !== entryId);
		toast.info('Choose the file again to retry it.');
	}

	/**
	 * Finish a pending or failed row. The mock keeps no bytes, so the digest
	 * registered with the row is re-sent; the state machine is the real one.
	 */
	async function uploadAsset(asset: Asset): Promise<void> {
		retryingId = asset.id;
		try {
			await assetsApi.setState(asset.id, { uploadState: 'uploading' });
			await assetsApi.complete(asset.id, { sha256: asset.sha256 });
			toast.success(`${asset.fileName} uploaded.`);
			announceQueueChange();
			if (survey) await loadAssets(survey.id);
		} catch (caught) {
			toast.error(
				isApiError(caught) ? caught.message : 'We could not upload this file. Try again.'
			);
		} finally {
			retryingId = null;
		}
	}

	function openCamera(): void {
		cameraInput?.click();
	}

	function handleCameraChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const files = input.files ? Array.from(input.files) : [];
		input.value = '';
		if (files.length > 0) void handleAdd(files);
	}

	function retryLoad(): void {
		void load(id);
	}

	function retryAssets(): void {
		void loadAssets(id);
	}
</script>

<svelte:head>
	<title>{survey?.caption ? `Media · ${survey.caption}` : 'Media · Interio Survey'}</title>
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
		<h1 class="sr-only">Loading media</h1>
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
{:else if error || !detail || !survey}
	<h1 class="sr-only">Media</h1>
	<EmptyState title="We could not load this media." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={retryLoad}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	{@const loadedSurvey = survey}

	<MobileHeader
		title="Photos and plans"
		subtitle={`${loadedSurvey.caption} · ${formatCount(summary.complete)} of ${formatCount(summary.total)} uploaded`}
		backHref={resolve(`/m/surveys/${loadedSurvey.id}`)}
		backLabel="Survey"
	>
		{#snippet actions()}
			<StateChip entity="survey" state={loadedSurvey.status} />
		{/snippet}
	</MobileHeader>

	<div class="flex flex-col gap-4">
		{#if !online}
			<p
				role="status"
				class="flex items-start gap-2 rounded-lg border border-caution bg-caution-soft p-3 text-footnote text-caution-ink"
			>
				<CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>
					You are offline. New photos are saved on this device as pending rows and count toward the
					sync queue. Nothing is uploaded until you reconnect.
				</span>
			</p>
		{/if}

		{#if editable}
			<section class="flex flex-col gap-3" aria-labelledby="capture-heading">
				<h2 id="capture-heading" class="text-title-3 text-ink">Capture</h2>

				<Button variant="primary" fullWidth onclick={openCamera}>
					{#snippet icon()}
						<Camera size={18} strokeWidth={1.75} aria-hidden="true" />
					{/snippet}
					Take a photo
				</Button>
				<p class="text-footnote text-ink-secondary">
					Your phone asks for camera access the first time you take a photo. Photos are stored with
					the survey and its rooms, never in a shared gallery.
				</p>
				<input
					bind:this={cameraInput}
					type="file"
					accept="image/*"
					capture="environment"
					class="sr-only"
					tabindex="-1"
					aria-hidden="true"
					onchange={handleCameraChange}
				/>

				<EvidenceUploader
					files={uploads}
					onadd={handleAdd}
					onretry={retryQueueEntry}
					onremove={removeQueueEntry}
					accept="image/*,application/pdf,video/mp4"
					label="Plans and video"
					hint={`Photos, PDF plans and MP4 video, up to ${formatFileSize(MAX_ASSET_SIZE_BYTES)} each. Each file is checked against its SHA-256 before it is marked complete.`}
				/>
			</section>
		{:else}
			<p
				class="rounded-lg border border-hairline bg-canvas-grouped p-3 text-footnote text-ink-secondary"
			>
				This survey is {loadedSurvey.status}, so evidence is read-only.
			</p>
		{/if}

		<dl class="grid grid-cols-3 gap-3 rounded-lg border border-hairline bg-canvas p-3">
			<div class="flex flex-col gap-0.5">
				<dt class="text-footnote text-ink-secondary">Uploaded</dt>
				<dd class="text-headline text-ink tabular-nums">{formatCount(summary.complete)}</dd>
			</div>
			<div class="flex flex-col gap-0.5">
				<dt class="text-footnote text-ink-secondary">Pending</dt>
				<dd class="text-headline text-ink tabular-nums">{formatCount(summary.pending)}</dd>
			</div>
			<div class="flex flex-col gap-0.5">
				<dt class="text-footnote text-ink-secondary">Failed</dt>
				<dd class="text-headline text-ink tabular-nums">{formatCount(summary.failed)}</dd>
			</div>
		</dl>

		{#if pendingAssets.length > 0}
			<section class="flex flex-col gap-2" aria-labelledby="upload-queue-heading">
				<h2 id="upload-queue-heading" class="text-title-3 text-ink">Waiting to upload</h2>
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each pendingAssets as asset (asset.id)}
						<li class="flex flex-col gap-2 rounded-lg border border-hairline bg-canvas p-3">
							<div class="flex items-start justify-between gap-2">
								<div class="flex min-w-0 flex-col gap-0.5">
									<span class="text-callout break-words text-ink">{asset.fileName}</span>
									<span class="text-footnote break-words text-ink-secondary">
										{ownerLabels.get(`${asset.ownerType}:${asset.ownerId}`) ?? 'Survey evidence'} ·
										{formatFileSize(asset.sizeBytes)}
									</span>
								</div>
								<Badge
									label={asset.uploadState === 'failed' ? 'Upload failed' : 'Waiting to upload'}
									tone={asset.uploadState === 'failed' ? 'danger' : 'warning'}
								/>
							</div>
							<Button
								variant="secondary"
								disabled={!online || !editable || retryingId === asset.id}
								loading={retryingId === asset.id}
								loadingLabel="Uploading…"
								onclick={() => uploadAsset(asset)}
							>
								{#snippet icon()}
									<UploadCloud size={16} strokeWidth={1.75} aria-hidden="true" />
								{/snippet}
								{asset.uploadState === 'failed' ? 'Retry upload' : 'Upload now'}
							</Button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if assetsError}
			<div
				role="alert"
				class="flex flex-col items-start gap-3 rounded-lg border border-hairline bg-canvas p-3"
			>
				<p class="flex items-start gap-2 text-callout text-critical-ink">
					<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
					<span>{assetsError}</span>
				</p>
				<Button variant="secondary" onclick={retryAssets}>Try again</Button>
			</div>
		{:else if assets.length === 0}
			<EmptyState
				title="No evidence yet."
				description="Take the first photo on site, or upload a plan from this screen. Nothing is ever replaced by a stock image."
			/>
		{:else}
			<section class="flex flex-col gap-2" aria-labelledby="evidence-heading">
				<div class="flex items-center justify-between gap-2">
					<h2 id="evidence-heading" class="text-title-3 text-ink">Evidence</h2>
					<Button variant="tertiary" onclick={retryAssets}>
						{#snippet icon()}
							<RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
						{/snippet}
						Refresh
					</Button>
				</div>
				<MediaGrid items={mediaItems} columns={2} />
			</section>
		{/if}
	</div>
{/if}
