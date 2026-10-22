<script lang="ts">
	import { isApiError } from '$network/errors';
	import type { CreateTenantInput, TenantDetail } from '../../domain/types';
	import { fieldErrorsFrom, tenantFormSchema } from '../../domain/validations';
	import { platformTenantsApi } from '../../data/api';
	import { Button, Dialog, Input, Select } from '$shared/presentation/ui';

	interface Props {
		open?: boolean;
		onCreated: (tenant: TenantDetail) => void;
		onClose: () => void;
	}

	let { open = $bindable(false), onCreated, onClose }: Props = $props();

	const CURRENCIES = [
		{ value: 'GBP', label: 'GBP — Pound sterling' },
		{ value: 'EUR', label: 'EUR — Euro' },
		{ value: 'USD', label: 'USD — US dollar' }
	];

	let legalName = $state('');
	let slug = $state('');
	let displayName = $state('');
	let accent = $state('');
	let defaultCurrency = $state('GBP');
	let vatNumber = $state('');
	let referencePattern = $state('');
	let emailDomain = $state('');
	let adminEmail = $state('');

	let errors = $state<Record<string, string>>({});
	let serverError = $state('');
	let submitting = $state(false);

	const accentPreview = $derived(accent.trim() ? accent.trim() : 'var(--color-accent)');

	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) resetForm();
		wasOpen = open;
	});

	function resetForm(): void {
		legalName = '';
		slug = '';
		displayName = '';
		accent = '';
		defaultCurrency = 'GBP';
		vatNumber = '';
		referencePattern = '';
		emailDomain = '';
		adminEmail = '';
		errors = {};
		serverError = '';
		submitting = false;
	}

	function close(): void {
		if (submitting) return;
		serverError = '';
		onClose();
	}

	function optional(value: string): string | undefined {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const candidate = {
			legalName,
			slug,
			displayName: optional(displayName),
			accent: optional(accent),
			defaultCurrency,
			vatNumber: optional(vatNumber),
			referencePattern: optional(referencePattern),
			emailDomain: optional(emailDomain),
			adminEmail
		};

		const parsed = tenantFormSchema.safeParse(candidate);
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		const input: CreateTenantInput = parsed.data;
		submitting = true;
		try {
			const created = await platformTenantsApi.create(input);
			open = false;
			onCreated(created);
		} catch (error) {
			serverError = isApiError(error)
				? error.message
				: 'We could not create this workspace. Try again.';
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
		form="tenant-form"
		loading={submitting}
		loadingLabel="Creating…"
	>
		Create tenant
	</Button>
{/snippet}

<Dialog
	bind:open
	title="New tenant"
	description="Provision a studio workspace and invite its first system admin."
	size="lg"
	{footer}
	onclose={close}
>
	<form id="tenant-form" class="flex flex-col gap-5" onsubmit={submit} novalidate>
		{#if serverError}
			<p
				role="alert"
				class="rounded-md border border-critical bg-critical-soft px-3 py-2 text-callout text-critical-ink"
			>
				{serverError}
			</p>
		{/if}

		<div class="grid gap-5 md:grid-cols-2">
			<Input
				label="Legal name"
				bind:value={legalName}
				required
				autocomplete="organization"
				error={errors.legalName}
			/>
			<Input
				label="Slug"
				bind:value={slug}
				required
				hint="Lowercase letters, numbers and hyphens."
				autocomplete="off"
				spellcheck="false"
				error={errors.slug}
			/>
			<Input
				label="Display name"
				bind:value={displayName}
				hint="Optional. Falls back to the legal name."
				error={errors.displayName}
			/>
			<div class="flex flex-col gap-2">
				<Input
					label="Accent"
					bind:value={accent}
					hint="Optional. Falls back to Interio brass."
					maxlength={7}
					autocomplete="off"
					spellcheck="false"
					error={errors.accent}
				/>
				<div class="flex items-center gap-3">
					<span
						aria-hidden="true"
						class="size-6 shrink-0 rounded-sm border border-hairline-strong"
						style="--swatch: {accentPreview}; background: var(--swatch);"
					></span>
					<span class="text-footnote text-ink-tertiary">Accent preview</span>
				</div>
			</div>
			<Select
				label="Default currency"
				bind:value={defaultCurrency}
				options={CURRENCIES}
				error={errors.defaultCurrency}
			/>
			<Input
				label="VAT number"
				bind:value={vatNumber}
				hint="Optional."
				autocomplete="off"
				error={errors.vatNumber}
			/>
			<Input
				label="Reference pattern"
				bind:value={referencePattern}
				hint={'Optional. For example OIG-{YYYY}-{NNNN}.'}
				autocomplete="off"
				spellcheck="false"
				error={errors.referencePattern}
			/>
			<Input
				label="Email domain"
				bind:value={emailDomain}
				hint="Optional. Used to resolve this workspace at sign-in."
				autocomplete="off"
				spellcheck="false"
				error={errors.emailDomain}
			/>
			<Input
				label="Admin email"
				bind:value={adminEmail}
				type="email"
				inputmode="email"
				required
				hint="Receives the first system admin invitation."
				autocomplete="email"
				error={errors.adminEmail}
				class="md:col-span-2"
			/>
		</div>
	</form>
</Dialog>
