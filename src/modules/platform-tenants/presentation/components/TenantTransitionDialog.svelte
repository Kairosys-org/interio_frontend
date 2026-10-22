<script lang="ts">
	import { isApiError } from '$network/errors';
	import type { TenantDetail, TenantTransitionTarget } from '../../domain/types';
	import { fieldErrorsFrom, transitionFormSchema } from '../../domain/validations';
	import { platformTenantsApi } from '../../data/api';
	import { Button, Dialog, Textarea } from '$shared/presentation/ui';

	interface Props {
		open?: boolean;
		tenant: TenantDetail;
		target: TenantTransitionTarget;
		onDone: (tenant: TenantDetail) => void;
		onClose: () => void;
	}

	let { open = $bindable(false), tenant, target, onDone, onClose }: Props = $props();

	const copy = $derived.by(() => {
		const name = tenant.displayName;
		const table: Record<
			TenantTransitionTarget,
			{ title: string; consequence: string; action: string }
		> = {
			suspended: {
				title: 'Suspend tenant',
				consequence: `Suspending ${name} blocks every user in this workspace until it is reactivated.`,
				action: 'Suspend tenant'
			},
			active: {
				title: 'Reactivate tenant',
				consequence: `Reactivating ${name} restores access for everyone in this workspace.`,
				action: 'Reactivate tenant'
			},
			offboarded: {
				title: 'Offboard tenant',
				consequence: `Offboarding ${name} is final: the workspace stops for everyone and cannot be reactivated.`,
				action: 'Offboard tenant'
			}
		};
		return table[target];
	});
	const isDestructive = $derived(target === 'offboarded' || target === 'suspended');

	let reason = $state('');
	let errors = $state<Record<string, string>>({});
	let serverError = $state('');
	let submitting = $state(false);

	let wasOpen = false;
	let lastKey = '';
	$effect(() => {
		const key = `${tenant.id}:${target}`;
		if (open && (!wasOpen || key !== lastKey)) {
			reason = '';
			errors = {};
			serverError = '';
			submitting = false;
		}
		wasOpen = open;
		lastKey = key;
	});

	function close(): void {
		if (submitting) return;
		serverError = '';
		onClose();
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const parsed = transitionFormSchema.safeParse({ reason, to: target });
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		submitting = true;
		try {
			const updated = await platformTenantsApi.transition(tenant.id, parsed.data);
			open = false;
			onDone(updated);
		} catch (error) {
			serverError = isApiError(error)
				? error.message
				: 'We could not change this workspace. Try again.';
		} finally {
			submitting = false;
		}
	}
</script>

{#snippet footer()}
	<Button variant="secondary" onclick={close} disabled={submitting}>Cancel</Button>
	<Button
		variant={isDestructive ? 'destructive' : 'primary'}
		type="submit"
		form="transition-form"
		loading={submitting}
		loadingLabel="Saving…"
	>
		{copy.action}
	</Button>
{/snippet}

<Dialog bind:open title={copy.title} description={copy.consequence} {footer} onclose={close}>
	<form id="transition-form" class="flex flex-col gap-5" onsubmit={submit} novalidate>
		{#if serverError}
			<p
				role="alert"
				class="rounded-md border border-critical bg-critical-soft px-3 py-2 text-callout text-critical-ink"
			>
				{serverError}
			</p>
		{/if}

		<Textarea
			label="Reason"
			bind:value={reason}
			required
			rows={3}
			hint="Recorded in the platform audit log."
			error={errors.reason}
		/>
	</form>
</Dialog>
