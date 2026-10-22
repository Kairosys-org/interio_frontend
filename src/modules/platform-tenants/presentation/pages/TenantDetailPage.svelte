<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { isApiError } from '$network/errors';
	import { isUuid } from '$shared/domain/uuid';
	import type { TenantStatus } from '$shared/domain/user';
	import { formatDate, formatDateTime } from '$shared/lib/format';
	import { stateLabel } from '$shared/lib/status';
	import {
		Badge,
		Breadcrumb,
		Button,
		EmptyState,
		ForbiddenPage,
		Menu,
		Skeleton
	} from '$shared/presentation/ui';
	import { platformTenantsApi } from '../../data/api';
	import type { TenantDetail, TenantTransitionTarget } from '../../domain/types';
	import TenantTransitionDialog from '../components/TenantTransitionDialog.svelte';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	const ACTION_LABELS: Record<string, string> = {
		'tenant.created': 'Tenant created',
		'tenant.suspended': 'Tenant suspended',
		'tenant.reactivated': 'Tenant reactivated',
		'tenant.offboarded': 'Tenant offboarded'
	};

	function actionLabel(action: string): string {
		return ACTION_LABELS[action] ?? stateLabel(action.replaceAll('.', '_'));
	}

	function statusTone(value: TenantStatus): 'success' | 'warning' | 'neutral' {
		if (value === 'active') return 'success';
		if (value === 'suspended') return 'warning';
		return 'neutral';
	}

	let tenant = $state<TenantDetail | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let transitionOpen = $state(false);
	let transitionTarget = $state<TenantTransitionTarget>('suspended');

	let requestSequence = 0;

	const validId = $derived(isUuid(id));
	const nextTarget = $derived<TenantTransitionTarget | null>(
		tenant?.status === 'active' ? 'suspended' : tenant?.status === 'suspended' ? 'active' : null
	);
	const breadcrumb = $derived([
		{ label: 'Tenants', href: '/platform/tenants' },
		{ label: tenant?.displayName ?? 'Tenant' }
	]);

	async function load(value: string): Promise<void> {
		const sequence = ++requestSequence;
		loading = true;
		error = null;
		notFound = false;

		try {
			const detail = await platformTenantsApi.get(value);
			if (sequence !== requestSequence) return;
			tenant = detail;
		} catch (caught) {
			if (sequence !== requestSequence) return;
			tenant = null;
			if (isApiError(caught) && caught.isNotFound()) {
				notFound = true;
			} else {
				error = isApiError(caught)
					? caught.message
					: 'We could not load this workspace. Try again.';
			}
		} finally {
			if (sequence === requestSequence) loading = false;
		}
	}

	$effect(() => {
		const value = id;
		if (!isUuid(value)) {
			requestSequence += 1;
			loading = false;
			tenant = null;
			notFound = true;
			error = null;
			return;
		}
		void load(value);
	});

	function openTransition(target: TenantTransitionTarget): void {
		transitionTarget = target;
		transitionOpen = true;
	}

	function handleDone(updated: TenantDetail): void {
		tenant = updated;
		transitionOpen = false;
		toast.success(
			updated.status === 'suspended'
				? 'Tenant suspended.'
				: updated.status === 'active'
					? 'Tenant reactivated.'
					: 'Tenant offboarded.'
		);
	}
</script>

