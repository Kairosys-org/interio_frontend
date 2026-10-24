<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { env } from '$shared/application/env';
	import { session, sessionStore } from '$shared/application/session';
	import { DEMO_PASSWORD } from '$shared/data/demo-seed';
	import type { SessionUser } from '$shared/domain/user';
	import { resolvePath } from '$shared/lib/paths';
	import { Button, Input, Skeleton } from '$shared/presentation/ui';
	import { isApiError } from '$network/errors';
	import { authApi } from '../../data/api';
	import { safeRedirect } from '../../domain/redirect';
	import type { DemoAccount, LoginResult } from '../../domain/types';
	import { loginFormSchema } from '../../domain/validations';
	import MfaForm from '../components/MfaForm.svelte';
	import { setPendingLogin } from '../pending-login.svelte';

	interface Props {
		redirectTo?: string | null;
	}

	let { redirectTo = null }: Props = $props();

	type Step = 'credentials' | 'mfa';

	let step = $state<Step>('credentials');
	let email = $state('');
	let password = $state('');
	let challengeId = $state<string | null>(null);
	let submitting = $state(false);
	let fieldErrors = $state<{ email?: string; password?: string }>({});
	let formError = $state<string | null>(null);

	let demoAccounts = $state<DemoAccount[]>([]);
	let demoLoading = $state(false);
	let demoError = $state<string | null>(null);

	const heading = $derived(step === 'credentials' ? 'Sign in' : 'Verify it’s you');

	function finishSignIn(user: SessionUser): void {
		session.setUser(user);
		const fallback = user.platform ? resolve('/platform/tenants') : resolve('/dashboard');
		const next = safeRedirect(redirectTo);
		void goto(next ? resolvePath(next) : fallback, { replaceState: true });
	}

	function handleLoginResult(result: LoginResult, submittedEmail: string): void {
		if (result.status === 'authenticated') {
			finishSignIn(result.user);
			return;
		}
		if (result.status === 'mfa_required') {
			challengeId = result.challengeId;
			step = 'mfa';
			return;
		}
		const [first] = result.tenants;
		if (!first) {
			formError = 'No workspace is available for this account. Contact your administrator.';
			return;
		}
		setPendingLogin({ email: submittedEmail, password, tenants: result.tenants });
		void goto(resolve('/(auth)/t/[slug]', { slug: first.slug }));
	}

	async function submitCredentials(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = loginFormSchema.safeParse({ email, password });
		if (!parsed.success) {
			const issues = parsed.error.issues;
			fieldErrors = {
				email: issues.find((issue) => issue.path[0] === 'email')?.message,
				password: issues.find((issue) => issue.path[0] === 'password')?.message
			};
			return;
		}

		submitting = true;
		try {
			const result = await authApi.login({
				email: parsed.data.email,
				password: parsed.data.password
			});
			handleLoginResult(result, parsed.data.email);
		} catch (error) {
			formError = isApiError(error) ? error.message : 'We could not sign you in. Try again.';
		} finally {
			submitting = false;
		}
	}

	function useAccount(account: DemoAccount): void {
		email = account.email;
		password = account.password;
		step = 'credentials';
		challengeId = null;
		fieldErrors = {};
		formError = null;
	}

	function resetToCredentials(): void {
		step = 'credentials';
		challengeId = null;
		formError = null;
		fieldErrors = {};
	}

	async function loadDemoAccounts(): Promise<void> {
		demoLoading = true;
		demoError = null;
		try {
			demoAccounts = await authApi.listDemoAccounts();
		} catch (error) {
			demoError = isApiError(error)
				? error.message
				: 'We could not load the demo accounts. Reload the page to try again.';
		} finally {
			demoLoading = false;
		}
	}

	// Demo-only: never fetched in API mode or when demo tools are disabled.
	$effect(() => {
		if (!env.enableDemoTools) return;
		void loadDemoAccounts();
	});
</script>

<div class="flex w-full max-w-content-form flex-col">
	<section
		aria-labelledby="auth-heading"
		class="rounded-xl border border-hairline bg-canvas p-5 shadow-e2 sm:p-8"
	>
		<p class="text-callout text-ink-secondary">Sign in to your studio workspace.</p>
		<h1 id="auth-heading" class="mt-1 text-title-1 text-ink">{heading}</h1>

		{#if $sessionStore.sessionExpired}
			<p
				role="status"
				class="mt-4 rounded-md border border-caution bg-caution-soft px-3 py-2 text-footnote text-caution-ink"
			>
				Your session expired. Sign in again.
			</p>
		{/if}

		{#if step === 'credentials'}
			<form onsubmit={submitCredentials} novalidate class="mt-6 flex flex-col gap-4">
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
			</form>
		{:else if challengeId}
			<div class="mt-6">
				<MfaForm
					{challengeId}
					onVerified={(authSession) => finishSignIn(authSession.user)}
					onCancel={resetToCredentials}
				/>
			</div>
		{/if}
	</section>

	{#if env.enableDemoTools}
		<section
			aria-labelledby="demo-accounts-heading"
			class="mt-4 rounded-xl border border-hairline bg-canvas p-5 shadow-e1 sm:p-6"
		>
			<h2 id="demo-accounts-heading" class="text-title-3 text-ink">Demo accounts</h2>
			<p class="mt-1 text-footnote text-ink-secondary">
				Every demo account uses the password
				<code class="rounded-sm bg-canvas-nested px-2 py-1 font-mono text-ink select-all"
					>{DEMO_PASSWORD}</code
				>.
			</p>

			{#if demoLoading}
				<Skeleton lines={4} class="mt-4" />
			{:else if demoError}
				<p role="alert" class="mt-4 text-footnote text-critical-ink">{demoError}</p>
			{:else}
				<ul class="mt-4 flex flex-col gap-3">
					{#each demoAccounts as account (account.email)}
						<li
							class="flex flex-col gap-3 rounded-md border border-hairline p-3 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="min-w-0">
								<p class="truncate text-callout text-ink">{account.email}</p>
								<p class="text-footnote text-ink-secondary">
									{account.roleLabel} · {account.note}
								</p>
							</div>
							<Button variant="secondary" onclick={() => useAccount(account)}>
								Use this account
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>
