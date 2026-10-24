import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import AttributeEditor from './AttributeEditor.svelte';

/**
 * Attribute editor (DESIGN §12.5): labelled key/value rows, add and remove by
 * keyboard, an empty state and an inline error. Persistence and key uniqueness
 * stay in the domain layer.
 */

const ROWS = [
	{ key: 'Finish', value: 'Oak' },
	{ key: 'Edge', value: 'ABS' }
];

afterEach(() => {
	vi.restoreAllMocks();
});

describe('AttributeEditor', () => {
	test('renders a labelled row per key and value', async () => {
		await render(AttributeEditor, { rows: ROWS, onchange: vi.fn() });

		await expect.element(page.getByRole('group', { name: 'Attributes' })).toBeVisible();
		await expect.element(page.getByLabelText('Key 1')).toHaveValue('Finish');
		await expect.element(page.getByLabelText('Value 1')).toHaveValue('Oak');
		await expect.element(page.getByLabelText('Key 2')).toHaveValue('Edge');
		await expect.element(page.getByLabelText('Value 2')).toHaveValue('ABS');
	});

	test('adds an empty row through onchange', async () => {
		const onchange = vi.fn();
		await render(AttributeEditor, { rows: ROWS, onchange });

		await userEvent.click(page.getByRole('button', { name: 'Add attribute' }));

		expect(onchange).toHaveBeenCalledWith([...ROWS, { key: '', value: '' }]);
	});

	test('reports an edited key with the rest of the rows intact', async () => {
		const onchange = vi.fn();
		await render(AttributeEditor, { rows: ROWS, onchange });

		await page.getByLabelText('Key 1').fill('Finish lacquer');

		expect(onchange).toHaveBeenLastCalledWith([
			{ key: 'Finish lacquer', value: 'Oak' },
			{ key: 'Edge', value: 'ABS' }
		]);
	});

	test('removes a row from the keyboard, naming its position', async () => {
		const onchange = vi.fn();
		await render(AttributeEditor, { rows: ROWS, onchange });

		const remove = page.getByRole('button', { name: 'Remove attribute 1' });
		remove.element().focus();
		await userEvent.keyboard('{Enter}');

		expect(onchange).toHaveBeenCalledWith([{ key: 'Edge', value: 'ABS' }]);
	});

	test('shows an empty state and still offers the add action', async () => {
		const onchange = vi.fn();
		await render(AttributeEditor, { rows: [], onchange });

		await expect
			.element(page.getByText('No attributes yet. Add a key and value to describe this record.'))
			.toBeVisible();

		await userEvent.click(page.getByRole('button', { name: 'Add attribute' }));
		expect(onchange).toHaveBeenCalledWith([{ key: '', value: '' }]);
	});

	test('uses a custom label for the group', async () => {
		await render(AttributeEditor, { label: 'Decor attributes', rows: ROWS, onchange: vi.fn() });

		await expect.element(page.getByRole('group', { name: 'Decor attributes' })).toBeVisible();
	});

	test('disables every row action and input', async () => {
		await render(AttributeEditor, { rows: ROWS, onchange: vi.fn(), disabled: true });

		await expect.element(page.getByLabelText('Key 1')).toBeDisabled();
		await expect.element(page.getByLabelText('Value 1')).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Remove attribute 1' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Add attribute' })).toBeDisabled();
	});

	test('announces an error and ties it to the group', async () => {
		await render(AttributeEditor, {
			rows: ROWS,
			onchange: vi.fn(),
			error: 'Attribute keys must be unique.'
		});

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Attribute keys must be unique.');
		const group = page.getByRole('group', { name: 'Attributes' }).element();
		expect(group.getAttribute('aria-describedby')).toContain('-error');
	});

	test('renders and edits without console errors', async () => {
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
		const onchange = vi.fn();

		await render(AttributeEditor, { rows: ROWS, onchange });
		await userEvent.click(page.getByRole('button', { name: 'Add attribute' }));

		expect(onchange).toHaveBeenCalledOnce();
		expect(errors).not.toHaveBeenCalled();
	});
});
