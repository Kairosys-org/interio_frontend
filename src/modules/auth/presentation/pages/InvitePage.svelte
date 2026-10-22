<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { session } from '$shared/application/session';
	import { ROLE_LABELS } from '$shared/domain/roles';
	import { formatDate } from '$shared/lib/format';
	import { Button, Input, Skeleton, TextLink } from '$shared/presentation/ui';
	import { isApiError } from '$network/errors';
	import { authApi } from '../../data/api';
	import type { InvitationPreview } from '../../domain/types';
	import { inviteAcceptSchema } from '../../domain/validations';

	interface Props {
		token: string;
	}

	let { token }: Props = $props();

	let loading = $state(true);
	let loadError = $state<{ message: string; notFound: boolean } | null>(null);
	let preview = $state<InvitationPreview | null>(null);

	let displayName = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let fieldErrors = $state<{
		displayName?: string;
		password?: string;
		confirmPassword?: string;
	}>({});
	let formError = $state<string | null>(null);
	let submitting = $state(false);

	async function loadInvitation(value: string): Promise<void> {
		loading = true;
		loadError = null;
		preview = null;
		try {
			preview = await authApi.getInvitation(value);
		} catch (error) {
			loadError = {
				message: isApiError(error)
					? error.message
					: 'We could not load this invitation. Try again in a moment.',
				notFound: isApiError(error) && (error.status === 404 || error.code === 'not_found')
			};
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void loadInvitation(token);
	});

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = inviteAcceptSchema.safeParse({ displayName, password, confirmPassword });
		if (!parsed.success) {
			const issues = parsed.error.issues;
			fieldErrors = {
				displayName: issues.find((issue) => issue.path[0] === 'displayName')?.message,
				password: issues.find((issue) => issue.path[0] === 'password')?.message,
				confirmPassword: issues.find((issue) => issue.path[0] === 'confirmPassword')?.message
			};
			return;
		}

		submitting = true;
		try {
			const authSession = await authApi.acceptInvitation({
				token,
				displayName: parsed.data.displayName,
				password: parsed.data.password
			});
			session.setUser(authSession.user);
			void goto(authSession.user.platform ? resolve('/platform/tenants') : resolve('/dashboard'), {
				replaceState: true
			});
		} catch (error) {
			formError = isApiError(error)
				? error.message
				: 'We could not accept this invitation. Try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="w-full max-w-content-form">
	<section
		aria-labelledby="invite-heading"
		class="rounded-xl border border-hairline bg-canvas p-5 shadow-e2 sm:p-8"
	>
		<p class="text-callout text-ink-secondary">Join your studio workspace.</p>
		<h1 id="invite-heading" class="mt-1 text-title-1 text-ink">Accept invitation</h1>

		{#if loading}
			<div class="mt-6">
				<Skeleton lines={4} />
			</div>
		{:else if loadError?.notFound}
			<p class="mt-4 text-callout text-ink-secondary">
				This invitation link is not valid. Ask the person who invited you to send a new one.
			</p>
			<p class="mt-6">
				<TextLink href="/login">Go to sign in</TextLink>
			</p>
		{:else if loadError}
			<p
				role="alert"
				class="mt-4 rounded-md border border-caution bg-caution-soft px-3 py-2 text-footnote text-caution-ink"
			>
				{loadError.message}
			</p>
			<p class="mt-6">
				<TextLink href="/login">Go to sign in</TextLink>
			</p>
		{:else if preview}
			<p class="mt-2 text-footnote text-ink-secondary">
				{preview.email} has been invited to {preview.tenantName}. Set your name and password to
				join.
			</p>

			<dl
				class="mt-6 grid grid-cols-1 gap-3 rounded-md border border-hairline bg-canvas-grouped p-4 sm:grid-cols-2"
			>
				<div>
					<dt class="text-footnote text-ink-secondary">Workspace</dt>
					<dd class="text-callout text-ink">{preview.tenantName}</dd>
				</div>
				<div>
					<dt class="text-footnote text-ink-secondary">Email</dt>
					<dd class="text-callout break-all text-ink">{preview.email}</dd>
				</div>
				<div>
					<dt class="text-footnote text-ink-secondary">Role</dt>
					<dd class="text-callout text-ink">{ROLE_LABELS[preview.role]}</dd>
				</div>
				<div>
					<dt class="text-footnote text-ink-secondary">Invitation expires</dt>
					<dd class="text-callout text-ink">{formatDate(preview.expiresAt)}</dd>
				</div>
			</dl>

			<form onsubmit={submit} novalidate class="mt-6 flex flex-col gap-4">
				<Input
					label="Full name"
					bind:value={displayName}
					name="name"
					autocomplete="name"
					enterkeyhint="next"
					required
					disabled={submitting}
					error={fieldErrors.displayName}
				/>

				<Input
					label="Password"
					bind:value={password}
					type="password"
					name="new-password"
					autocomplete="new-password"
					enterkeyhint="next"
					hint="Use at least 12 characters."
					required
					disabled={submitting}
					error={fieldErrors.password}
				/>

				<Input
					label="Confirm password"
					bind:value={confirmPassword}
					type="password"
					name="confirm-password"
					autocomplete="new-password"
					enterkeyhint="done"
					required
					disabled={submitting}
					error={fieldErrors.confirmPassword}
				/>

				{#if formError}
					<p
						role="alert"
						class="rounded-md border border-critical bg-critical-soft px-3 py-2 text-footnote text-critical-ink"
					>
						{formError}
					</p>
				{/if}

				<Button
					type="submit"
					variant="primary"
					fullWidth
					loading={submitting}
					loadingLabel="Joining…"
				>
					Accept invitation
				</Button>
			</form>
		{/if}
	</section>
</div>
