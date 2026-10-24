<script lang="ts">
	import { CircleAlert, Plus, Trash2 } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import Button from '../button/Button.svelte';
	import IconButton from '../button/IconButton.svelte';
	import Input from '../input/Input.svelte';

	/**
	 * Free key/value attribute rows (DESIGN §12.5, phase-3 §4.2).
	 *
	 * Attributes extend a decor without a schema change, so this editor only
	 * reports the next array — uniqueness and persistence stay in the domain
	 * and data layers. Every row is a labelled pair of inputs and every action
	 * is a keyboard-operable 44 px control.
	 */
	interface AttributeRow {
		key: string;
		value: string;
	}

	interface Props {
		label?: string;
		rows: AttributeRow[];
		onchange: (rows: AttributeRow[]) => void;
		error?: string | null;
		disabled?: boolean;
		class?: string;
	}

	let {
		label = 'Attributes',
		rows,
		onchange,
		error = null,
		disabled = false,
		class: className
	}: Props = $props();

	const uid = $props.id();
	const errorId = `${uid}-error`;

	function update(index: number, patch: Partial<AttributeRow>): void {
		onchange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
	}

	function add(): void {
		onchange([...rows, { key: '', value: '' }]);
	}

	function remove(index: number): void {
		onchange(rows.filter((_, rowIndex) => rowIndex !== index));
	}
</script>

<fieldset
	class={cn('flex min-w-0 flex-col gap-4 border-0 p-0', className)}
	aria-describedby={error ? errorId : undefined}
>
	<legend class="p-0 text-subheadline text-ink">{label}</legend>

	{#if rows.length === 0}
		<p
			class="rounded-md border border-dashed border-hairline-strong px-4 py-6 text-callout text-ink-secondary"
		>
			No attributes yet. Add a key and value to describe this record.
		</p>
	{:else}
		<ul class="flex list-none flex-col gap-3 p-0">
			{#each rows as row, index (index)}
				<li class="flex flex-col gap-2 sm:flex-row sm:items-end">
					<div class="min-w-0 flex-1">
						<Input
							label={`Key ${index + 1}`}
							value={row.key}
							{disabled}
							autocomplete="off"
							oninput={(event) =>
								update(index, { key: (event.currentTarget as HTMLInputElement).value })}
						/>
					</div>

					<div class="min-w-0 flex-1">
						<Input
							label={`Value ${index + 1}`}
							value={row.value}
							{disabled}
							autocomplete="off"
							oninput={(event) =>
								update(index, { value: (event.currentTarget as HTMLInputElement).value })}
						/>
					</div>

					<IconButton
						label={`Remove attribute ${index + 1}`}
						variant="destructive"
						{disabled}
						onclick={() => remove(index)}
						class="self-end"
					>
						{#snippet icon()}
							<Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
						{/snippet}
					</IconButton>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="flex flex-wrap items-center gap-2">
		<Button variant="secondary" onclick={add} {disabled}>
			{#snippet icon()}
				<Plus size={16} strokeWidth={2} aria-hidden="true" />
			{/snippet}
			Add attribute
		</Button>
	</div>

	{#if error}
		<p id={errorId} role="alert" class="flex items-start gap-1 text-footnote text-critical-ink">
			<CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" class="mt-1 shrink-0" />
			<span>{error}</span>
		</p>
	{/if}
</fieldset>
