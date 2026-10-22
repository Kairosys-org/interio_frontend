<script lang="ts">
	import type { Snippet } from 'svelte';
	import { sessionStore } from '$shared/application/session';
	import { hasAnyPermission, hasPermission } from '$shared/domain/permissions';

	/**
	 * UX-only permission gate (DESIGN §9.2). The server remains authoritative;
	 * a direct URL without permission must still resolve to the 403 page.
	 * Hidden branches render no wrapper markup, so nothing focusable is left
	 * behind.
	 */
	interface Props {
		permission: string | readonly string[];
		requireAll?: boolean;
		fallback?: Snippet;
		children: Snippet;
		class?: string;
	}

	let { permission, requireAll = false, fallback, children, class: className }: Props = $props();

	const allowed = $derived.by(() => {
		const user = $sessionStore.user;
		if (!user) return false;

		const required = typeof permission === 'string' ? [permission] : permission;
		if (required.length === 0) return true;

		return requireAll
			? required.every((code) => hasPermission(user.permissions, code))
			: hasAnyPermission(required, user.permissions);
	});
</script>

{#if allowed}
	{#if className}
		<div class={className}>{@render children()}</div>
	{:else}
		{@render children()}
	{/if}
{:else if fallback}
	{@render fallback()}
{/if}
