import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ChecklistDrawer from './ChecklistDrawer.svelte';
import type { ChecklistSection } from './checklist-types';

/**
 * Checklist drawer (DESIGN §9.2): blocker count in the title, every row names
 * its state, and jump rows are keyboard-operable.
 */

const SECTIONS: ChecklistSection[] = [
	{
		id: 'rooms',
		label: 'Rooms and geometry',
		rows: [
			{
				id: 'room_dimensions',
				label: 'Every room has a ceiling height',
				status: 'fail',
				detail: 'Rear hall has no ceiling height.',
				blocking: true
			},
			{
				id: 'openings',
				label: 'Every opening has dimensions',
				status: 'pass',
				blocking: false
			}
		]
	},
	{
		id: 'media',
		label: 'Media',
		rows: [
			{
				id: 'room_photos',
				label: 'Room photos',
				status: 'pending',
				detail: 'Photos are encouraged but do not block submission.',
				blocking: false
			}
		]
	}
];

describe('ChecklistDrawer', () => {
	test('puts the blocker count in the sheet title', async () => {
		await render(ChecklistDrawer, { open: true, sections: SECTIONS, blockers: 1 });

		await expect.element(page.getByRole('dialog')).toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Submission checklist · 1 blocking' }))
			.toBeVisible();
	});

	test('marks the ready state when nothing blocks', async () => {
		await render(ChecklistDrawer, { open: true, sections: SECTIONS, blockers: 0 });

		await expect
			.element(page.getByRole('heading', { name: 'Submission checklist · Ready' }))
			.toBeVisible();
	});

	test('shows each row state in words and calls onjump', async () => {
		const onjump = vi.fn();
		await render(ChecklistDrawer, { open: true, sections: SECTIONS, blockers: 1, onjump });

		await expect.element(page.getByText('Rear hall has no ceiling height.')).toBeVisible();
		await expect.element(page.getByText('Needs attention')).toBeVisible();
		await expect.element(page.getByText('Complete')).toBeVisible();
		await expect.element(page.getByText('Not checked')).toBeVisible();
		await expect.element(page.getByText('Blocks submission', { exact: true })).toBeVisible();

		await userEvent.click(page.getByRole('button', { name: /Every room has a ceiling height/ }));
		expect(onjump).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'room_dimensions', status: 'fail' })
		);
	});

	test('shows a loading state instead of rows', async () => {
		await render(ChecklistDrawer, { open: true, sections: SECTIONS, blockers: 0, loading: true });

		await expect
			.element(page.getByRole('heading', { name: 'Submission checklist · Checking…' }))
			.toBeVisible();
		expect(document.body.textContent).not.toContain('Rear hall has no ceiling height.');
	});
});
