/**
 * Retry policy for the simulated `/sync/push` (Part 9 §13, phase-2 §5.3).
 *
 * Exponential backoff with a 1 s base and a 60 s ceiling. The mock transport
 * fails an `asset_state` op once to prove the policy; the sync page shows the
 * delay before the user retries. Pure and synchronous so it is unit-testable
 * without a clock.
 */

export const SYNC_BACKOFF_BASE_MS = 1_000;
export const SYNC_BACKOFF_MAX_MS = 60_000;

export function retryDelayMs(attempts: number): number {
	const safeAttempts = Number.isFinite(attempts) ? Math.max(0, Math.floor(attempts)) : 0;
	return Math.min(SYNC_BACKOFF_MAX_MS, SYNC_BACKOFF_BASE_MS * 2 ** Math.min(safeAttempts, 10));
}

export function canRetryNow(state: string, attempts: number, waitedMs: number): boolean {
	if (state !== 'failed') return false;
	return waitedMs >= retryDelayMs(attempts);
}
