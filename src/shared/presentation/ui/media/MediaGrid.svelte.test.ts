import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import MediaGrid from './MediaGrid.svelte';
import type { MediaItem } from './types';

/**
 * Media grid + lightbox (DESIGN §8.2). The fixtures carry a mock signed URL,
 * which cannot render, so the tile must show a labelled placeholder and the
 * lightbox must explain why — never a broken image or a stock photo.
 */

const ITEMS: MediaItem[] = [
	{
		id: 'asset-1',
		fileName: 'kitchen-overview.jpg',
		caption: 'Kitchen overview from the doorway',
		kind: 'photo',
		mimeType: 'image/jpeg',
		previewUrl: 'interio-mock://asset/asset-1',
		uploadState: 'complete',
		ownerLabel: 'Kitchen · photo',
		sizeBytes: 2_516_582
	},
	{
		id: 'asset-2',
		fileName: 'existing-floor-plan.pdf',
		caption: 'Existing floor plan',
		kind: 'plan',
		mimeType: 'application/pdf',
		previewUrl: null,
		uploadState: 'complete',
		ownerLabel: 'Survey · plan'
	}
];

describe('MediaGrid', () => {
	test('renders a labelled placeholder when the mock URL cannot load', async () => {
		await render(MediaGrid, { items: ITEMS });

		await expect.element(page.getByText('No preview').first()).toBeVisible();
		expect(document.body.textContent).toContain('Kitchen overview from the doorway');
		await expect.poll(() => page.getByText('No preview').elements().length).toBe(2);
		expect(document.body.textContent).not.toContain('Upload failed');
		expect(document.querySelector('img')).toBeNull();
	});

	test('opens the lightbox with the file metadata and a placeholder', async () => {
		await render(MediaGrid, { items: ITEMS });

		await userEvent.click(
			page.getByRole('button', { name: 'Open Kitchen overview from the doorway' })
		);

		await expect.element(page.getByRole('dialog')).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'kitchen-overview.jpg' })).toBeVisible();
		await expect.element(page.getByText('Preview unavailable')).toBeVisible();
		await expect.element(page.getByText('1 of 2 · Kitchen · photo')).toBeVisible();
	});

	test('shows the empty state when there is no media', async () => {
		await render(MediaGrid, { items: [], emptyDescription: 'Capture a photo first.' });

		await expect.element(page.getByRole('heading', { name: 'No media yet.' })).toBeVisible();
		await expect.element(page.getByText('Capture a photo first.')).toBeVisible();
	});
});
