import { expect, type Page } from '@playwright/test';
import { deterministicUuid } from '../../src/shared/lib/deterministic';

/** Credentials and ids are documented in `src/shared/data/demo-seed.ts`. */
export const DEMO_PASSWORD = 'Interio!2026';
export const MFA_CODE = '123456';
export const INVITATION_TOKEN = deterministicUuid('invitation-token:opulent:designer');

export const ACCOUNTS = {
	sales: 'sales@opulentinteriors.co.uk',
	owner: 'owner@opulentinteriors.co.uk',
	harbourOwner: 'owner@harbourfinch.co.uk',
	systemAdmin: 'admin@opulentinteriors.co.uk',
	ambiguous: 'ambiguous@example.com',
	platform: 'platform@interio.app'
} as const;

export async function expectOneH1(page: Page): Promise<void> {
	await expect(page.locator('h1')).toHaveCount(1);
	await expect(page.locator('h1')).toBeVisible();
}

export async function fillCredentials(
	page: Page,
	email: string,
	password: string = DEMO_PASSWORD
): Promise<void> {
	await page.getByLabel(/email/i).first().fill(email);
	await page
		.getByLabel(/^password/i)
		.first()
		.fill(password);
	await page.getByRole('button', { name: /^sign in$/i }).click();
}

/** Some seeded accounts require the second factor; complete it when asked. */
export async function submitMfaIfAsked(page: Page): Promise<void> {
	const code = page.getByLabel(/authentication code/i);
	if (await code.isVisible().catch(() => false)) {
		await code.fill(MFA_CODE);
		await page.getByRole('button', { name: /^verify$/i }).click();
	}
}

export async function signIn(page: Page, email: string): Promise<void> {
	await page.goto('/login');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await fillCredentials(page, email);
	await submitMfaIfAsked(page);
	await expect(page).not.toHaveURL(/\/login/);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(1);
}

/** Collect runtime errors so a green render can never hide a broken console. */
export function watchConsole(page: Page): string[] {
	const problems: string[] = [];
	page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') problems.push(`console: ${message.text()}`);
	});
	page.on('requestfailed', (request) => {
		const url = new URL(request.url());
		if (url.origin === new URL(page.url()).origin) {
			problems.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`);
		}
	});
	return problems;
}
