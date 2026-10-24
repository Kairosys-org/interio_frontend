<script lang="ts">
	import { isApiError } from '$network/errors';
	import { CABINET_PARAMETER_UNITS, type CabinetParameterUnit } from '$shared/domain/record-states';
	import { Checkbox, Input, Select, TableEditorDrawer, Textarea } from '$shared/presentation/ui';
	import { catalogueApi } from '../../data/api';
	import type { CabinetParameter, CabinetParameterInput } from '../../domain/types';
	import {
		fieldErrorsFrom,
		normaliseParameterInput,
		parameterSchema
	} from '../../domain/validations';
	import { PARAMETER_UNIT_LABELS, parameterHasBounds } from '../catalogue-display';

	/**
	 * Parameter editor (phase-3 §1, FT-M5-01).
	 *
	 * Bounds are typed before the save: a numeric parameter needs a number
	 * default inside min/max, an enum needs two unique choices, and `bool` /
	 * `text` carry no numeric bounds. The mock server repeats every rule.
	 */
	interface Props {
		open?: boolean;
		cabinetId: string;
		parameter?: CabinetParameter | null;
		onClose: () => void;
		onSaved: (parameter: CabinetParameter) => void;
	}

	let { open = $bindable(false), cabinetId, parameter = null, onClose, onSaved }: Props = $props();

	const editing = $derived(parameter !== null);
	const unitOptions = CABINET_PARAMETER_UNITS.map((unit) => ({
		value: unit,
		label: PARAMETER_UNIT_LABELS[unit]
	}));

	let paramName = $state('');
	let unit = $state<CabinetParameterUnit>('mm');
	let minValue = $state('');
	let maxValue = $state('');
	let defaultValue = $state('');
	let allowedValues = $state('');
	let required = $state(true);
	let sortOrder = $state('0');

	let errors = $state<Record<string, string>>({});
	let serverError = $state<string | null>(null);
	let submitting = $state(false);

	const numeric = $derived(parameterHasBounds(unit));
	const allowed = $derived(
		allowedValues
			.split(',')
			.map((value) => value.trim())
			.filter((value) => value.length > 0)
	);

	let wasOpen = false;
	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;

		paramName = parameter?.paramName ?? '';
		unit = parameter?.unit ?? 'mm';
		minValue =
			parameter?.minValue === null || parameter?.minValue === undefined
				? ''
				: String(parameter.minValue);
		maxValue =
			parameter?.maxValue === null || parameter?.maxValue === undefined
				? ''
				: String(parameter.maxValue);
		defaultValue =
			parameter?.defaultValue === null || parameter?.defaultValue === undefined
				? ''
				: String(parameter.defaultValue);
		allowedValues = parameter?.allowedValues?.join(', ') ?? '';
		required = parameter?.required ?? true;
		sortOrder = String(parameter?.sortOrder ?? 0);
		errors = {};
		serverError = null;
		submitting = false;
	});

	function parseNumber(value: string): number | null {
		const trimmed = value.trim();
		if (trimmed.length === 0) return null;
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : Number.NaN;
	}

	function buildDefault(): CabinetParameterInput['defaultValue'] {
		if (unit === 'mm' || unit === 'count') {
			const parsed = parseNumber(defaultValue);
			return parsed === null || Number.isNaN(parsed) ? null : parsed;
		}
		if (unit === 'bool') {
			if (defaultValue === 'true') return true;
			if (defaultValue === 'false') return false;
			return null;
		}
		if (unit === 'text' || unit === 'enum') {
			return defaultValue.trim().length > 0 ? defaultValue.trim() : null;
		}
		return null;
	}

	async function save(): Promise<void> {
		serverError = null;

		const input = normaliseParameterInput({
			...(parameter === null ? {} : { id: parameter.id }),
			paramName,
			unit,
			minValue: numeric ? parseNumber(minValue) : null,
			maxValue: numeric ? parseNumber(maxValue) : null,
			defaultValue: buildDefault(),
			allowedValues: unit === 'enum' ? allowed : null,
			required,
			sortOrder: Number.parseInt(sortOrder, 10)
		});

		const parsed = parameterSchema.safeParse(input);
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			const saved = await catalogueApi.saveParameter(cabinetId, parsed.data);
			open = false;
			onSaved(saved);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not save this parameter. Try again.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<TableEditorDrawer
	bind:open
	title={editing ? 'Edit parameter' : 'Add parameter'}
	description="Parameters drive placement and the component rules. Bounds are checked before saving."
	submitLabel={editing ? 'Save parameter' : 'Add parameter'}
	saving={submitting}
	error={serverError}
	onsave={save}
	onclose={onClose}
>
	<Input
		label="Parameter name"
		required
		bind:value={paramName}
		placeholder="door_width"
		hint="Lower snake_case, starting with a letter. Rules refer to this name."
		error={errors.paramName}
		disabled={submitting}
	/>

	<Select
		label="Type and unit"
		required
		bind:value={unit}
		options={unitOptions}
		error={errors.unit}
		disabled={submitting}
	/>

	{#if numeric}
		<div class="grid gap-4 sm:grid-cols-2">
			<Input
				label="Minimum"
				type="number"
				bind:value={minValue}
				error={errors.minValue}
				disabled={submitting}
			/>
			<Input
				label="Maximum"
				type="number"
				bind:value={maxValue}
				error={errors.maxValue}
				disabled={submitting}
			/>
		</div>
	{/if}

	{#if unit === 'enum'}
		<Textarea
			label="Allowed values"
			rows={3}
			bind:value={allowedValues}
			placeholder="white, grey, oak"
			hint="Comma separated. Add at least two unique values."
			error={errors.allowedValues}
			disabled={submitting}
		/>
		<Select
			label="Default"
			bind:value={defaultValue}
			options={allowed.map((value) => ({ value, label: value }))}
			placeholder="Choose a default"
			error={errors.defaultValue}
			disabled={submitting}
		/>
	{:else if unit === 'bool'}
		<Select
			label="Default"
			bind:value={defaultValue}
			options={[
				{ value: 'true', label: 'Yes' },
				{ value: 'false', label: 'No' }
			]}
			placeholder="No default"
			error={errors.defaultValue}
			disabled={submitting}
		/>
	{:else if unit === 'text'}
		<Input
			label="Default text"
			bind:value={defaultValue}
			error={errors.defaultValue}
			disabled={submitting}
		/>
	{:else}
		<Input
			label="Default"
			type="number"
			bind:value={defaultValue}
			error={errors.defaultValue}
			disabled={submitting}
		/>
	{/if}

	<div class="grid gap-4 sm:grid-cols-2">
		<Checkbox label="Required" bind:checked={required} disabled={submitting} />
		<Input
			label="Sort order"
			type="number"
			bind:value={sortOrder}
			min={0}
			error={errors.sortOrder}
			disabled={submitting}
		/>
	</div>
</TableEditorDrawer>
