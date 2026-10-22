import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import type { SessionState, SessionUser } from '$shared/domain/user';
import { clearTokens, hasSessionToken } from '$network/token-storage';
import { applyTenantBranding } from './branding';

/**
 * App-wide session state. This is the only `svelte/store` in the app; local
 * state uses runes. The store holds no API knowledge: the root layout passes
 * the feature loader, so the dependency points inward (architecture §5, §8).
 */
const INITIAL_STATE: SessionState = { user: null, initializing: true, sessionExpired: false };

export const sessionStore = writable<SessionState>(INITIAL_STATE);

export function getSession(): SessionState {
	return get(sessionStore);
}

export function setSessionUser(user: SessionUser): void {
	// Branding is applied before the store notifies, so the authenticated shell
	// never paints in Interio brass and then swaps to the tenant accent.
	applyTenantBranding(user.tenant);
	sessionStore.set({ user, initializing: false, sessionExpired: false });
}

export function clearSession(expired = false): void {
	if (browser) clearTokens();
	applyTenantBranding(null);
	sessionStore.set({ user: null, initializing: false, sessionExpired: expired });
}

export const session = {
	/**
	 * Resolve the stored token into a user. `loadUser` is the auth feature's
	 * `authApi.me()`; it is supplied by the root layout to avoid a cycle.
	 */
	async init(loadUser?: () => Promise<SessionUser>): Promise<void> {
		if (!browser) return;
		if (!hasSessionToken()) {
			sessionStore.set({ user: null, initializing: false, sessionExpired: false });
			return;
		}
		sessionStore.update((state) => ({ ...state, initializing: true }));
		if (!loadUser) {
			sessionStore.set({ user: null, initializing: false, sessionExpired: false });
			return;
		}
		try {
			const user = await loadUser();
			setSessionUser(user);
		} catch {
			clearSession(true);
		}
	},

	setUser: setSessionUser,

	clearSession,

	/** Clear local state only; callers revoke the token through the auth API. */
	reset(): void {
		clearSession(false);
	}
};
