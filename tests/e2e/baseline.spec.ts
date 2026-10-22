import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, fillCredentials, submitMfaIfAsked } from './helpers';

/**
 * Phase 0 visual baseline: 320/390/768/1280/1920 × light/dark for the login,
 * dashboard, platform list and 404 pages. Written to a git-ignored folder so
 * the evidence is reproducible without committing binaries.
 */
const OUT = '.playwright-cli/ui-review/baseline';
const VIEWPORTS = [
	{ width: 320, height: 720 },
	{ width: 390, height: 844 },
	{ width: 768, height: 1024 },
	{ width: 1280, height: 720 },
	{ width: 1920, height: 1080 }
] as const;

async function prepareTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
	await page.emulateMedia({ colorScheme: theme });
	await expect
		.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
		.toBe(theme === 'dark');
}

async function capture(page: Page, name: string): Promise<void> {
	for (const viewport of VIEWPORTS) {
		for (const theme of ['light', 'dark'] as const) {
			await page.setViewportSize(viewport);
			await prepareTheme(page, theme);
			mkdirSync(OUT, { recursive: true });
			await page.screenshot({
				path: join(OUT, `${name}-${viewport.width}-${theme}.png`),
				fullPage: true
			});
		}
	}
}

// Ten full-page screenshots per page (five widths × two themes). The default
// 30 s budget is too tight for the public-pages pass on a loaded machine.
test.setTimeout(120_000);

test.describe.configure({ mode: 'serial' });

test('baseline: public pages', async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();

	await page.goto('/login');
	await capture(page, 'login');

	await page.goto('/missing-page');
	await capture(page, 'not-found');

	await context.close();
});

test('baseline: tenant shell', async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();

	await page.goto('/login');
	await fillCredentials(page, ACCOUNTS.sales);
	await submitMfaIfAsked(page);
	await expect(page).toHaveURL(/\/dashboard$/);

	await capture(page, 'dashboard');
	await context.close();
});

test('baseline: platform console', async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();

	await page.goto('/login');
	await fillCredentials(page, ACCOUNTS.platform);
	await submitMfaIfAsked(page);
	await expect(page).toHaveURL(/\/platform\/tenants$/);

	await capture(page, 'platform-tenants');
	await context.close();
});
