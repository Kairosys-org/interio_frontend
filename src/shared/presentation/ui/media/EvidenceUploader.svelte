<script lang="ts">
	import {
		CircleAlert,
		CircleCheck,
		Clock3,
		ImageOff,
		LoaderCircle,
		UploadCloud
	} from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import { formatFileSize } from '$shared/lib/format';
	import IconButton from '../button/IconButton.svelte';
	import Progress from '../feedback/Progress.svelte';
	import { canRenderPreview, type EvidenceFile } from './types';

	/**
	 * Evidence upload (DESIGN §9.2, spec Part 9 §12).
	 *
	 * The primitive owns the drop zone, the native picker and the queue rows;
	 * the page owns the actual upload and passes `files` plus callbacks. That
	 * keeps every API call out of shared UI. Required state is stated in text,
	 * and each row names its state in words as well as colour.
	 */
	interface Props {
		files: EvidenceFile[];
		onadd: (files: File[]) => void;
		onretry?: (id: string) => void;
		onreplace?: (id: string) => void;
		onremove?: (id: string) => void;
		/** Blocks the gated action until at least one file is complete. */
		required?: boolean;
		multiple?: boolean;
		accept?: string;
		label?: string;
		hint?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		files,
		onadd,
		onretry,
		onreplace,
		onremove,
		required = false,
		multiple = true,
		accept = 'image/*,application/pdf',
		label = 'Evidence files',
		hint = 'Photos and PDF plans. Each file is checked against its SHA-256 before it is marked complete.',
		disabled = false,
		class: className
	}: Props = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let dragging = $state(false);

	const missingRequired = $derived(required && !files.some((file) => file.state === 'complete'));

	const STATE_TEXT: Record<EvidenceFile['state'], string> = {
		pending: 'Waiting to upload',
		uploading: 'Uploading',
		complete: 'Uploaded',
		failed: 'Upload failed'
	};

	function chooseFiles(): void {
		if (disabled) return;
		inputEl?.click();
	}

	function acceptFiles(list: FileList | null): void {
		if (!list || list.length === 0) return;
		const chosen = Array.from(list);
		onadd(multiple ? chosen : chosen.slice(0, 1));
	}

	function handleInput(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		acceptFiles(input.files);
		input.value = '';
	}

	function handleDragOver(event: DragEvent): void {
		if (disabled) return;
		event.preventDefault();
		dragging = true;
	}

	function handleDragLeave(): void {
		dragging = false;
	}

	function handleDrop(event: DragEvent): void {
		if (disabled) return;
		event.preventDefault();
		dragging = false;
		acceptFiles(event.dataTransfer?.files ?? null);
	}
</script>

<div class={cn('flex flex-col gap-3', className)}>
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h3 class="text-subheadline text-ink">
			{label}{#if required}<span class="text-footnote text-ink-tertiary">&nbsp;(required)</span
				>{/if}
		</h3>
		{#if files.length > 0}
			<p class="text-caption text-ink-secondary">
				{files.length}
				{files.length === 1 ? 'file' : 'files'}
			</p>
		{/if}
	</div>

	<div
		class={cn(
			'flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center',
			dragging ? 'border-brand bg-brand-soft' : 'border-hairline-strong bg-canvas-grouped',
			disabled && 'opacity-60'
		)}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		role="group"
		aria-label={`${label} drop zone`}
	>
		<UploadCloud size={24} strokeWidth={1.75} aria-hidden="true" class="text-ink-tertiary" />
		<p class="text-callout text-ink">Drop files here, or choose them from this device.</p>
		<input
			bind:this={inputEl}
			type="file"
			class="sr-only"
			{accept}
			{multiple}
			{disabled}
			onchange={handleInput}
			tabindex="-1"
			aria-hidden="true"
		/>
		<button
			type="button"
			onclick={chooseFiles}
			class="min-h-target touch-manipulation rounded-md border border-hairline-strong bg-canvas px-4 text-callout text-ink enabled:hover:bg-canvas-grouped disabled:cursor-not-allowed disabled:text-ink-disabled"
			{disabled}
		>
			Add files
		</button>
		<p class="max-w-content-reading text-footnote text-ink-secondary">{hint}</p>
	</div>

	{#if missingRequired}
		<p class="flex items-start gap-1 text-footnote text-critical-ink" role="status">
			<CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" class="mt-1 shrink-0" />
			<span>At least one file must finish uploading before you can continue.</span>
		</p>
	{/if}

	{#if files.length > 0}
		<ul class="flex flex-col gap-2">
			{#each files as file (file.id)}
				<li class="flex flex-col gap-2 rounded-lg border border-hairline bg-canvas p-3">
					<div class="flex items-start gap-3">
						<span
							class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-canvas-nested"
						>
							{#if canRenderPreview(file.previewUrl) && file.mimeType?.startsWith('image/')}
								<img src={file.previewUrl} alt="" loading="lazy" class="size-full object-cover" />
							{:else}
								<ImageOff
									size={20}
									strokeWidth={1.5}
									aria-hidden="true"
									class="text-ink-tertiary"
								/>
							{/if}
						</span>

						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<p class="truncate text-footnote text-ink">{file.name}</p>
							<p class="flex flex-wrap items-center gap-x-2 text-caption text-ink-secondary">
								<span>{formatFileSize(file.sizeBytes)}</span>
								<span
									class={cn(
										'inline-flex items-center gap-1',
										file.state === 'failed' && 'text-critical-ink',
										file.state === 'complete' && 'text-safe-ink'
									)}
								>
									{#if file.state === 'complete'}
										<CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />
									{:else if file.state === 'failed'}
										<CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
									{:else if file.state === 'uploading'}
										<LoaderCircle size={14} strokeWidth={1.75} aria-hidden="true" />
									{:else}
										<Clock3 size={14} strokeWidth={1.75} aria-hidden="true" />
									{/if}
									{STATE_TEXT[file.state]}
								</span>
							</p>
						</div>

						<div class="flex shrink-0 items-center gap-1">
							{#if file.state === 'failed' && onretry}
								<button
									type="button"
									onclick={() => onretry(file.id)}
									class="min-h-target touch-manipulation rounded-md px-3 text-caption text-brand hover:bg-canvas-grouped"
								>
									Retry
								</button>
							{/if}
							{#if onreplace && file.state !== 'uploading'}
								<button
									type="button"
									onclick={() => onreplace(file.id)}
									class="min-h-target touch-manipulation rounded-md px-3 text-caption text-ink-secondary hover:bg-canvas-grouped"
								>
									Replace
								</button>
							{/if}
							{#if onremove}
								<IconButton
									label={`Remove ${file.name}`}
									variant="destructive"
									disabled={file.state === 'uploading'}
									onclick={() => onremove(file.id)}
								>
									{#snippet icon()}
										<CircleAlert size={20} aria-hidden="true" />
									{/snippet}
								</IconButton>
							{/if}
						</div>
					</div>

					{#if file.state === 'uploading'}
						<Progress
							label={`Upload progress for ${file.name}`}
							value={file.progress ?? 0}
							valueLabel={`${Math.round(file.progress ?? 0)} %`}
						/>
					{/if}

					{#if file.error}
						<p class="text-footnote text-critical-ink">{file.error}</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
