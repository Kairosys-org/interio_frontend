import { expect, test } from '@playwright/test';
import { ACCOUNTS, signIn, watchConsole } from './helpers';

test.describe('platform console', () => {
	test('a tenant session is denied the platform route and the server call', async ({ page }) => {
		const problems = watchConsole(page);
		await signIn(page, ACCOUNTS.sales);

		await page.goto('/platform/tenants');
		await expect(page.getByRole('heading', { level: 1 })).toContainText(/do not have access/i);
		await expect(page).toHaveURL(/\/platform\/tenants$/);

		// No platform navigation is rendered for a tenant session.
		await expect(page.getByRole('link', { name: /audit log/i })).toHaveCount(0);
		expect(problems).toEqual([]);
	});

	test('platform staff land in the console, not the tenant app', async ({ page }) => {
		await signIn(page, ACCOUNTS.platform);

		await expect(page).toHaveURL(/\/platform\/tenants$/);
		await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible();
		await expect(page.getByText('Opulent Interiors').first()).toBeVisible();
	});

	test('a tenant can be created and suspended', async ({ page }) => {
		await signIn(page, ACCOUNTS.platform);
		await page.getByRole('button', { name: /new tenant/i }).click();

		await page.getByLabel(/legal name/i).fill('Test Joinery Ltd');
		await page.getByLabel(/^slug/i).fill('test-joinery');
		await page.getByLabel(/admin email/i).fill('admin@testjoinery.co.uk');
		await page.getByRole('button', { name: /create tenant/i }).click();

		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(page.getByText('Test Joinery Ltd').first()).toBeVisible();

		await page.goto('/platform/tenants');
		await page
			.getByRole('link', { name: /test joinery/i })
			.first()
			.click();
		await page
			.getByRole('button', { name: /suspend tenant/i })
			.first()
			.click();

		const dialog = page.getByRole('dialog');
		await dialog.getByLabel(/reason/i).fill('Playwright verification');
		await dialog.getByRole('button', { name: /suspend tenant/i }).click();

		await expect(page.getByText(/suspended/i).first()).toBeVisible();
	});
});
