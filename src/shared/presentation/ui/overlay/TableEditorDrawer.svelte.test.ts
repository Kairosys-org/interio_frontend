import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import TableEditorDrawer from './TableEditorDrawer.svelte';

/**
 * Table editor drawer (DESIGN §9.3 "Sheet"): a side panel with form semantics,
 * a sticky footer and a submit button whose loading label is "Saving…".
 */

const children = createRawSnippet(() => ({
	render: () =>
		'<div><label for="edging-name">Edging name</label><input id="edging-name" type="text" /></div>'
}));

afterEach(() => {
	vi.restoreAllMocks();
});

describe('TableEditorDrawer', () => {
	test('opens as a side sheet with its title, description and content', async () => {
		await render(TableEditorDrawer, {
			open: true,
			title: 'Edit edging',
			description: 'Update the code or thickness. Every change is audited.',
			onsave: vi.fn(),
			onclose: vi.fn(),
			children
		});

		await expect.element(page.getByRole('dialog')).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Edit edging' })).toBeVisible();
		await expect
			.element(page.getByText('Update the code or thickness. Every change is audited.'))
			.toBeVisible();
		await expect.element(page.getByLabelText('Edging name')).toBeVisible();
	});

	test('submits the form through onsave', async () => {
		const onsave = vi.fn();
		await render(TableEditorDrawer, {
			open: true,
			title: 'Edit edging',
			onsave,
			onclose: vi.fn(),
			children
		});

		await userEvent.click(page.getByRole('button', { name: 'Save changes' }));

		expect(onsave).toHaveBeenCalledOnce();
	});

	test('cancels and closes the sheet', async () => {
		const onclose = vi.fn();
		await render(TableEditorDrawer, {
			open: true,
			title: 'Edit edging',
			onsave: vi.fn(),
			onclose,
			children
		});

		await userEvent.click(page.getByRole('button', { name: 'Cancel' }));

		expect(onclose).toHaveBeenCalledOnce();
		await expect.poll(() => document.querySelector('dialog')?.open).toBe(false);
	});

	test('closes on Escape and reports it once', async () => {
		const onclose = vi.fn();
		await render(TableEditorDrawer, {
			open: true,
			title: 'Edit edging',
			onsave: vi.fn(),
			onclose,
			children
		});
		await expect.element(page.getByRole('dialog')).toBeVisible();

		await userEvent.keyboard('{Escape}');

		await expect.poll(() => document.querySelector('dialog')?.open).toBe(false);
		expect(onclose).toHaveBeenCalledOnce();
	});

	test('shows the saving state on both footer actions', async () => {
		await render(TableEditorDrawer, {
			open: true,
			title: 'Edit supplier',
			submitLabel: 'Save supplier',
			saving: true,
			onsave: vi.fn(),
			onclose: vi.fn(),
			children
		});

		await expect.element(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
	});

	test('announces an error above the fields', async () => {
		await render(TableEditorDrawer, {
			open: true,
			title: 'Edit supplier',
			error: 'A supplier with this code already exists.',
			onsave: vi.fn(),
			onclose: vi.fn(),
			children
		});

		const alert = page.getByRole('alert');
		await expect.element(alert).toBeVisible();
		await expect.element(alert).toHaveTextContent('A supplier with this code already exists.');
	});

	test('renders and submits without console errors', async () => {
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
		const onsave = vi.fn();

		await render(TableEditorDrawer, {
			open: true,
			title: 'Edit edging',
			onsave,
			onclose: vi.fn(),
			children
		});
		await userEvent.click(page.getByRole('button', { name: 'Save changes' }));

		expect(onsave).toHaveBeenCalledOnce();
		expect(errors).not.toHaveBeenCalled();
	});
});
