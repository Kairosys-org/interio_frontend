import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DimensionField from './DimensionField.svelte';

/**
 * Dimension capture (DESIGN §9.2): millimetres, an advisory range hint, a
 * critical flag in words, and an error that replaces the hint.
 */

describe('DimensionField', () => {
	test('renders the millimetre suffix and the range hint', async () => {
		await render(DimensionField, {
			label: 'Ceiling height',
			value: '2400',
			min: 2000,
			max: 3000
		});

		await expect.element(page.getByLabelText('Ceiling height')).toHaveValue('2400');
		await expect
			.element(page.getByText('Usually 2\u2009000\u2009mm to 3\u2009000\u2009mm.'))
			.toBeVisible();
		await expect.element(page.getByText('mm', { exact: true })).toBeVisible();
	});

	test('warns when the reading is outside the advisory range', async () => {
		await render(DimensionField, {
			label: 'Opening width',
			value: '9000',
			min: 100,
			max: 6000
		});

		await expect
			.element(page.getByText('This reading is outside the usual range. Check it before saving.'))
			.toBeVisible();
	});

	test('names a critical measurement and its verification state in text', async () => {
		await render(DimensionField, {
			label: 'Worktop run',
			value: '3200',
			critical: true
		});

		await expect.element(page.getByText('Manufacturing-critical')).toBeVisible();
		await expect
			.element(page.getByText('Verification is required before the survey can be verified.'))
			.toBeVisible();
	});

	test('shows a verified state with the method', async () => {
		await render(DimensionField, {
			label: 'Worktop run',
			value: '3200',
			critical: true,
			verified: true,
			verificationMethod: 'laser'
		});

		await expect.element(page.getByText('Verified with laser.')).toBeVisible();
	});

	test('replaces the hint with a field error', async () => {
		await render(DimensionField, {
			label: 'Ceiling height',
			value: '',
			min: 2000,
			max: 3000,
			error: 'Enter a ceiling height.'
		});

		await expect.element(page.getByText('Enter a ceiling height.')).toBeVisible();
		await expect
			.element(page.getByLabelText('Ceiling height'))
			.toHaveAttribute('aria-invalid', 'true');
		const input = page.getByLabelText('Ceiling height').element() as HTMLInputElement;
		expect(input.getAttribute('aria-describedby')).toMatch(/-error$/);
	});
});
