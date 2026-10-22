<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { session } from '$shared/application/session';
	import { Button, Input, RadioGroup, TextLink } from '$shared/presentation/ui';
	import { isApiError } from '$network/errors';
	import { authApi } from '../../data/api';
	import type { AuthSession, LoginResult } from '../../domain/types';
	import { loginFormSchema } from '../../domain/validations';
	import MfaForm from '../components/MfaForm.svelte';
	import { clearPendingLogin, getPendingLogin } from '../pending-login.svelte';

	interface Props {
		slug: string;
	}

	let { slug }: Props = $props();

	type Step = 'workspace' | 'mfa';

	let step = $state<Step>('workspace');
	let challengeId = $state<string | null>(null);
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<{ email?: string; password?: string }>({});

	let email = $state('');
	let password = $state('');

	const pending = $derived(getPendingLogin());
	const slugIsWellFormed = $derived(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug));
	const pendingWorkspace = $derived(
		pending?.tenants.find((tenant) => tenant.slug === slug) ?? null
	);
	const notFound = $derived(!slugIsWellFormed || (pending !== null && pendingWorkspace === null));

	const workspaceOptions = $derived(
		(pending?.tenants ?? []).map((tenant) => ({
			value: tenant.slug,
			label: tenant.displayName,
			description: tenant.legalName
		}))
	);

	/**
	 * The route param is the selection: choosing a workspace updates the URL
	 * without adding a history entry, so reload and back behave predictably.
	 */
	function chooseWorkspace(event: Event): void {
		const next = (event.currentTarget as HTMLInputElement).value;
		void goto(resolve('/(auth)/t/[slug]', { slug: next }), { replaceState: true });
	}

	function finish(user: AuthSession['user']): void {
		session.setUser(user);
		clearPendingLogin();
		void goto(user.platform ? resolve('/platform/tenants') : resolve('/dashboard'), {
			replaceState: true
		});
	}

	function handleResult(result: LoginResult): void {
		if (result.status === 'authenticated') {
			finish(result.user);
			return;
		}
		if (result.status === 'mfa_required') {
			challengeId = result.challengeId;
			step = 'mfa';
			return;
		}
		formError = 'This account belongs to several workspaces. Sign in again to choose one.';
	}

	async function signIn(nextEmail: string, nextPassword: string): Promise<void> {
		formError = null;
		fieldErrors = {};
		submitting = true;
		try {
			const result = await authApi.login({
				email: nextEmail,
				password: nextPassword,
				tenantSlug: slug
			});
			handleResult(result);
		} catch (error) {
			formError = isApiError(error) ? error.message : 'We could not sign you in. Try again.';
		} finally {
			submitting = false;
		}
	}

	async function continueWithWorkspace(): Promise<void> {
		if (!pending) return;
		await signIn(pending.email, pending.password);
	}

	async function submitDirect(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const parsed = loginFormSchema.safeParse({ email, password });
		if (!parsed.success) {
			const issues = parsed.error.issues;
			fieldErrors = {
				email: issues.find((issue) => issue.path[0] === 'email')?.message,
				password: issues.find((issue) => issue.path[0] === 'password')?.message
			};
			return;
		}
		await signIn(parsed.data.email, parsed.data.password);
	}

	function useDifferentAccount(): void {
		clearPendingLogin();
		void goto(resolve('/login'));
	}

	function cancelMfa(): void {
		step = 'workspace';
		challengeId = null;
		useDifferentAccount();
	}
</script>

{#if notFound}
	<div class="w-full max-w-content-form">
		<section class="rounded-xl border border-hairline bg-canvas p-5 shadow-e2 sm:p-8">
			<h1 class="text-title-1 text-ink">This workspace does not exist.</h1>
			<p class="mt-2 text-callout text-ink-secondary">
				Check the address, or sign in with your email and we will take you to the right workspace.
			</p>
			<p class="mt-6">
				<TextLink href="/login">Go to sign in</TextLink>
			</p>
		</section>
	</div>
{:else}
	<div class="w-full max-w-content-form">
		<section
			aria-labelledby="workspace-heading"
			class="rounded-xl border border-hairline bg-canvas p-5 shadow-e2 sm:p-8"
		>
			<p class="text-callout text-ink-secondary">Sign in to your studio workspace.</p>
			<h1 id="workspace-heading" class="mt-1 text-title-1 text-ink">
				{step === 'mfa'
					? 'Verify it’s you'
					: pending
						? 'Choose a workspace'
						: 'Sign in to continue'}
			</h1>

			{#if step === 'mfa' && challengeId}
				<div class="mt-6">
					<MfaForm
						{challengeId}
						onVerified={(authSession) => finish(authSession.user)}
						onCancel={cancelMfa}
					/>
				</div>
			{:else if pending}
				<p class="mt-2 text-footnote text-ink-secondary">
					{pending.email} belongs to more than one workspace. Pick the one you want to open.
				</p>

				<div class="mt-6 flex flex-col gap-4">
					<RadioGroup
						label="Workspace"
						value={slug}
						options={workspaceOptions}
						onchange={chooseWorkspace}
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
						variant="primary"
						fullWidth
						loading={submitting}
						loadingLabel="Signing in…"
						onclick={continueWithWorkspace}
					>
						Continue
					</Button>

					<Button variant="secondary" fullWidth disabled={submitting} onclick={useDifferentAccount}>
						Use a different account
					</Button>
				</div>
			{:else}
				<p class="mt-2 text-footnote text-ink-secondary">
					Workspace: <span class="text-ink">{slug}</span>
				</p>

				<form onsubmit={submitDirect} novalidate class="mt-6 flex flex-col gap-4">
					<Input
						label="Email"
						bind:value={email}
						type="email"
						name="email"
						autocomplete="email"
						inputmode="email"
						enterkeyhint="next"
						required
						disabled={submitting}
						error={fieldErrors.email}
					/>

					<Input
						label="Password"
						bind:value={password}
						type="password"
						name="password"
						autocomplete="current-password"
						enterkeyhint="go"
						required
						disabled={submitting}
						error={fieldErrors.password}
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
						loadingLabel="Signing in…"
					>
						Sign in
					</Button>

					<Button variant="tertiary" fullWidth disabled={submitting} onclick={useDifferentAccount}>
						Use a different account
					</Button>
				</form>
			{/if}
		</section>
	</div>
{/if}
