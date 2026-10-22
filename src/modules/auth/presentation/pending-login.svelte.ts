import type { TenantChoice } from '../domain/types';

export interface PendingLogin {
	email: string;
	password: string;
	tenants: TenantChoice[];
}

/**
 * In-memory hand-off between `/login` and `/t/<slug>`.
 *
 * The workspace chooser needs the password the user just typed to call
 * `login({ …, tenantSlug })` again, and the SPA keeps it in module state only:
 * nothing is written to `localStorage`, `sessionStorage` or the URL, so a
 * password never outlives the tab or lands in history. A reload therefore
 * falls back on purpose to the compact form on the chooser page.
 */
let pendingLogin = $state<PendingLogin | null>(null);

export function getPendingLogin(): PendingLogin | null {
	return pendingLogin;
}

export function setPendingLogin(next: PendingLogin): void {
	pendingLogin = next;
}

export function clearPendingLogin(): void {
	pendingLogin = null;
}
