<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import { CloudOff, LogOut, ShieldCheck } from '@lucide/svelte';
	import { isOnline } from '$shared/application/connectivity.svelte';
	import { clearSession, sessionStore } from '$shared/application/session';
	import { ROLE_LABELS } from '$shared/domain/roles';
	import { Avatar, Badge, Button, KeyValueGrid } from '$shared/presentation/ui';
	import { authApi } from '$modules/auth/data/api';

	/**
	 * `/m/account` — profile, session and sign-out (phase-2 §3.2).
	 *
	 * No tenant settings and no commercial shortcuts: this screen only says
	 * who is signed in, what they may do on site, and how to leave safely.
	 * Sign-out revokes the session before the local state is cleared.
	 */
	let signingOut = $state(false);

	const user = $derived($sessionStore.user);
	const online = $derived(isOnline());

	async function signOut(): Promise<void> {
		signingOut = true;
		try {
			await authApi.logout();
		} catch {
			// A failed revoke must not trap the user in a session they cannot
			// leave; the local token is still cleared below.
		}
		clearSession(false);
		signingOut = false;
		await goto(resolve('/m/login'), { replaceState: true });
	}
</script>

<svelte:head>
	<title>Account · Interio Survey</title>
</svelte:head>

<header class="flex flex-col gap-1 pb-4">
	<h1 class="text-title-2 text-ink">Account</h1>
	<p class="text-footnote text-ink-secondary">Who is signed in on this device.</p>
</header>

{#if user}
	<div class="flex flex-col gap-4">
		<section class="flex items-center gap-3 rounded-lg border border-hairline bg-canvas p-4">
			<Avatar name={user.displayName} size="lg" />
			<div class="flex min-w-0 flex-col gap-1">
				<p class="text-headline break-words text-ink">{user.displayName}</p>
				<p class="text-callout break-words text-ink-secondary">{user.email}</p>
				<div class="flex flex-wrap gap-1 pt-1">
					{#each user.roles as role (role)}
						<Badge label={ROLE_LABELS[role] ?? role} tone="neutral" />
					{/each}
				</div>
			</div>
		</section>

		<section
			class="rounded-lg border border-hairline bg-canvas p-4"
			aria-labelledby="session-heading"
		>
			<h2 id="session-heading" class="pb-3 text-title-3 text-ink">Session</h2>
			<KeyValueGrid
				columns={1}
				items={[
					{ label: 'Tenant', value: user.tenant?.legalName ?? 'Platform account' },
					{ label: 'Workspace', value: user.tenant?.slug ?? null },
					{
						label: 'Multi-factor',
						value: user.mfaEnrolled ? 'Enrolled' : 'Not enrolled'
					},
					{
						label: 'Site permissions',
						value: `${user.permissions.length} permission${user.permissions.length === 1 ? '' : 's'}`
					}
				]}
			/>
			<p class="flex items-start gap-2 pt-3 text-footnote text-ink-secondary">
				<ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>
					Signing out revokes this session on the server. Any unsent capture stays queued for the
					next time you sign in on this device.
				</span>
			</p>
		</section>

		{#if !online}
			<p
				role="status"
				class="flex items-start gap-2 rounded-lg border border-caution bg-caution-soft p-3 text-footnote text-caution-ink"
			>
				<CloudOff size={18} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>
					You are offline. Signing out still works on this device, but the server will not be told
					until the connection returns.
				</span>
			</p>
		{/if}

		<Button
			variant="secondary"
			fullWidth
			onclick={signOut}
			loading={signingOut}
			loadingLabel="Signing out…"
		>
			{#snippet icon()}
				<LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
			{/snippet}
			Sign out
		</Button>

		<p class="text-center text-footnote text-ink-tertiary">Interio Survey · phase 2 web shell</p>
	</div>
{:else}
	<p role="status" class="text-callout text-ink-secondary">No one is signed in on this device.</p>
	<Button variant="primary" fullWidth onclick={() => void goto(resolve('/m/login'))}>
		Sign in
	</Button>
{/if}
