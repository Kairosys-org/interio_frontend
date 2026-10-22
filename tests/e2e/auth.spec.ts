import { expect, test } from '@playwright/test';
import {
	ACCOUNTS,
	INVITATION_TOKEN,
	expectNoHorizontalOverflow,
	expectOneH1,
	fillCredentials,
	signIn,
	watchConsole
} from './helpers';

test.describe('authentication', () => {
	test('a direct-login role reaches the dashboard', async ({ page }) => {
		const problems = watchConsole(page);
		await signIn(page, ACCOUNTS.sales);

		await expect(page).toHaveURL(/\/dashboard$/);
		await expectOneH1(page);
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
		expect(problems).toEqual([]);
	});

	test('a tenant accent is applied before the shell paints', async ({ page }) => {
		await signIn(page, ACCOUNTS.harbourOwner);
		await expect(page).toHaveURL(/\/dashboard$/);

		const accent = await page.evaluate(() =>
			getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
		);
		expect(accent).toBe('#2f5d62');
	});

	test('MFA accounts must verify the six-digit code', async ({ page }) => {
		await page.goto('/login');
		await fillCredentials(page, ACCOUNTS.systemAdmin);

		await expect(page.getByLabel(/authentication code/i)).toBeVisible();
		await page.getByLabel(/authentication code/i).fill('000000');
		await page.getByRole('button', { name: /^verify$/i }).click();
		await expect(page.getByRole('alert')).toBeVisible();

		await page.getByLabel(/authentication code/i).fill('123456');
		await page.getByRole('button', { name: /^verify$/i }).click();
		await expect(page).toHaveURL(/\/dashboard$/);
	});

	test('an ambiguous email opens the workspace chooser', async ({ page }) => {
		await page.goto('/login');
		await fillCredentials(page, ACCOUNTS.ambiguous);

		await expect(page).toHaveURL(/\/t\//);
		await expect(page.getByRole('heading', { name: /choose a workspace/i })).toBeVisible();
		expect(await page.getByRole('radio').count()).toBeGreaterThanOrEqual(2);

		await page.getByRole('radio', { name: /harbour/i }).check();
		await page.getByRole('button', { name: /^continue$/i }).click();

		await expect(page).toHaveURL(/\/dashboard$/);
	});

	test('a wrong password never reveals which field failed', async ({ page }) => {
		await page.goto('/login');
		await fillCredentials(page, ACCOUNTS.sales, 'not-the-password');

		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible();
		await expect(alert).toContainText(/email or password is incorrect/i);
		await expect(page).toHaveURL(/\/login/);
	});

	test('the seeded invitation creates an account', async ({ page }) => {
		await page.goto(`/invite/${INVITATION_TOKEN}`);
		await expectOneH1(page);
		await expect(page.getByText(/opulent/i).first()).toBeVisible();

		await page.getByLabel(/full name/i).fill('Imogen Clarke');
		await page.getByLabel(/^password/i).fill('Interio!2026');
		await page.getByLabel(/confirm password/i).fill('Interio!2026');
		await page.getByRole('button', { name: /accept invitation/i }).click();

		await expect(page).toHaveURL(/\/dashboard$/);
	});

	test('an unknown route renders the 404 page at every width', async ({ page }) => {
		const problems = watchConsole(page);
		await page.goto('/this-route-does-not-exist');

		await expectOneH1(page);
		await expect(page.getByRole('heading', { level: 1 })).toContainText(/does not exist/i);
		await expectNoHorizontalOverflow(page);

		// A 404 is the expected outcome here: the browser logs the failed document
		// request and SvelteKit logs the thrown not-found error. Every other
		// console error still fails the test.
		const unexpected = problems.filter(
			(problem) =>
				!/status of 404 \(Not Found\)/.test(problem) &&
				!/Not found: \/this-route-does-not-exist/.test(problem)
		);
		expect(unexpected).toEqual([]);
	});

	test('signing in twice does not double-submit', async ({ page }) => {
		await page.goto('/login');
		await fillCredentials(page, ACCOUNTS.sales);
		await expect(page).toHaveURL(/\/dashboard$/);

		await page.goto('/login');
		await expect(page).toHaveURL(/\/dashboard$/);
	});

	test('a deep link returns after sign-in and sign-out revokes the session', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);

		await fillCredentials(page, ACCOUNTS.sales);
		await expect(page).toHaveURL(/\/dashboard$/);

		await page.getByRole('button', { name: 'Account' }).click();
		await page.getByRole('menuitem', { name: /sign out/i }).click();
		await expect(page).toHaveURL(/\/login$/);

		// The access and refresh tokens are gone, so the guard sends the deep
		// link back to sign-in instead of painting the shell.
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login/);
	});

	test('the 403 page explains the missing permission', async ({ page }) => {
		await page.goto('/403');
		await expectOneH1(page);
		await expect(page.getByRole('heading', { level: 1 })).toContainText(/do not have access/i);
		await expectNoHorizontalOverflow(page);
	});
});
