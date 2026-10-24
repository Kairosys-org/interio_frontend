<script lang="ts">
	import { isApiError } from '$network/errors';
	import { MAX_PAGE_SIZE } from '$shared/domain/pagination';
	import { EDGING_MATCH_TYPES } from '$shared/domain/record-states';
	import type { EdgingMatchType } from '$shared/domain/record-states';
	import { Button, Dialog, Select } from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { DecorEdgingLink, Edging } from '../../domain/types';
	import { decorEdgingFormSchema } from '../../domain/validations';
	import { EDGING_MATCH_LABELS } from '../materials-display';

	/**
	 * Link an edging to a decor with a match type (phase-3 §1 materials).
	 *
	 * The edging list is loaded per opening and kept in a single page: eight
	 * seeded edgings, and the picker is search-free by design (DESIGN §9.3).
	 * Editing fixes the edging and changes only the match type.
	 */
	interface Props {
		open?: boolean;
		decorId: string;
		link?: DecorEdgingLink | null;
		onClose: () => void;
		onSaved: (link: DecorEdgingLink) => void;
	}

	let { open = $bindable(false), decorId, link = null, onClose, onSaved }: Props = $props();

	const editing = $derived(link !== null);

	let edgings = $state<Edging[]>([]);
	let edgingsLoading = $state(false);
	let edgingsError = $state<string | null>(null);
	let edgingId = $state('');
	let matchType = $state<EdgingMatchType>('exact');
	let serverError = $state<string | null>(null);
	let submitting = $state(false);

	const matchOptions = EDGING_MATCH_TYPES.map((value) => ({
		value,
		label: EDGING_MATCH_LABELS[value]
	}));

	const edgingOptions = $derived(
		edgings.map((row) => ({
			value: row.id,
			label: `${row.caption} · ${row.edgingCode} · ${row.thicknessMm} mm${row.active ? '' : ' (inactive)'}`
		}))
	);

	let loaded = false;
	let wasOpen = false;
	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;

		edgingId = link?.edgingId ?? '';
		matchType = link?.matchType ?? 'exact';
		serverError = null;
		submitting = false;
		if (!loaded) {
			loaded = true;
			void loadEdgings();
		}
	});

	async function loadEdgings(): Promise<void> {
		edgingsLoading = true;
		edgingsError = null;
		try {
			const page = await materialsApi.listEdgings({ active: 'all', pageSize: MAX_PAGE_SIZE });
			edgings = page.items;
			if (!editing && edgingId === '') {
				const firstActive = page.items.find((row) => row.active);
				edgingId = firstActive?.id ?? '';
			}
		} catch (caught) {
			edgings = [];
			edgingsError = isApiError(caught) ? caught.message : 'We could not load edgings.';
		} finally {
			edgingsLoading = false;
		}
	}

	function close(): void {
		if (submitting) return;
		onClose();
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = null;

		const parsed = decorEdgingFormSchema.safeParse({ edgingId, matchType });
		if (!parsed.success) {
			serverError = parsed.error.issues[0]?.message ?? 'Choose an edging.';
			return;
		}

		submitting = true;
		try {
			const saved = await materialsApi.linkEdging(decorId, parsed.data);
			open = false;
			onSaved(saved);
		} catch (caught) {
			serverError = isApiError(caught)
				? caught.message
				: 'We could not link this edging. Try again.';
		} finally {
			submitting = false;
		}
	}
</script>

{#snippet footer()}
	<Button variant="secondary" onclick={close} disabled={submitting}>Cancel</Button>
	<Button
		variant="primary"
		type="submit"
		form="decor-edging-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save match type' : 'Link edging'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit edging link' : 'Link an edging'}
	description="An exact match is the same finish; complementary and alternative describe the rest."
	{footer}
	onclose={onClose}
>
	<form id="decor-edging-form" class="flex flex-col gap-4" onsubmit={submit} novalidate>
		<Select
			label="Edging"
			required
			bind:value={edgingId}
			options={edgingOptions}
			placeholder={edgingsLoading
				? 'Loading edgings…'
				: edgings.length === 0
					? 'No edgings yet'
					: 'Choose an edging'}
			hint={edgingsError ?? undefined}
			error={serverError ?? undefined}
			disabled={submitting || edgingsLoading || edgings.length === 0 || editing}
		/>

		<Select
			label="Match type"
			required
			bind:value={matchType}
			options={matchOptions}
			disabled={submitting}
		/>

		{#if serverError && !edgingsError}
			<p class="text-callout text-critical-ink" role="alert">{serverError}</p>
		{/if}
	</form>
</Dialog>
