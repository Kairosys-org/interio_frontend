import { describe, expect, it } from 'vitest';
import { SYNC_BACKOFF_BASE_MS, SYNC_BACKOFF_MAX_MS, canRetryNow, retryDelayMs } from '../backoff';

/**
 * Retry policy (phase-2 §5.3). Exponential from 1 s, capped at 60 s; negative
 * or fractional attempts never produce a negative delay.
 */

describe('retryDelayMs', () => {
	it('starts at one second and doubles', () => {
		expect(retryDelayMs(0)).toBe(SYNC_BACKOFF_BASE_MS);
		expect(retryDelayMs(1)).toBe(2_000);
		expect(retryDelayMs(2)).toBe(4_000);
		expect(retryDelayMs(3)).toBe(8_000);
	});

	it('caps at sixty seconds', () => {
		expect(retryDelayMs(20)).toBe(SYNC_BACKOFF_MAX_MS);
	});

	it('treats negative and fractional attempts as the base step', () => {
		expect(retryDelayMs(-4)).toBe(SYNC_BACKOFF_BASE_MS);
		expect(retryDelayMs(1.9)).toBe(2_000);
		expect(retryDelayMs(Number.NaN)).toBe(SYNC_BACKOFF_BASE_MS);
	});
});

describe('canRetryNow', () => {
	it('only opens a failed row after its backoff', () => {
		expect(canRetryNow('failed', 1, 0)).toBe(false);
		expect(canRetryNow('failed', 1, 2_000)).toBe(true);
		expect(canRetryNow('queued', 1, 120_000)).toBe(false);
		expect(canRetryNow('conflict', 0, 120_000)).toBe(false);
	});
});
