import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ExpressionEditor from './ExpressionEditor.svelte';

/**
 * Expression editor (DESIGN §4.1, §12.5): monospace text, a visible line-number
 * gutter, a line count, an aria-described hint and an inline error that can
 * name the offending line. Nothing is parsed or evaluated here.
 */

const VALUE = '{\n  "min": 400,\n  "max": 900\n}';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('ExpressionEditor', () => {
	test('renders a labelled monospace editor with a line-number gutter and count', async () => {
		const { container } = await render(ExpressionEditor, {
			label: 'Component rule',
			value: VALUE,
			onchange: vi.fn()
		});

		await expect.element(page.getByLabelText('Component rule')).toHaveValue(VALUE);
		await expect.element(page.getByText('4 lines')).toBeVisible();

		const gutter = container.querySelector('[aria-hidden="true"]');
		expect(gutter?.textContent?.replace(/\s/g, '')).toBe('1234');
	});

	test('keeps the gutter and count in sync when the value changes', async () => {
		const props = { label: 'Component rule', value: VALUE, onchange: vi.fn() };
		const { container, rerender } = await render(ExpressionEditor, props);

		await rerender({ ...props, value: 'true' });

		await expect.element(page.getByText('1 line', { exact: true })).toBeVisible();
		const gutter = container.querySelector('[aria-hidden="true"]');
		expect(gutter?.textContent?.replace(/\s/g, '')).toBe('1');
	});

	test('ties the hint to the textarea with aria-describedby', async () => {
		await render(ExpressionEditor, {
			label: 'Component rule',
			value: VALUE,
			hint: 'Use the structured clause format. Values are millimetres.',
			onchange: vi.fn()
		});

		await expect
			.element(page.getByText('Use the structured clause format. Values are millimetres.'))
			.toBeVisible();

		const textarea = page.getByLabelText('Component rule').element() as HTMLTextAreaElement;
		expect(textarea.getAttribute('aria-describedby')).toContain('-hint');
	});

	test('announces an error with its line and replaces the hint', async () => {
		await render(ExpressionEditor, {
			label: 'Component rule',
			value: VALUE,
			hint: 'Keep the rule valid.',
			error: 'Rule JSON is not valid.',
			errorLine: 3,
			onchange: vi.fn()
		});

		await expect.element(page.getByText('Rule JSON is not valid. (line 3)')).toBeVisible();
		expect(document.body.textContent).not.toContain('Keep the rule valid.');

		const textarea = page.getByLabelText('Component rule').element() as HTMLTextAreaElement;
		expect(textarea.getAttribute('aria-invalid')).toBe('true');
		expect(textarea.getAttribute('aria-describedby')).toContain('-error');
	});

	test('reports edits through onchange without validating them', async () => {
		const onchange = vi.fn();
		await render(ExpressionEditor, {
			label: 'Component rule',
			value: '',
			onchange
		});

		await page.getByLabelText('Component rule').fill('{"active": true}');

		expect(onchange).toHaveBeenCalledWith('{"active": true}');
	});

	test('runs the format action when a handler is supplied', async () => {
		const onformat = vi.fn();
		await render(ExpressionEditor, {
			label: 'Component rule',
			value: VALUE,
			formatLabel: 'Format expression',
			onformat,
			onchange: vi.fn()
		});

		await userEvent.click(page.getByRole('button', { name: 'Format expression' }));

		expect(onformat).toHaveBeenCalledOnce();
	});

	test('disables the textarea and format action together', async () => {
		await render(ExpressionEditor, {
			label: 'Component rule',
			value: VALUE,
			disabled: true,
			onformat: vi.fn(),
			onchange: vi.fn()
		});

		await expect.element(page.getByLabelText('Component rule')).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Format JSON' })).toBeDisabled();
	});

	test('renders without console errors', async () => {
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

		await render(ExpressionEditor, {
			label: 'Component rule',
			value: VALUE,
			onchange: vi.fn()
		});

		await expect.element(page.getByText('4 lines')).toBeVisible();
		expect(errors).not.toHaveBeenCalled();
	});
});
