<script lang="ts">
	import { env } from '$shared/application/env';
	import { MFA_CODE } from '$shared/data/demo-seed';
	import { Button, Input } from '$shared/presentation/ui';
	import { isApiError } from '$network/errors';
	import { authApi } from '../../data/api';
	import type { AuthSession } from '../../domain/types';
	import { mfaFormSchema } from '../../domain/validations';

	interface Props {
		challengeId: string;
		onVerified: (session: AuthSession) => void;
		onCancel: () => void;
	}

	let { challengeId, onVerified, onCancel }: Props = $props();

	let code = $state('');
	let fieldError = $state<string | null>(null);
	let formError = $state<string | null>(null);
	let submitting = $state(false);

	// Demo-only affordance: the seeded code is shown while demo tools are on.
	const hint = $derived(
		env.enableDemoTools
			? `Enter the 6-digit code from your authenticator app. Demo code: ${MFA_CODE}.`
			: 'Enter the 6-digit code from your authenticator app.'
	);

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		fieldError = null;
		formError = null;

		const parsed = mfaFormSchema.safeParse({ code });
		if (!parsed.success) {
			fieldError = parsed.error.issues[0]?.message ?? 'Enter the 6-digit code.';
			return;
		}

		submitting = true;
		try {
			const session = await authApi.verifyMfa({ challengeId, code: parsed.data.code });
			onVerified(session);
		} catch (error) {
			formError = isApiError(error) ? error.message : 'We could not verify that code. Try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<form onsubmit={submit} novalidate class="flex flex-col gap-4">
	<Input
		label="Authentication code"
		bind:value={code}
		inputmode="numeric"
		autocomplete="one-time-code"
		enterkeyhint="done"
		maxlength={6}
		{hint}
		error={fieldError ?? undefined}
		disabled={submitting}
	/>

	{#if formError}
		<p
			role="alert"
			class="rounded-md border border-critical bg-critical-soft px-3 py-2 text-footnote text-critical-ink"
		>
			{formError}
		</p>
	{/if}

	<Button type="submit" variant="primary" fullWidth loading={submitting} loadingLabel="Verifying…">
		Verify
	</Button>

	<Button type="button" variant="tertiary" fullWidth disabled={submitting} onclick={onCancel}>
		Use a different account
	</Button>
</form>
