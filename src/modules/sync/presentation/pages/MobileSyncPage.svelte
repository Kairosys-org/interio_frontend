<script lang="ts">
	import {
		CircleAlert,
		CloudOff,
		RefreshCw,
		RotateCcw,
		Trash2,
		TriangleAlert,
		UploadCloud
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { isOnline } from '$shared/application/connectivity.svelte';
	import { formatCount, formatDateTime } from '$shared/lib/format';
	import { Badge, Button, EmptyState, Skeleton } from '$shared/presentation/ui';
	import { syncApi } from '$modules/sync/data/api';
	import type {
		ResolveConflictInput,
		SyncEntity,
		SyncOp,
		SyncOperation,
		SyncPendingCounts
	} from '$modules/sync/domain/types';
	import ConflictSheet from '../components/ConflictSheet.svelte';
	import MobileHeader from '$modules/surveys/presentation/mobile/components/MobileHeader.svelte';

	/**
	 * `/m/sync` — the outbox hub (phase-2 §3.2, Part 9 §13).
	 *
	 * Counters come from the same repository the chip reads, so the two can
	 * never disagree. Push and pull are explicit actions; a conflict is a
	 * first-class row that opens the side-by-side sheet, never a toast that
	 * scrolls away.
	 */
	const ENTITY_LABELS: Readonly<Record<SyncEntity, string>> = Object.freeze({
		survey: 'Survey',
		room: 'Room',
		wall: 'Wall',
		opening: 'Opening',
		utility: 'Utility',
		obstacle: 'Obstacle',
		measurement: 'Measurement',
		note: 'Note',
		asset: 'Evidence file'
	});

	const OP_LABELS: Readonly<Record<SyncOp, string>> = Object.freeze({
		create: 'New record',
		update: 'Edit',
		transition: 'Status change',
		verify: 'Verification',
		revision: 'Note revision',
		asset_state: 'Upload state'
	});

	let counts = $state<SyncPendingCounts | null>(null);
	let queued = $state<SyncOperation[]>([]);
	let failed = $state<SyncOperation[]>([]);
	let conflicts = $state<SyncOperation[]>([]);
	let sentCount = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let sequence = 0;

	let pushing = $state(false);
	let pulling = $state(false);
	let retryingKey = $state<string | null>(null);
	let clearing = $state(false);
	let lastPull = $state<string | null>(null);

	let conflictTarget = $state<SyncOperation | null>(null);
	let conflictOpen = $state(false);
	let resolving = $state(false);
	let resolveError = $state<string | null>(null);

	const online = $derived(isOnline());
	const unsent = $derived(counts?.unsent ?? 0);

	$effect(() => {
		void load();
	});

	async function load(): Promise<void> {
		const current = ++sequence;
		loading = true;
		error = null;
		try {
			const [pending, queuedRows, failedRows, conflictRows, sentRows] = await Promise.all([
				syncApi.pending(),
				syncApi.operations('queued'),
				syncApi.operations('failed'),
				syncApi.operations('conflict'),
				syncApi.operations('sent')
			]);
			if (current !== sequence) return;
			counts = pending;
			queued = queuedRows;
			failed = failedRows;
			conflicts = conflictRows;
			sentCount = sentRows.length;
		} catch (caught) {
			if (current !== sequence) return;
			error = isApiError(caught) ? caught.message : 'We could not read the sync queue. Try again.';
		} finally {
			if (current === sequence) loading = false;
		}
	}

	function announce(): void {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new Event('interio:sync-changed'));
		}
	}

	async function syncNow(): Promise<void> {
		if (!online || pushing) return;
		pushing = true;
		error = null;
		try {
			const result = await syncApi.push();
			const parts = [
				result.applied > 0 ? `${result.applied} sent` : null,
				result.conflicts > 0
					? `${result.conflicts} ${result.conflicts === 1 ? 'conflict' : 'conflicts'}`
					: null,
				result.failed > 0 ? `${result.failed} failed` : null
			].filter((part): part is string => part !== null);
			if (parts.length === 0) toast.info('Nothing was waiting to sync.');
			else toast.success(`Sync finished: ${parts.join(' · ')}.`);
			await load();
			announce();
		} catch (caught) {
			error = isApiError(caught) ? caught.message : 'We could not sync. Try again.';
		} finally {
			pushing = false;
		}
	}

	async function pullChanges(): Promise<void> {
		if (!online || pulling) return;
		pulling = true;
		error = null;
		try {
			const result = await syncApi.pull({});
			lastPull = result.pulledAt;
			toast.success(
				result.changes.length === 0
					? 'Everything is up to date.'
					: `${formatCount(result.changes.length)} ${result.changes.length === 1 ? 'change' : 'changes'} received.`
			);
			await load();
			announce();
		} catch (caught) {
			error = isApiError(caught) ? caught.message : 'We could not pull changes. Try again.';
		} finally {
			pulling = false;
		}
	}

	async function retryOperation(operation: SyncOperation): Promise<void> {
		retryingKey = operation.idempotencyKey;
		try {
			await syncApi.retry(operation.idempotencyKey);
			toast.info('Queued again. Press Sync now to send it.');
			await load();
			announce();
		} catch (caught) {
			toast.error(
				isApiError(caught) ? caught.message : 'We could not retry this operation. Try again.'
			);
		} finally {
			retryingKey = null;
		}
	}

	function openConflict(operation: SyncOperation): void {
		resolveError = null;
		conflictTarget = operation;
		conflictOpen = true;
	}

	async function resolveConflict(input: ResolveConflictInput): Promise<void> {
		const target = conflictTarget;
		if (!target) return;
		resolving = true;
		resolveError = null;
		try {
			await syncApi.resolveConflict(target.idempotencyKey, input);
			conflictOpen = false;
			toast.success(
				input.decision === 'accept_server'
					? 'Server version kept. The queued change was closed.'
					: 'Your change is queued again. Press Sync now to send it.'
			);
			await load();
			announce();
		} catch (caught) {
			resolveError = isApiError(caught)
				? caught.message
				: 'We could not resolve this conflict. Try again.';
		} finally {
			resolving = false;
		}
	}

	async function clearSent(): Promise<void> {
		clearing = true;
		try {
			await syncApi.clearSent();
			toast.success('Sent operations cleared from this device.');
			await load();
			announce();
		} catch (caught) {
			toast.error(
				isApiError(caught) ? caught.message : 'We could not clear the sent list. Try again.'
			);
		} finally {
			clearing = false;
		}
	}

	function shortId(value: string): string {
		return value.slice(0, 8);
	}
