import { browser } from '$app/environment';

/**
 * Network state for the offline UI (phase-2 §6, DESIGN §13.4).
 *
 * Module-scope rune state in a `.svelte.ts` file. The listeners are bound once
 * when the module first loads in the browser — never inside a read — so
 * components can call `isOnline()` from a `$derived` without mutating state
 * during a derived recomputation. The mock backend never actually needs the
 * network, so this drives the banner, the queued chips and the outbox drain
 * trigger — the app-level "real" offline switch is `navigator.onLine`.
 */
let online = $state(browser ? navigator.onLine : true);

if (browser) {
	window.addEventListener('online', () => {
		online = true;
	});
	window.addEventListener('offline', () => {
		online = false;
	});
}

export function isOnline(): boolean {
	return online;
}