{#if !validId}
	<ForbiddenPage variant="not-found" />
{:else if loading}
	<div class="flex flex-col gap-6" aria-busy="true" aria-label="Loading tenant">
		<h1 class="sr-only">Loading tenant</h1>
		<Skeleton lines={1} class="max-w-content-reading" />
		<Skeleton variant="block" />
		<Skeleton variant="block" />
	</div>
{:else if notFound}
	<ForbiddenPage
		variant="not-found"
		title="Tenant not found."
		description="This workspace does not exist or is no longer available."
		backHref="/platform/tenants"
		backLabel="Back to tenants"
	/>
{:else if error || !tenant}
	<EmptyState title="We could not load this workspace." description={error ?? undefined}>
		{#snippet action()}
			<Button variant="secondary" onclick={() => void load(id)}>Try again</Button>
		{/snippet}
	</EmptyState>
{:else}
	<Breadcrumb items={breadcrumb} class="pb-4" />

	<header class="flex flex-col gap-4 pb-8 md:flex-row md:items-start md:justify-between">
		<div class="flex min-w-0 flex-col gap-2">
			<div class="flex flex-wrap items-center gap-3">
				<h1 class="text-large-title text-ink">{tenant.displayName}</h1>
				<Badge label={stateLabel(tenant.status)} tone={statusTone(tenant.status)} />
			</div>
			<p class="text-callout text-ink-secondary">{tenant.legalName}</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if nextTarget === 'suspended'}
				<Button variant="destructive" onclick={() => openTransition('suspended')}>
					Suspend tenant
				</Button>
			{:else if nextTarget === 'active'}
				<Button variant="primary" onclick={() => openTransition('active')}>
					Reactivate tenant
				</Button>
			{:else}
				<p class="text-footnote text-ink-tertiary">This workspace is offboarded.</p>
			{/if}

			{#if tenant.status !== 'offboarded'}
				<Menu
					label="More tenant actions"
					items={[
						{
							label: 'Offboard tenant',
							danger: true,
							onSelect: () => openTransition('offboarded')
						}
					]}
				/>
			{/if}
		</div>
	</header>

	<div class="grid gap-4 lg:grid-cols-3">
		<section
			aria-labelledby="tenant-config"
			class="rounded-md border border-hairline bg-canvas-grouped p-5 lg:col-span-2"
		>
			<h2 id="tenant-config" class="pb-4 text-title-3 text-ink">Configuration</h2>
			<dl class="grid gap-4 sm:grid-cols-2">
				<div class="flex flex-col gap-1">
					<dt class="text-footnote text-ink-secondary">Legal name</dt>
					<dd class="text-callout text-ink">{tenant.legalName}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-footnote text-ink-secondary">Slug</dt>
					<dd class="font-mono text-callout text-ink">{tenant.slug}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-footnote text-ink-secondary">Email domain</dt>
					<dd class="text-callout text-ink">{tenant.emailDomain ?? '—'}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-footnote text-ink-secondary">Default currency</dt>
					<dd class="text-callout text-ink">{tenant.defaultCurrency}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-footnote text-ink-secondary">VAT number</dt>
					<dd class="text-callout text-ink">{tenant.vatNumber ?? '—'}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-footnote text-ink-secondary">Reference pattern</dt>
					<dd class="text-callout text-ink">{tenant.referencePattern ?? '—'}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-footnote text-ink-secondary">Created</dt>
					<dd class="text-callout text-ink">{formatDate(tenant.createdAt)}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-footnote text-ink-secondary">Users</dt>
					<dd class="text-callout text-ink tabular-nums">{tenant.userCount}</dd>
				</div>
			</dl>
		</section>

		<section
			aria-labelledby="tenant-branding"
			class="rounded-md border border-hairline bg-canvas-grouped p-5"
		>
			<h2 id="tenant-branding" class="pb-4 text-title-3 text-ink">Branding</h2>
			<div class="flex items-center gap-3">
				<span
					aria-hidden="true"
					class="size-10 shrink-0 rounded-sm border border-hairline-strong"
					style="--swatch: {tenant.branding?.accent ??
						'var(--color-accent)'}; background: var(--swatch);"
				></span>
				<div class="flex min-w-0 flex-col gap-1">
					<span class="text-callout text-ink">
						{tenant.branding?.displayName ?? tenant.displayName}
					</span>
					<span class="text-footnote text-ink-tertiary">
						{tenant.branding?.accent ? 'Tenant accent' : 'Interio brass (no override)'}
					</span>
				</div>
			</div>
		</section>
	</div>

	<section
		aria-labelledby="tenant-activity"
		class="mt-4 rounded-md border border-hairline bg-canvas-grouped"
	>
		<h2 id="tenant-activity" class="border-b border-hairline px-5 py-4 text-title-3 text-ink">
			Recent platform activity
		</h2>
		{#if tenant.recentAudit.length === 0}
			<p class="px-5 py-6 text-callout text-ink-secondary">No platform activity yet.</p>
		{:else}
			<ul class="flex list-none flex-col p-0">
				{#each tenant.recentAudit as event (event.id)}
					<li
						class="flex flex-col gap-1 border-b border-hairline px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="flex flex-col gap-1">
							<span class="text-callout text-ink">{actionLabel(event.action)}</span>
							<span class="text-footnote text-ink-tertiary">{event.actorEmail}</span>
						</div>
						<time datetime={event.occurredAt} class="text-footnote text-ink-secondary">
							{formatDateTime(event.occurredAt)}
						</time>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<TenantTransitionDialog
		bind:open={transitionOpen}
		{tenant}
		target={transitionTarget}
		onDone={handleDone}
		onClose={() => (transitionOpen = false)}
	/>
{/if}
