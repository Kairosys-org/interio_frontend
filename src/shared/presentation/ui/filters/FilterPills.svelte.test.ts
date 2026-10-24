import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import FilterPills from './FilterPills.svelte';

/**
 * Filter pills (DESIGN §9.3): one visible group label, `aria-pressed` on every
 * pill, counts as text, and a 44 px button target per option.
 */

const OPTIONS = [
	{ value: 'base', label: 'Base units', count: 18 },
	{ value: 'wall', label: 'Wall units', count: 1284 },
	{ value: 'tall', label: 'Tall units', count: 6 }
];

afterEach(() => {
	vi.restoreAllMocks();
});

describe('FilterPills', () => {
	test('renders the group label, every option and its count', async () => {
		await render(FilterPills, {
			label: 'Cabinet family',
			options: OPTIONS,
			value: 'wall',
			onchange: vi.fn()
		});

		await expect.element(page.getByRole('group', { name: 'Cabinet family' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: /Base units/ })).toBeVisible();
		await expect.element(page.getByRole('button', { name: /Tall units/ })).toBeVisible();
		await expect.element(page.getByText('1,284', { exact: true })).toBeVisible();
	});

	test('marks only the current value as pressed', async () => {
		await render(FilterPills, {
			label: 'Cabinet family',
			options: OPTIONS,
			value: 'wall',
			onchange: vi.fn()
		});

		await expect
			.element(page.getByRole('button', { name: /Wall units/ }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: /Base units/ }))
			.toHaveAttribute('aria-pressed', 'false');
	});

	test('reports the chosen value when a pill is clicked', async () => {
		const onchange = vi.fn();
		await render(FilterPills, {
			label: 'Cabinet family',
			options: OPTIONS,
			value: 'wall',
			onchange
		});

		await userEvent.click(page.getByRole('button', { name: /Base units/ }));

		expect(onchange).toHaveBeenCalledWith('base');
	});

	test('is operable with the keyboard alone', async () => {
		const onchange = vi.fn();
		await render(FilterPills, {
			label: 'Cabinet family',
			options: OPTIONS,
			value: 'wall',
			onchange
		});

		const firstPill = page.getByRole('button', { name: /Base units/ }).element();
		firstPill.focus();
		expect(document.activeElement).toBe(firstPill);

		await userEvent.tab();
		await userEvent.keyboard('{Enter}');

		expect(onchange).toHaveBeenCalledWith('wall');
	});

	test('renders and interacts without console errors', async () => {
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
		const onchange = vi.fn();

		await render(FilterPills, {
			label: 'Cabinet family',
			options: OPTIONS,
			value: 'base',
			onchange
		});
		await userEvent.click(page.getByRole('button', { name: /Tall units/ }));

		expect(errors).not.toHaveBeenCalled();
		expect(onchange).toHaveBeenCalledWith('tall');
	});
});
