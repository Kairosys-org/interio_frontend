<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { AttributeEditor, Button } from '$shared/presentation/ui';
	import { materialsApi } from '../../data/api';
	import type { DecorAttribute } from '../../domain/types';
	import { decorAttributeFormSchema, normaliseDecorAttributeInput } from '../../domain/validations';

	/**
	 * Decor attributes (phase-3 §1 materials, §9.5).
	 *
	 * Free key/value pairs, saved as a set: added or changed keys are upserted,
	 * keys removed from the editor are unlinked. Attribute keys are only
	 * unique per decor; the mock rejects an empty pair and the domain schema
	 * repeats it here.
	 */
	interface Props {
		decorId: string;
		attributes: DecorAttribute[];
		canEdit: boolean;
		onChanged: () => void;
	}

	let { decorId, attributes, canEdit, onChanged }: Props = $props();

	interface Row {
		key: string;
		value: string;
	}

	let rows = $state<Row[]>([]);
	let error = $state<string | null>(null);
	let saving = $state(false);
	let syncedFor = '';

	$effect(() => {
		const snapshot = attributes
			.map((row) => `${row.attrName}\u0000${row.attrValue}`)
			.join('\u0001');
		if (syncedFor === snapshot) return;
		syncedFor = snapshot;
		rows = attributes.map((row) => ({ key: row.attrName, value: row.attrValue }));
	});

	const dirty = $derived.by(() => {
		const current = new Map(rows.map((row) => [row.key.trim(), row.value.trim()]));
		const baseline = new Map(attributes.map((row) => [row.attrName, row.attrValue]));
		if (current.size !== baseline.size) return true;
		for (const [key, value] of current) {
			if (baseline.get(key) !== value) return true;
		}
		return false;
	});

	async function save(): Promise<void> {
		error = null;

		const cleaned = rows.map((row) => ({
			key: row.key.trim(),
			value: row.value.trim()
		}));
		if (cleaned.some((row) => row.key === '' || row.value === '')) {
			error = 'Every attribute needs a key and a value.';
			return;
		}
		const names = cleaned.map((row) => row.key);
		if (new Set(names).size !== names.length) {
			error = 'Each attribute key can appear once.';
			return;
		}

		for (const row of cleaned) {
			const parsed = decorAttributeFormSchema.safeParse({
				attrName: row.key,
				attrValue: row.value
			});
			if (!parsed.success) {
				error = parsed.error.issues[0]?.message ?? 'Check the attribute values.';
				return;
			}
		}

		saving = true;
		try {
			for (const row of cleaned) {
				const normalised = normaliseDecorAttributeInput({
					attrName: row.key,
					attrValue: row.value
				});
				await materialsApi.upsertAttribute(decorId, {
					attrName: normalised.attrName ?? '',
					attrValue: normalised.attrValue ?? ''
				});
			}
			const keep = new Set(names);
			for (const attribute of attributes) {
				if (!keep.has(attribute.attrName)) {
					await materialsApi.removeAttribute(decorId, attribute.attrName);
				}
			}
			toast.success('Decor attributes saved.');
			onChanged();
		} catch (caught) {
			error = isApiError(caught) ? caught.message : 'We could not save the attributes. Try again.';
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	<AttributeEditor
		{rows}
		onchange={(next) => (rows = next)}
		{error}
		disabled={saving || !canEdit}
	/>

	{#if canEdit}
		<div class="flex flex-wrap items-center gap-3">
			<Button onclick={save} loading={saving} loadingLabel="Saving…" disabled={!dirty || saving}>
				Save attributes
			</Button>
			{#if dirty}
				<p class="text-footnote text-ink-secondary">Unsaved changes.</p>
			{/if}
		</div>
	{:else}
		<p class="text-footnote text-ink-secondary">
			You can view attributes but need materials.update to change them.
		</p>
	{/if}
</div>
