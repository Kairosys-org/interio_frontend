import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import EvidenceUploader from './EvidenceUploader.svelte';
import type { EvidenceFile } from './types';

/**
 * Evidence uploader (DESIGN §9.2): the required state is stated in text, each
 * queue row names its state, and retry/remove are real 44 px controls.
 */

const FAILED: EvidenceFile = {
	id: 'file-1',
	name: 'rear-hall-ceiling.jpg',
	sizeBytes: 2_621_440,
	state: 'failed',
	error: 'The file did not match its checksum. Upload it again.'
};

describe('EvidenceUploader', () => {
	test('states that a file is required until one completes', async () => {
		await render(EvidenceUploader, { files: [], required: true, onadd: vi.fn() });

		await expect
			.element(page.getByText('At least one file must finish uploading before you can continue.'))
			.toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Add files' })).toBeVisible();
	});

	test('names the failed state and offers retry and remove', async () => {
		const onretry = vi.fn();
		const onremove = vi.fn();
		await render(EvidenceUploader, {
			files: [FAILED],
			required: true,
			onadd: vi.fn(),
			onretry,
			onremove
		});

		await expect.element(page.getByText('Upload failed')).toBeVisible();
		await expect
			.element(page.getByText('The file did not match its checksum. Upload it again.'))
			.toBeVisible();

		await userEvent.click(page.getByRole('button', { name: 'Retry' }));
		expect(onretry).toHaveBeenCalledWith('file-1');

		await userEvent.click(page.getByRole('button', { name: 'Remove rear-hall-ceiling.jpg' }));
		expect(onremove).toHaveBeenCalledWith('file-1');
	});

	test('reports a chosen file through onadd and keeps the input resettable', async () => {
		const onadd = vi.fn();
		await render(EvidenceUploader, { files: [], onadd });

		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		expect(input).not.toBeNull();
		expect(input.multiple).toBe(true);

		const file = new File(['evidence'], 'kitchen.jpg', { type: 'image/jpeg' });
		await userEvent.upload(input, file);

		expect(onadd).toHaveBeenCalledOnce();
		expect(onadd.mock.calls[0]?.[0]).toHaveLength(1);
		expect(input.value).toBe('');
	});
});
