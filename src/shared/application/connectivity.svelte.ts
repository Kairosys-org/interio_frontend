import { browser } from '$app/environment';

/**
 * Network state for the offline UI (phase-2 §6, DESIGN §13.4).
 *
 * Module-scope rune state in a `.svelte.ts` file: components read it through
 * `isOnline()` inside a reactive context, and the listeners are bound once on
 * first browser read. The mock backend never actually needs the network, so
 * this drives the banner, the queued chips and the outbox drain trigger — the
 * app-level "real" offline switch is `navigator.onLine`.
 */
let online = $state(true);
let bound = false;

function bind(): void {
	if (!browser || bound) return;
	bound = true;
	online = navigator.onLine;
	window.addEventListener('online', () => {
		online = true;
	});
	window.addEventListener('offline', () => {
		online = false;
	});
}

export function isOnline(): boolean {
	bind();
	return online;
}
