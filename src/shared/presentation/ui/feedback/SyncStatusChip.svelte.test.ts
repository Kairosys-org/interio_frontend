import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SyncStatusChip from './SyncStatusChip.svelte';

/**
 * Sync chip (DESIGN §9.2): every state is icon + text, the count is in a
 * polite live region, and the chip links to Sync when a target is supplied.
 */

describe('SyncStatusChip', () => {
	test('shows Synced when nothing is waiting', async () => {
		await render(SyncStatusChip, { online: true });

		await expect.element(page.getByText('Synced')).toBeVisible();
		expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();
	});

	test('names the offline state and the queued count', async () => {
		await render(SyncStatusChip, { online: false, queued: 3 });

		await expect.element(page.getByText('Offline · 3 queued')).toBeVisible();
	});

	test('puts conflicts ahead of queued changes', async () => {
		await render(SyncStatusChip, { online: true, queued: 5, conflicts: 2 });

		await expect.element(page.getByText('2 conflicts')).toBeVisible();
		expect(document.body.textContent).not.toContain('5 queued');
	});

	test('links to the sync page when a target is given', async () => {
		await render(SyncStatusChip, { online: true, queued: 1, href: '/m/sync' });

		const link = page.getByRole('link', { name: /1 queued/ });
		await expect.element(link).toBeVisible();
		await expect.element(link).toHaveAttribute('href', '/m/sync');
	});
});
