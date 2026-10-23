<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import type { ProjectStatus } from '$shared/domain/record-states';
	import { stateLabel } from '$shared/lib/status';
	import { Button, Dialog, Textarea } from '$shared/presentation/ui';

	/**
	 * Confirmation for one project status change. On hold and cancelled require
	 * a reason (mirroring the server rule); completed and resume do not, but
	 * still confirm because they change what the team can do next.
	 */
	interface Props {
		open?: boolean;
		target: ProjectStatus | null;
		saving?: boolean;
		error?: string | null;
		onconfirm: (reason: string) => void | Promise<void>;
	}

	let {
		open = $bindable(false),
		target,
		saving = false,
		error = null,
		onconfirm
	}: Props = $props();

	const MAX_REASON = 500;

	const reasonRequired = $derived(target === 'on_hold' || target === 'cancelled');
	const title = $derived(
		target === 'on_hold'
			? 'Put this project on hold?'
			: target === 'cancelled'
				? 'Cancel this project?'
				: target === 'completed'
					? 'Mark this project completed?'
					: target === 'active'
						? 'Resume this project?'
						: 'Change project status'
	);
	const description = $derived(
		target === 'on_hold'
			? 'Work pauses until the project is resumed. The reason is recorded in the audit trail.'
			: target === 'cancelled'
				? 'This cannot be undone. The project stays on record and is audited, but no work can continue.'
				: target === 'completed'
					? 'Completed is final. Make sure every open item is closed first.'
					: 'The project returns to Active so the team can continue.'
	);
	const confirmLabel = $derived(
		target === 'on_hold'
			? 'Put on hold'
			: target === 'cancelled'
				? 'Cancel project'
				: target === 'completed'
					? 'Mark completed'
					: target === 'active'
						? 'Resume project'
						: 'Change status'
	);

	let reason = $state('');
	let localError = $state<string | null>(null);
	let submitting = $state(false);
	let previousTarget: ProjectStatus | null = null;

	$effect(() => {
		const current = open ? target : null;
		if (current === previousTarget) return;
		previousTarget = current;
		reason = '';
		localError = null;
	});

	const busy = $derived(saving || submitting);
	const shownError = $derived(error ?? localError);

	async function submit(): Promise<void> {
		if (busy || target === null) return;
		localError = null;

		const trimmed = reason.trim();
		if (reasonRequired) {
			if (trimmed.length === 0) {
				localError =
					target === 'on_hold'
						? 'Enter a reason before putting the project on hold.'
						: 'Enter a reason before cancelling the project.';
				return;
			}
			if (trimmed.length > MAX_REASON) {
				localError = `Keep the reason to ${MAX_REASON} characters or fewer.`;
				return;
			}
		}

		submitting = true;
		try {
			await onconfirm(trimmed);
		} catch {
			// The page owns the message; keep the dialog open on failure.
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog
	bind:open
	{title}
	{description}
	onclose={() => {
		localError = null;
	}}
>
	<div class="flex flex-col gap-4">
		{#if target}
			<p class="text-callout text-ink-secondary">
				The project moves to <span class="text-ink">{stateLabel(target)}</span>.
			</p>
		{/if}

		{#if reasonRequired}
			<Textarea
				label="Reason"
				required
				bind:value={reason}
				rows={4}
				maxlength={MAX_REASON}
				hint="This reason appears in the project's activity trail."
				error={shownError ?? undefined}
				oninput={() => (localError = null)}
			/>
		{:else if shownError}
			<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{shownError}</span>
			</p>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="secondary" disabled={busy} onclick={() => (open = false)}>Cancel</Button>
		<Button
			variant={target === 'cancelled' ? 'destructive' : 'primary'}
			loading={busy}
			loadingLabel="Saving…"
			onclick={() => void submit()}
		>
			{confirmLabel}
		</Button>
	{/snippet}
</Dialog>
