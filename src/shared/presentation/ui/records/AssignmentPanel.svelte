<script lang="ts">
	import { CircleAlert, X } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import Checkbox from '../choice/Checkbox.svelte';
	import Skeleton from '../feedback/Skeleton.svelte';
	import IconButton from '../button/IconButton.svelte';
	import Input from '../input/Input.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';

	interface Assignment {
		id: string;
		userId: string;
		userName: string;
		userEmail: string;
	}

	interface Surveyor {
		id: string;
		displayName: string;
		email: string;
		assigned: boolean;
	}

	interface Props {
		assignments: Assignment[];
		surveyors: Surveyor[];
		loading?: boolean;
		saving?: boolean;
		error?: string | null;
		onadd: (userId: string) => void | Promise<void>;
		onremove: (userId: string) => void | Promise<void>;
		class?: string;
	}

	let {
		assignments,
		surveyors,
		loading = false,
		saving = false,
		error = null,
		onadd,
		onremove,
		class: className
	}: Props = $props();

	let filter = $state('');
	let busyUserId = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let pendingRemoval = $state<Assignment | null>(null);
	let removeOpen = $state(false);

	const assignedIds = $derived(new Set(assignments.map((assignment) => assignment.userId)));

	const available = $derived(
		surveyors
			.filter((surveyor) => !surveyor.assigned && !assignedIds.has(surveyor.id))
			.filter((surveyor) => {
				const query = filter.trim().toLowerCase();
				if (query === '') return true;
				return (
					surveyor.displayName.toLowerCase().includes(query) ||
					surveyor.email.toLowerCase().includes(query)
				);
			})
	);

	const summary = $derived(
		`${assignments.length} ${assignments.length === 1 ? 'surveyor' : 'surveyors'} assigned`
	);

	const removalName = $derived(pendingRemoval?.userName ?? 'this surveyor');
	const shownError = $derived(error ?? actionError);

	async function handleAdd(userId: string): Promise<void> {
		if (saving || busyUserId !== null) return;
		actionError = null;
		busyUserId = userId;
		try {
			await onadd(userId);
		} catch {
			actionError = 'We could not add this surveyor. Try again.';
		} finally {
			busyUserId = null;
		}
	}

	function openRemove(assignment: Assignment): void {
		actionError = null;
		pendingRemoval = assignment;
		removeOpen = true;
	}

	async function handleRemove(): Promise<void> {
		const target = pendingRemoval;
		if (!target) return;
		await onremove(target.userId);
		pendingRemoval = null;
	}

	function handleSurveyorChange(event: Event, surveyorId: string): void {
		const input = event.currentTarget as HTMLInputElement;
		if (!input.checked) return;
		void handleAdd(surveyorId);
	}
</script>

<div class={cn('flex flex-col gap-6', className)}>
	{#if shownError}
		<p class="flex items-start gap-2 text-callout text-critical-ink" role="alert">
			<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
			<span>{shownError}</span>
		</p>
	{/if}

	<div class="flex flex-col gap-2">
		<h3 class="text-subheadline text-ink">Assigned surveyors</h3>
		<p class="text-footnote text-ink-secondary" role="status" aria-live="polite">{summary}</p>

		{#if loading}
			<div class="flex flex-col gap-2" role="status" aria-live="polite">
				<span class="sr-only">Loading surveyor assignments</span>
				<Skeleton />
				<Skeleton />
			</div>
		{:else if assignments.length === 0}
			<div class="rounded-md border border-dashed border-hairline-strong bg-canvas-grouped p-4">
				<p class="text-callout text-ink">No surveyors assigned yet.</p>
				<p class="text-footnote text-ink-secondary">
					Mobile survey capture is only available to assigned surveyors. Add at least one before the
					survey is scheduled.
				</p>
			</div>
		{:else}
			<ul class="flex list-none flex-wrap gap-2 p-0">
				{#each assignments as assignment (assignment.id)}
					<li
						class="inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas-grouped py-1 ps-4 pe-1"
					>
						<span class="flex min-w-0 flex-col">
							<span class="text-callout text-ink">{assignment.userName}</span>
							<span class="text-footnote text-ink-secondary">{assignment.userEmail}</span>
						</span>
						<IconButton
							label={`Remove ${assignment.userName}`}
							onclick={() => openRemove(assignment)}
							disabled={saving}
						>
							{#snippet icon()}
								<X size={20} strokeWidth={1.75} aria-hidden="true" />
							{/snippet}
						</IconButton>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="flex flex-col gap-2">
		<h3 class="text-subheadline text-ink">Add a surveyor</h3>

		<Input
			label="Find a surveyor"
			type="search"
			bind:value={filter}
			placeholder="Search by name or email"
			autocomplete="off"
		/>

		{#if loading}
			<p class="text-footnote text-ink-secondary">Loading available surveyors…</p>
		{:else if available.length === 0}
			<p class="text-footnote text-ink-secondary">
				{filter.trim() === ''
					? 'Every surveyor is already assigned.'
					: 'No surveyors match this search.'}
			</p>
		{:else}
			<ul class="flex list-none flex-col p-0">
				{#each available as surveyor (surveyor.id)}
					<li>
						<Checkbox
							label={surveyor.displayName}
							description={surveyor.email}
							checked={false}
							disabled={saving || busyUserId !== null}
							onchange={(event) => handleSurveyorChange(event, surveyor.id)}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<ConfirmDialog
		bind:open={removeOpen}
		title={`Remove ${removalName}?`}
		description="Existing surveys stay on this project. They will not be able to start new surveys until they are assigned again."
		confirmLabel="Remove assignment"
		destructive
		loading={saving}
		onconfirm={handleRemove}
	/>
</div>