</script>

<svelte:head>
	<title>Sync · Interio Survey</title>
</svelte:head>

<MobileHeader
	title="Sync"
	subtitle="What is waiting on this device, and what the server already has."
>
	{#snippet actions()}
		<Badge
			label={online ? (unsent === 0 ? 'Up to date' : `${unsent} waiting`) : 'Offline'}
			tone={online ? (unsent === 0 ? 'success' : 'warning') : 'neutral'}
		/>
	{/snippet}
</MobileHeader>

{#if loading}
	<div class="flex flex-col gap-4" aria-busy="true">
		<p class="sr-only" role="status">Reading the sync queue</p>
		<Skeleton variant="block" />
		<Skeleton lines={5} />
	</div>
{:else if error && !counts}
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
{:else}
	<div class="flex flex-col gap-4">
		{#if !online}
			<p
				role="status"
				class="flex items-start gap-2 rounded-lg border border-caution bg-caution-soft p-3 text-footnote text-caution-ink"
			>
				<CloudOff size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>
					You are offline. Capture keeps working and every change is queued here. Sync becomes
					available when the connection returns.
				</span>
			</p>
		{/if}

		{#if error}
			<p
				role="alert"
				class="flex items-start gap-2 rounded-lg border border-critical bg-critical-soft p-3 text-footnote text-critical-ink"
			>
				<CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{error}</span>
			</p>
		{/if}

		<dl class="grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-canvas p-3">
			<div class="flex flex-col gap-0.5">
				<dt class="text-footnote text-ink-secondary">Waiting</dt>
				<dd class="text-title-2 text-ink tabular-nums">{formatCount(counts?.queued ?? 0)}</dd>
			</div>
			<div class="flex flex-col gap-0.5">
				<dt class="text-footnote text-ink-secondary">Conflicts</dt>
				<dd
					class="text-title-2 tabular-nums {conflicts.length > 0
						? 'text-critical-ink'
						: 'text-ink'}"
				>
					{formatCount(counts?.conflict ?? 0)}
				</dd>
			</div>
			<div class="flex flex-col gap-0.5">
				<dt class="text-footnote text-ink-secondary">Failed</dt>
				<dd class="text-title-2 tabular-nums {failed.length > 0 ? 'text-caution-ink' : 'text-ink'}">
					{formatCount(counts?.failed ?? 0)}
				</dd>
			</div>
			<div class="flex flex-col gap-0.5">
				<dt class="text-footnote text-ink-secondary">Evidence uploads</dt>
				<dd class="text-title-2 text-ink tabular-nums">
					{formatCount(
						(counts?.assetsPending ?? 0) +
							(counts?.assetsUploading ?? 0) +
							(counts?.assetsFailed ?? 0)
					)}
				</dd>
			</div>
		</dl>

		<div class="flex flex-col gap-2">
			<Button
				variant="primary"
				fullWidth
				disabled={!online}
				loading={pushing}
				loadingLabel="Syncing…"
				onclick={syncNow}
			>
				{#snippet icon()}
					<UploadCloud size={18} strokeWidth={1.75} aria-hidden="true" />
				{/snippet}
				Sync now
			</Button>
			<Button
				variant="secondary"
				fullWidth
				disabled={!online}
				loading={pulling}
				loadingLabel="Checking…"
				onclick={pullChanges}
			>
				{#snippet icon()}
					<RefreshCw size={18} strokeWidth={1.75} aria-hidden="true" />
				{/snippet}
				Check for server changes
			</Button>
			{#if lastPull}
				<p class="text-center text-footnote text-ink-tertiary">
					Last checked {formatDateTime(lastPull)}
				</p>
			{/if}
		</div>

		{#if conflicts.length > 0}
			<section class="flex flex-col gap-2" aria-labelledby="conflicts-heading">
				<h2 id="conflicts-heading" class="text-title-3 text-ink">Conflicts</h2>
				<p class="text-footnote text-ink-secondary">
					The server changed these records first. Review both values before deciding.
				</p>
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each conflicts as operation (operation.idempotencyKey)}
						<li class="flex flex-col gap-2 rounded-lg border border-critical bg-critical-soft p-3">
							<div class="flex items-start justify-between gap-2">
								<div class="flex min-w-0 flex-col gap-0.5">
									<span class="text-callout break-words text-ink">
										{ENTITY_LABELS[operation.entity]} · {OP_LABELS[operation.op]}
									</span>
									<span class="text-footnote break-words text-critical-ink">
										{operation.lastError ?? 'This record changed on the server.'}
									</span>
								</div>
								<Badge label="Conflict" tone="danger" />
							</div>
							<Button variant="secondary" onclick={() => openConflict(operation)}>
								{#snippet icon()}
									<TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
								{/snippet}
								Compare both versions
							</Button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if failed.length > 0}
			<section class="flex flex-col gap-2" aria-labelledby="failed-heading">
				<h2 id="failed-heading" class="text-title-3 text-ink">Failed</h2>
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each failed as operation (operation.idempotencyKey)}
						<li class="flex flex-col gap-2 rounded-lg border border-hairline bg-canvas p-3">
							<div class="flex items-start justify-between gap-2">
								<div class="flex min-w-0 flex-col gap-0.5">
									<span class="text-callout break-words text-ink">
										{ENTITY_LABELS[operation.entity]} · {OP_LABELS[operation.op]}
									</span>
									<span class="text-footnote break-words text-caution-ink">
										{operation.lastError ?? 'This operation did not reach the server.'}
									</span>
									<span class="text-footnote text-ink-tertiary">
										Queued {formatDateTime(operation.createdAt)} · {operation.attempts}
										{operation.attempts === 1 ? 'attempt' : 'attempts'}
									</span>
								</div>
								<Badge label="Failed" tone="warning" />
							</div>
							<Button
								variant="secondary"
								disabled={!online || retryingKey === operation.idempotencyKey}
								loading={retryingKey === operation.idempotencyKey}
								loadingLabel="Retrying…"
								onclick={() => retryOperation(operation)}
							>
								{#snippet icon()}
									<RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
								{/snippet}
								Retry
							</Button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if queued.length > 0}
			<section class="flex flex-col gap-2" aria-labelledby="queued-heading">
				<h2 id="queued-heading" class="text-title-3 text-ink">Waiting to send</h2>
				<ul class="flex list-none flex-col gap-2 p-0">
					{#each queued as operation (operation.idempotencyKey)}
						<li
							class="flex items-start justify-between gap-2 rounded-lg border border-hairline bg-canvas p-3"
						>
							<div class="flex min-w-0 flex-col gap-0.5">
								<span class="text-callout break-words text-ink">
									{ENTITY_LABELS[operation.entity]} · {OP_LABELS[operation.op]}
								</span>
								<span class="text-footnote text-ink-secondary">
									{operation.localId === operation.idempotencyKey
										? 'Record'
										: `Record ${shortId(operation.localId)}`} · queued {formatDateTime(
										operation.createdAt
									)}
								</span>
							</div>
							<Badge label="Queued" tone="neutral" />
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if conflicts.length === 0 && failed.length === 0 && queued.length === 0}
			<EmptyState
				title="Everything is synced."
				description="New site captures will appear here while they wait for a connection."
			/>
		{/if}

		{#if sentCount > 0}
			<section class="flex flex-col gap-2" aria-labelledby="sent-heading">
				<h2 id="sent-heading" class="text-title-3 text-ink">Sent</h2>
				<p class="text-footnote text-ink-secondary">
					{formatCount(sentCount)}
					{sentCount === 1 ? 'operation has' : 'operations have'} reached the server from this device.
				</p>
				<Button
					variant="tertiary"
					disabled={clearing}
					loading={clearing}
					loadingLabel="Clearing…"
					onclick={clearSent}
				>
					{#snippet icon()}
						<Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
					{/snippet}
					Clear sent operations
				</Button>
			</section>
		{/if}

		<p class="text-footnote text-ink-tertiary">
			The queue is stored with this device. Closing the tab or losing signal does not lose a change.
		</p>
	</div>

	<ConflictSheet
		bind:open={conflictOpen}
		operation={conflictTarget}
		saving={resolving}
		error={resolveError}
		onresolve={resolveConflict}
	/>
{/if}
