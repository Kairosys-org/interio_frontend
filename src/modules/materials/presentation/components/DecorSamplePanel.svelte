<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { assetsApi } from '$modules/assets/data/api';
	import { MAX_ASSET_SIZE_BYTES, type Asset, type AssetKind } from '$modules/assets/domain/types';
	import { sha256Hex } from '$modules/assets/presentation/sha256';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { formatDate, formatFileSize } from '$shared/lib/format';
	import {
		Badge,
		Button,
		DataTable,
		EvidenceUploader,
		type EvidenceFile
	} from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';

	/**
	 * Decor sample asset (phase-3 §1 materials, Part 9 §12).
	 *
	 * Reuses the asset handshake (`init` → `uploading` → SHA-256 → `complete`)
	 * with `ownerType: 'decor'`, so the sample inherits `materials.view` /
	 * `materials.update` instead of inventing an asset permission. The decor
	 * stores one sample reference; the other uploads stay listed.
	 */
	interface Props {
		decorId: string;
		decorCaption: string;
		sampleAssetId: string | null;
		canEdit: boolean;
		onChanged: () => void;
	}

	let { decorId, decorCaption, sampleAssetId, canEdit, onChanged }: Props = $props();

	let assets = $state<Asset[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let queue = $state<EvidenceFile[]>([]);
	let busyId = $state<string | null>(null);
	let sequence = 0;

	$effect(() => {
		const id = decorId;
		void load(id);
	});

	async function load(id: string): Promise<void> {
		const current = ++sequence;
		loading = true;
		error = null;
		try {
			const page = await assetsApi.list({
				ownerType: 'decor',
				ownerId: id,
				uploadState: 'all',
				page: 1,
				pageSize: MAX_PAGE_SIZE
			});
			if (current !== sequence) return;
			assets = page.items;
		} catch (caught) {
			if (current !== sequence) return;
			assets = [];
			error = isApiError(caught) ? caught.message : 'We could not load this decor’s sample assets.';
		} finally {
			if (current === sequence) loading = false;
		}
	}

	function updateQueue(entryId: string, patch: Partial<EvidenceFile>): void {
		queue = queue.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry));
	}

	function kindFor(mimeType: string): AssetKind {
		if (mimeType === 'application/pdf') return 'plan';
		return 'photo';
	}

	async function handleAdd(files: File[]): Promise<void> {
		for (const file of files) {
			const entry: EvidenceFile = {
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
				const init = await assetsApi.init({
					ownerType: 'decor',
					ownerId: decorId,
					assetKind: kindFor(file.type),
					fileName: file.name,
					mimeType: file.type || 'application/octet-stream',
					sizeBytes: file.size,
					sha256,
					caption: `Sample · ${decorCaption}`,
					capturedAt: null
				});
				updateQueue(entry.id, { progress: 60 });
				await assetsApi.setState(init.asset.id, { uploadState: 'uploading' });
				await assetsApi.complete(init.asset.id, { sha256 });
				updateQueue(entry.id, { state: 'complete', progress: 100 });
				if (sampleAssetId === null) {
					await materialsApi.updateDecor(decorId, { sampleAssetId: init.asset.id });
				}
			} catch (caught) {
				updateQueue(entry.id, {
					state: 'failed',
					error: isApiError(caught) ? caught.message : 'This upload failed. Try again.'
				});
			}
		}

		await load(decorId);
		onChanged();
		toast.success('Sample asset uploaded.');
	}

	async function setSample(asset: Asset): Promise<void> {
		if (busyId !== null) return;
		busyId = asset.id;
		try {
			await materialsApi.updateDecor(decorId, { sampleAssetId: asset.id });
			toast.success('Sample asset updated.');
			onChanged();
		} catch (caught) {
			toast.error(isApiError(caught) ? caught.message : 'We could not set this sample.');
		} finally {
			busyId = null;
		}
	}

	async function clearSample(): Promise<void> {
		if (busyId !== null) return;
		busyId = 'clear';
		try {
			await materialsApi.updateDecor(decorId, { sampleAssetId: null });
			toast.success('Sample asset cleared.');
			onChanged();
		} catch (caught) {
			toast.error(isApiError(caught) ? caught.message : 'We could not clear this sample.');
		} finally {
			busyId = null;
		}
	}
</script>

<div class="flex flex-col gap-6">
	{#if canEdit}
		<EvidenceUploader
			files={queue}
			onadd={(files) => void handleAdd(files)}
			onremove={(entryId) => (queue = queue.filter((entry) => entry.id !== entryId))}
			multiple={false}
			accept="image/jpeg,image/png,image/heic,application/pdf"
			label="Upload a sample"
			hint={`A sample photo or PDF up to ${formatFileSize(MAX_ASSET_SIZE_BYTES)}. The first upload becomes the sample if none is set.`}
		/>
	{:else}
		<p class="text-footnote text-ink-secondary">
			You can view the sample asset but need materials.update to upload or change it.
		</p>
	{/if}

	{#if sampleAssetId === null}
		<p
			class="rounded-md border border-dashed border-hairline-strong px-4 py-6 text-callout text-ink-secondary"
		>
			No sample asset is set for this decor yet.
		</p>
	{/if}

	<DataTable
		caption="Decor sample assets"
		columns={[
			{ key: 'file', label: 'File' },
			{ key: 'kind', label: 'Kind' },
			{ key: 'state', label: 'State' },
			{ key: 'uploaded', label: 'Uploaded' },
			{ key: 'sample', label: 'Sample' }
		]}
		rows={assets}
		rowKey={(row) => row.id}
		{loading}
		{error}
		density="compact"
		empty={{
			title: 'No sample assets yet',
			description: 'Upload a photo or PDF to give the team a reference for this decor.'
		}}
	>
		{#snippet cell({ row, column })}
			{#if column.key === 'file'}
				<span class="min-w-0 truncate text-callout text-ink">{row.fileName}</span>
			{:else if column.key === 'kind'}
				{row.assetKind === 'photo' ? 'Photo' : row.assetKind === 'plan' ? 'Plan' : 'Video'}
			{:else if column.key === 'state'}
				<Badge
					label={row.uploadState === 'complete' ? 'Uploaded' : row.uploadState}
					tone={row.uploadState === 'complete'
						? 'success'
						: row.uploadState === 'failed'
							? 'danger'
							: 'warning'}
				/>
			{:else if column.key === 'uploaded'}
				{formatDate(row.createdAt)}
			{:else if column.key === 'sample'}
				{#if row.id === sampleAssetId}
					<div class="flex flex-wrap items-center gap-2">
						<Badge label="Current sample" tone="info" />
						{#if canEdit}
							<Button
								variant="ghost"
								onclick={clearSample}
								disabled={busyId !== null}
								loading={busyId === 'clear'}
								loadingLabel="Clearing…"
							>
								Clear<span class="sr-only"> sample asset</span>
							</Button>
						{/if}
					</div>
				{:else if canEdit && row.uploadState === 'complete'}
					<Button
						variant="tertiary"
						onclick={() => void setSample(row)}
						disabled={busyId !== null}
						loading={busyId === row.id}
						loadingLabel="Setting…"
					>
						Set as sample<span class="sr-only"> {row.fileName}</span>
					</Button>
				{:else}
					<span class="text-ink-tertiary">—</span>
				{/if}
			{/if}
		{/snippet}
	</DataTable>
</div>
