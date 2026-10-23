import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import OfflineBanner from './OfflineBanner.svelte';

/**
 * Offline notice (DESIGN §13.4). The copy is fixed by DESIGN; the queued count
 * is announced in the same polite live region.
 */

describe('OfflineBanner', () => {
	test('renders nothing while online', async () => {
		await render(OfflineBanner, { online: true, queued: 2 });

		expect(document.querySelector('[data-testid="offline-banner"]')).toBeNull();
	});

	test('shows the fixed offline copy and the queued count', async () => {
		await render(OfflineBanner, { online: false, queued: 3 });

		await expect
			.element(
				page.getByText(
					'You are offline. Changes are saved on this device and will sync when you reconnect.'
				)
			)
			.toBeVisible();
		await expect.element(page.getByText('3 changes are waiting to sync.')).toBeVisible();

		const banner = document.querySelector('[data-testid="offline-banner"]');
		expect(banner?.getAttribute('role')).toBe('status');
		expect(banner?.getAttribute('aria-live')).toBe('polite');
	});
});
