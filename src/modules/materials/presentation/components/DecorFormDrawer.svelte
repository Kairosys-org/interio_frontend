<script lang="ts">
	import { isApiError } from '$network/errors';
	import {
		DECOR_COLOUR_FAMILIES,
		DECOR_CORES,
		DECOR_MATERIAL_TYPES,
		GRAIN_DIRECTIONS,
		PREMIUM_TIERS
	} from '$shared/domain/record-states';
	import type {
		DecorColourFamily,
		DecorCore,
		DecorMaterialType,
		GrainDirection,
		PremiumTier
	} from '$shared/domain/record-states';
	import { Button, Checkbox, Dialog, Input, Select } from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { Decor, DecorDuplicateCandidate } from '../../domain/types';
	import { decorFormSchema, fieldErrorsFrom } from '../../domain/validations';
	import {
		COLOUR_FAMILY_LABELS,
		DECOR_CORE_LABELS,
		GRAIN_DIRECTION_LABELS,
		MATERIAL_TYPE_LABELS,
		PREMIUM_TIER_LABELS
	} from '../materials-display';

	/**
	 * Create / edit decor dialog (phase-3 §1 materials).
	 *
	 * Manufacturer → collection → decor is one level deep. Choosing a
	 * manufacturer narrows the collection list; the code is unique inside a
	 * collection, which is what makes importing by code safe.
	 */
	interface Props {
		open?: boolean;
		decor?: Decor | null;
		onClose: () => void;
		onSaved: (decor: Decor, candidates: DecorDuplicateCandidate[]) => void;
	}

	let { open = $bindable(false), decor = null, onClose, onSaved }: Props = $props();

	const editing = $derived(decor !== null);

	let manufacturers = $state<
		Array<{ id: string; caption: string; collections: Array<{ id: string; caption: string }> }>
	>([]);
	let manufacturersError = $state<string | null>(null);

	let manufacturerId = $state('');
	let collectionId = $state('');
	let caption = $state('');
	let decorCode = $state('');
	let colourFamily = $state<DecorColourFamily | ''>('');
	let materialType = $state<DecorMaterialType>('melamine_board');
	let core = $state<DecorCore>('chipboard');
	let thickness = $state('18');
	let sheetLength = $state('2800');
	let sheetWidth = $state('2070');
	let grainDirection = $state<GrainDirection | ''>('');
	let premiumTier = $state<PremiumTier>('standard');
	let customerVisible = $state(true);

	let errors = $state<Record<string, string>>({});
	let serverError = $state<string | null>(null);
	let submitting = $state(false);
	let loadedOnce = false;

	const collectionOptions = $derived(
		manufacturers
			.find((node) => node.id === manufacturerId)
			?.collections.map((collection) => ({ value: collection.id, label: collection.caption })) ?? []
	);

	const colourOptions = [
		{ value: '', label: 'No colour family' },
		...DECOR_COLOUR_FAMILIES.map((value) => ({ value, label: COLOUR_FAMILY_LABELS[value] }))
	];
	const materialOptions = DECOR_MATERIAL_TYPES.map((value) => ({
		value,
		label: MATERIAL_TYPE_LABELS[value]
	}));
	const coreOptions = DECOR_CORES.map((value) => ({ value, label: DECOR_CORE_LABELS[value] }));
	const grainOptions = [
		{ value: '', label: 'No grain' },
		...GRAIN_DIRECTIONS.map((value) => ({ value, label: GRAIN_DIRECTION_LABELS[value] }))
	];
	const tierOptions = PREMIUM_TIERS.map((value) => ({
		value,
		label: PREMIUM_TIER_LABELS[value]
	}));

	$effect(() => {
		if (!open) return;
		if (!loadedOnce) {
			loadedOnce = true;
			void loadManufacturers();
		}
	});

	let wasOpen = false;
	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;

		caption = decor?.caption ?? '';
		decorCode = decor?.decorCode ?? '';
		colourFamily = decor?.colourFamily ?? '';
		materialType = decor?.materialType ?? 'melamine_board';
		core = decor?.core ?? 'chipboard';
		thickness = String(decor?.defaultThicknessMm ?? 18);
		sheetLength = String(decor?.sheetSizeMm.length ?? 2800);
		sheetWidth = String(decor?.sheetSizeMm.width ?? 2070);
		grainDirection = decor?.grainDirection ?? '';
		premiumTier = decor?.premiumTier ?? 'standard';
		customerVisible = decor?.customerVisible ?? true;
		collectionId = decor?.collectionId ?? '';
		errors = {};
		serverError = null;
		submitting = false;
	});

	$effect(() => {
		if (!open || manufacturers.length === 0) return;
		if (decor !== null) {
			const owner = manufacturers.find((node) =>
				node.collections.some((collection) => collection.id === decor.collectionId)
			);
			if (owner && manufacturerId === '') manufacturerId = owner.id;
			return;
		}
		if (manufacturerId === '' && manufacturers[0]) manufacturerId = manufacturers[0].id;
	});

	$effect(() => {
		if (decor !== null) return;
		if (collectionId !== '' && collectionOptions.some((option) => option.value === collectionId))
			return;
		collectionId = collectionOptions[0]?.value ?? '';
	});

	async function loadManufacturers(): Promise<void> {
		manufacturersError = null;
		try {
			const tree = await materialsApi.listManufacturers();
			manufacturers = tree.map((node) => ({
				id: node.manufacturer.id,
				caption: node.manufacturer.caption,
				collections: node.collections.map((entry) => ({
					id: entry.collection.id,
					caption: entry.collection.caption
				}))
			}));
		} catch (caught) {
			manufacturers = [];
			manufacturersError = isApiError(caught) ? caught.message : 'We could not load manufacturers.';
		}
	}

	function close(): void {
		if (submitting) return;
		onClose();
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = null;

		const parsed = decorFormSchema.safeParse({
			collectionId,
			caption,
			decorCode,
			colourFamily: colourFamily === '' ? null : colourFamily,
			materialType,
			core,
			defaultThicknessMm: Number(thickness),
			sheetSizeMm: { length: Number(sheetLength), width: Number(sheetWidth) },
			grainDirection: grainDirection === '' ? null : grainDirection,
			premiumTier,
			customerVisible
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			const saved =
				decor === null
					? await materialsApi.createDecor(parsed.data)
					: await materialsApi.updateDecor(decor.id, parsed.data);
			open = false;
			if ('decor' in saved) onSaved(saved.decor, saved.candidates);
			else onSaved(saved, []);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this decor. Try again.';
			}
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
		form="decor-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{editing ? 'Save decor' : 'Create decor'}
	</Button>
{/snippet}

<Dialog
	bind:open
	title={editing ? 'Edit decor' : 'New decor'}
	description="Decors belong to a manufacturer collection. The code is unique within the collection."
	size="lg"
	{footer}
	onclose={onClose}
>
	<form
		id="decor-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label={editing ? 'Edit decor' : 'New decor'}
	>
		<Select
			label="Manufacturer"
			required
			bind:value={manufacturerId}
			options={manufacturers.map((node) => ({ value: node.id, label: node.caption }))}
			placeholder={manufacturers.length === 0 ? 'No manufacturers yet' : 'Choose a manufacturer'}
			hint={manufacturersError ?? undefined}
			disabled={submitting || manufacturers.length === 0}
		/>

		<Select
			label="Collection"
			required
			bind:value={collectionId}
			options={collectionOptions}
			placeholder="Choose a collection"
			error={errors.collectionId}
			disabled={submitting || collectionOptions.length === 0}
		/>

		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				label="Caption"
				required
				bind:value={caption}
				maxlength={120}
				error={errors.caption}
				disabled={submitting}
			/>
			<Input
				label="Decor code"
				required
				bind:value={decorCode}
				maxlength={64}
				placeholder="H1180"
				error={errors.decorCode}
				disabled={submitting}
			/>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<Select
				label="Colour family"
				bind:value={colourFamily}
				options={colourOptions}
				error={errors.colourFamily}
				disabled={submitting}
			/>
			<Select
				label="Material type"
				bind:value={materialType}
				options={materialOptions}
				error={errors.materialType}
				disabled={submitting}
			/>
		</div>

		<div class="grid gap-4 sm:grid-cols-3">
			<Select
				label="Core"
				bind:value={core}
				options={coreOptions}
				error={errors.core}
				disabled={submitting}
			/>
			<Input
				label="Thickness (mm)"
				type="number"
				bind:value={thickness}
				error={errors.defaultThicknessMm}
				disabled={submitting}
			/>
			<Select
				label="Premium tier"
				bind:value={premiumTier}
				options={tierOptions}
				error={errors.premiumTier}
				disabled={submitting}
			/>
		</div>

		<div class="grid gap-4 sm:grid-cols-3">
			<Input
				label="Sheet length (mm)"
				type="number"
				bind:value={sheetLength}
				error={errors['sheetSizeMm.length']}
				disabled={submitting}
			/>
			<Input
				label="Sheet width (mm)"
				type="number"
				bind:value={sheetWidth}
				error={errors['sheetSizeMm.width']}
				disabled={submitting}
			/>
			<Select
				label="Grain direction"
				bind:value={grainDirection}
				options={grainOptions}
				error={errors.grainDirection}
				disabled={submitting}
			/>
		</div>

		<Checkbox
			label="Visible to customers"
			bind:checked={customerVisible}
			description="Hidden decors stay available to the team and quote builder."
			disabled={submitting}
		/>

		{#if serverError}
			<p class="text-callout text-critical-ink" role="alert">{serverError}</p>
		{/if}
	</form>
</Dialog>
