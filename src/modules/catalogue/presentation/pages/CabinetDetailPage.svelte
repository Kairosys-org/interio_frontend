<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { isUuid } from '$shared/domain/uuid';
	import { formatDate } from '$shared/lib/format';
	import {
		Badge,
		Breadcrumb,
		Button,
		DataTable,
		EmptyState,
		ForbiddenPage,
		PageHeader,
		PermissionGate,
		Skeleton,
		Switch,
		Tabs
	} from '$shared/presentation/ui';
	import { catalogueApi } from '../../data/api';
	import type { CabinetComponentRule, CabinetDetail, CabinetParameter } from '../../domain/types';
	import {
		cabinetFamilyLabel,
		cabinetStatusLabel,
		constructionMethodLabel,
		formatParameterBounds,
		formatParameterValue,
		PARAMETER_UNIT_LABELS
	} from '../catalogue-display';
	import CabinetFormDialog from '../components/CabinetFormDialog.svelte';
	import ParameterEditorDrawer from '../components/ParameterEditorDrawer.svelte';
	import RuleEditorDrawer from '../components/RuleEditorDrawer.svelte';

	/**
	 * `/catalogue/cabinets/[id]` (phase-3 §3).
	 *
	 * Parameters and component rules are separate tabs because they are saved
	 * by different editors with different validation. The Usage tab belongs to
	 * Phase 6 and is deliberately absent.
	 */
	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	const validId = $derived(isUuid(id));
	type TabId = 'parameters' | 'rules';

	function readTab(value: string | null): TabId {
		return value === 'rules' ? 'rules' : 'parameters';
	}

	let detail = $state<CabinetDetail | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let requestSequence = 0;
	let tabValue = $state<TabId>(readTab(page.url.searchParams.get('tab')));
	let lastUrlTab = readTab(page.url.searchParams.get('tab'));

	let editOpen = $state(false);
	let parameterOpen = $state(false);
	let parameterTarget = $state<CabinetParameter | null>(null);
	let ruleOpen = $state(false);
	let ruleSource = $state<CabinetComponentRule | null>(null);
	let togglingRuleId = $state<string | null>(null);

	const parameterNames = $derived(detail?.parameters.map((row) => row.paramName) ?? []);

	const tabs = $derived([
		{ id: 'parameters', label: `Parameters (${detail?.parameters.length ?? 0})` },
		{ id: 'rules', label: `Component rules (${detail?.rules.length ?? 0})` }
	]);

	$effect(() => {
		const value = page.params.id ?? '';
		if (!isUuid(value)) {
			loading = false;
			detail = null;
			notFound = true;
			error = null;
			return;
		}
		void load(value);
	});

	$effect(() => {
		const fromUrl = readTab(page.url.searchParams.get('tab'));
		if (fromUrl === lastUrlTab) return;
		lastUrlTab = fromUrl;
		tabValue = fromUrl;
	});

	$effect(() => {
		const next = readTab(tabValue);
		if (next === lastUrlTab) return;
		lastUrlTab = next;
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (next === 'parameters') params.delete('tab');
		else params.set('tab', next);
		const query = params.toString();
		void goto(resolve(`/catalogue/cabinets/${id}${query.length > 0 ? `?${query}` : ''}`), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	});

	async function load(cabinetId: string): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;
		notFound = false;

		try {
			const result = await catalogueApi.get(cabinetId);
			if (sequence !== requestSequence) return;
			detail = result;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			detail = null;
			if (isApiError(caught) && caught.isNotFound()) notFound = true;
			else error = isApiError(caught) ? caught.message : 'We could not load this cabinet.';
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	async function reload(): Promise<void> {
		if (!isUuid(id)) return;
		await load(id);
	}

	function onCabinetSaved(): void {
		toast.success('Cabinet saved.');
		void reload();
	}

	function addParameter(): void {
		parameterTarget = null;
		parameterOpen = true;
	}

	function editParameter(parameter: CabinetParameter): void {
		parameterTarget = parameter;
		parameterOpen = true;
	}

	function onParameterSaved(): void {
		toast.success('Parameter saved.');
		void reload();
	}

	function onRuleSaved(): void {
		toast.success('Component rule saved.');
		void reload();
	}

	function newRule(): void {
		ruleSource = null;
		ruleOpen = true;
	}

	function newRuleVersion(rule: CabinetComponentRule): void {
		ruleSource = rule;
		ruleOpen = true;
	}

	async function toggleRule(rule: CabinetComponentRule, active: boolean): Promise<void> {
		if (togglingRuleId !== null) return;
		togglingRuleId = rule.id;
		try {
			const saved = await catalogueApi.setRuleActive(rule.id, active);
			if (detail !== null) {
				detail = {
					...detail,
					rules: detail.rules.map((row) => (row.id === saved.id ? saved : row))
				};
			}
			toast.success(active ? 'Rule activated.' : 'Rule deactivated.');
		} catch (caught) {
			toast.error(isApiError(caught) ? caught.message : 'We could not change this rule.');
		} finally {
			togglingRuleId = null;
		}
	}
</script>

{#if !validId}
	<ForbiddenPage
		variant="not-found"
		title="Cabinet not found."
		description="This cabinet does not exist or is no longer available."
		backHref={resolve('/catalogue/cabinets')}
		backLabel="Back to cabinets"
	/>
{:else if loading}
	<div class="flex flex-col gap-6" aria-busy="true" aria-label="Loading cabinet">
		<h1 class="sr-only">Loading cabinet</h1>
		<Skeleton lines={1} class="max-w-content-reading" />
		<Skeleton variant="block" />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Cabinet not found."
		description="This cabinet does not exist or is no longer available."
		backHref={resolve('/catalogue/cabinets')}
		backLabel="Back to cabinets"
	/>
{:else if detail !== null}
	<div class="flex flex-col gap-6">
		<PageHeader
			eyebrow={cabinetFamilyLabel(detail.cabinet.family)}
			title={detail.cabinet.caption}
			description={detail.cabinet.description ?? 'Parametric cabinet in the master catalogue.'}
		>
			{#snippet breadcrumbs()}
				<Breadcrumb
					items={[
						{ label: 'Catalogue', href: resolve('/catalogue/cabinets') },
						{ label: 'Cabinets', href: resolve('/catalogue/cabinets') },
						{ label: detail?.cabinet.caption ?? 'Cabinet' }
					]}
				/>
			{/snippet}
			{#snippet actions()}
				<PermissionGate permission={PERMISSIONS.CABINET_UPDATE}>
					<Button variant="secondary" onclick={() => (editOpen = true)}>Edit cabinet</Button>
				</PermissionGate>
			{/snippet}
		</PageHeader>

		<div class="flex flex-wrap items-center gap-2">
			<Badge
				label={cabinetStatusLabel(detail.cabinet.active)}
				tone={detail.cabinet.active ? 'success' : 'neutral'}
			/>
			<Badge label={constructionMethodLabel(detail.cabinet.constructionMethod)} tone="info" />
			<p class="text-footnote text-ink-secondary">
				Updated {formatDate(detail.cabinet.updatedAt)}
			</p>
		</div>

		{#if error}
			<p class="text-callout text-critical-ink" role="alert">{error}</p>
		{/if}

		<div class="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
			<Tabs label="Cabinet sections" {tabs} bind:value={tabValue} />
			<div class="flex flex-wrap gap-2">
				{#if tabValue === 'parameters'}
					<PermissionGate permission={PERMISSIONS.CABINET_UPDATE}>
						<Button onclick={addParameter}>
							{#snippet icon()}<Plus size={18} strokeWidth={1.75} aria-hidden="true" />{/snippet}
							Add parameter
						</Button>
					</PermissionGate>
				{:else}
					<PermissionGate permission={PERMISSIONS.CABINET_UPDATE}>
						<Button onclick={newRule}>
							{#snippet icon()}<Plus size={18} strokeWidth={1.75} aria-hidden="true" />{/snippet}
							New component rule
						</Button>
					</PermissionGate>
				{/if}
			</div>
		</div>

		{#if tabValue === 'parameters'}
			{#if detail.parameters.length === 0}
				<EmptyState
					title="No parameters yet"
					description="Add the dimensions and choices this cabinet offers at placement."
				/>
			{:else}
				<DataTable
					caption="Cabinet parameters"
					columns={[
						{ key: 'name', label: 'Parameter' },
						{ key: 'unit', label: 'Type' },
						{ key: 'bounds', label: 'Bounds' },
						{ key: 'default', label: 'Default' },
						{ key: 'required', label: 'Required' },
						{ key: 'order', label: 'Order', align: 'end' }
					]}
					rows={detail.parameters}
					rowKey={(row) => row.id}
					density="compact"
				>
					{#snippet cell({ row, column })}
						{#if column.key === 'name'}
							<span class="font-mono text-callout text-ink">{row.paramName}</span>
						{:else if column.key === 'unit'}
							{PARAMETER_UNIT_LABELS[row.unit]}
						{:else if column.key === 'bounds'}
							{formatParameterBounds(row)}
						{:else if column.key === 'default'}
							{formatParameterValue(row)}
						{:else if column.key === 'required'}
							{row.required ? 'Yes' : 'No'}
						{:else if column.key === 'order'}
							{row.sortOrder}
						{/if}
					{/snippet}
					{#snippet actions(row)}
						<PermissionGate permission={PERMISSIONS.CABINET_UPDATE}>
							<Button variant="tertiary" onclick={() => editParameter(row)}>
								Edit<span class="sr-only"> {row.paramName}</span>
							</Button>
						</PermissionGate>
					{/snippet}
				</DataTable>
			{/if}
		{:else if detail.rules.length === 0}
			<EmptyState
				title="No component rules yet"
				description="Rules describe the parts a cabinet produces. The engineering engine lands in Phase 6."
			/>
		{:else}
			<DataTable
				caption="Cabinet component rules"
				columns={[
					{ key: 'version', label: 'Version' },
					{ key: 'partType', label: 'Part type' },
					{ key: 'condition', label: 'Condition' },
					{ key: 'updated', label: 'Updated' },
					{ key: 'active', label: 'Active' }
				]}
				rows={detail.rules}
				rowKey={(row) => row.id}
				density="compact"
			>
				{#snippet cell({ row, column })}
					{#if column.key === 'version'}
						<Badge label={`v${row.ruleVersion}`} tone="info" />
					{:else if column.key === 'partType'}
						<span class="font-mono text-callout text-ink">{row.partType}</span>
					{:else if column.key === 'condition'}
						{row.condition === null ? 'Always' : 'Conditional'}
					{:else if column.key === 'updated'}
						{formatDate(row.updatedAt)}
					{:else if column.key === 'active'}
						<PermissionGate permission={PERMISSIONS.CABINET_UPDATE}>
							<Switch
								label="Active"
								checked={row.active}
								disabled={togglingRuleId !== null}
								onchange={(checked) => void toggleRule(row, checked)}
							/>
						</PermissionGate>
					{/if}
				{/snippet}
				{#snippet actions(row)}
					<PermissionGate permission={PERMISSIONS.CABINET_UPDATE}>
						<Button variant="tertiary" onclick={() => newRuleVersion(row)}>
							New version<span class="sr-only"> of {row.partType}</span>
						</Button>
					</PermissionGate>
				{/snippet}
			</DataTable>
			<p class="text-footnote text-ink-secondary">
				Toggling active state keeps the version. Editing the expression or condition creates the
				next version and retires the previous one for that part type.
			</p>
		{/if}
	</div>

	<CabinetFormDialog
		bind:open={editOpen}
		cabinet={detail.cabinet}
		onClose={() => (editOpen = false)}
		onSaved={onCabinetSaved}
	/>

	<ParameterEditorDrawer
		bind:open={parameterOpen}
		cabinetId={detail.cabinet.id}
		parameter={parameterTarget}
		onClose={() => (parameterOpen = false)}
		onSaved={onParameterSaved}
	/>

	<RuleEditorDrawer
		bind:open={ruleOpen}
		cabinetId={detail.cabinet.id}
		{parameterNames}
		rule={ruleSource}
		onClose={() => (ruleOpen = false)}
		onSaved={onRuleSaved}
	/>
{/if}
