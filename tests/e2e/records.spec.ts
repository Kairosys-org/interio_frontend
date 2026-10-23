import { expect, test, type Page } from '@playwright/test';
import {
	ACCOUNTS,
	MFA_CODE,
	expectNoHorizontalOverflow,
	expectOneH1,
	fillCredentials,
	signIn,
	watchConsole
} from './helpers';

/** MFA accounts need the code field to render before it can be filled. */
async function signInWithMfa(page: Page, email: string): Promise<void> {
	await page.goto('/login');
	await fillCredentials(page, email);
	await page.getByLabel(/authentication code/i).fill(MFA_CODE);
	await page.getByRole('button', { name: /^verify$/i }).click();
	await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Phase 1 journeys (requirements/phase-1.md §5.4): the records spine is only
 * done when a real browser can create, hold, link, assign, archive and import.
 * Every test runs in its own context, so the mock DB reseeds from the same
 * deterministic seed and no test depends on another.
 */
test.describe('records spine', () => {
	test('a duplicate customer is held and linked to the existing record', async ({ page }) => {
		const problems = watchConsole(page);
		await signIn(page, ACCOUNTS.sales);

		await page.goto('/dedup-queue');
		await expect(page.getByRole('status')).toContainText('2 records held for review');

		await page.goto('/customers');
		await expectOneH1(page);
		await page.getByRole('button', { name: 'New customer' }).click();

		await page.getByLabel('Customer caption').fill('A. Smith');
		await page.getByLabel('Email').fill('alice.smith@example.com');
		await page.getByRole('button', { name: 'Create customer' }).click();

		const review = page.locator('dialog[open]').filter({ hasText: 'Review possible duplicate' });
		await expect(review).toBeVisible();
		await expect(review).toContainText('A. Smith');

		// The first radio group lists the possible matches; choose the seed.
		await review.getByRole('radio').first().check();
		await review.getByRole('radio', { name: /Link to the existing record/ }).check();
		await review.getByRole('button', { name: 'Link to existing' }).click();

		await expect(page.getByText('Customer linked to the existing record.')).toBeVisible();

		await page.goto('/dedup-queue');
		await expect(page.getByRole('status')).toContainText('2 records held for review');
		expect(problems).toEqual([]);
	});

	test('the project wizard creates a project with a surveyor', async ({ page }) => {
		const problems = watchConsole(page);
		await signIn(page, ACCOUNTS.sales);

		await page.goto('/projects/new');
		await expectOneH1(page);

		await page
			.getByRole('radio', { name: /A\. Smith/ })
			.first()
			.check();
		await page.getByRole('button', { name: 'Continue' }).click();

		await page
			.getByRole('radio', { name: /1 Oak Street/ })
			.first()
			.check();
		await page.getByRole('button', { name: 'Continue' }).click();

		await page.getByLabel(/Project caption/i).fill('E2E kitchen');
		await page.getByRole('button', { name: 'Continue' }).click();

		const surveyor = page.getByRole('checkbox').first();
		await expect(surveyor).toBeVisible();
		await surveyor.check();
		await page.getByRole('button', { name: 'Continue' }).click();

		await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
		await page.getByRole('button', { name: 'Create project' }).click();

		await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
		await expect(page.getByRole('heading', { name: 'E2E kitchen', level: 1 })).toBeVisible();
		await expect(page.getByText('1 surveyor assigned')).toBeVisible();

		await page.getByRole('tab', { name: 'Activity' }).click();
		await expect(page.getByLabel('Filter by action')).toContainText('Assignment add');
		expect(problems).toEqual([]);
	});

	test('an active customer can be archived and filtered by state', async ({ page }) => {
		const problems = watchConsole(page);
		await signInWithMfa(page, ACCOUNTS.owner);

		await page.goto('/customers?q=Marlow+Street+Studio');
		await page.getByRole('link', { name: 'Marlow Street Studio', exact: true }).click();
		await expectOneH1(page);

		await page.getByRole('button', { name: 'Archive customer' }).click();
		const confirm = page.locator('dialog[open]').filter({ hasText: 'Archive' });
		await confirm.getByRole('button', { name: 'Archive customer' }).click();

		await expect(page.getByText('Customer archived.')).toBeVisible();
		await expect(page.getByText('This customer is archived and cannot be edited.')).toBeVisible();

		await page.goto('/customers?state=archived');
		await expect(page.getByText('Marlow Street Studio').first()).toBeVisible();
		await expectNoHorizontalOverflow(page);
		expect(problems).toEqual([]);
	});

	test('a staged import commits, becomes read-only and feeds the dedup queue', async ({ page }) => {
		const problems = watchConsole(page);
		await signInWithMfa(page, ACCOUNTS.systemAdmin);

		await page.goto('/dedup-queue');
		await expect.poll(() => page.locator('main article').count()).toBeGreaterThan(0);
		const before = await page.locator('main article').count();

		await page.goto('/imports');
		await page.getByRole('link', { name: 'customer-enquiries.csv' }).click();
		await expectOneH1(page);

		await page.getByRole('button', { name: 'Commit import' }).click();
		const confirm = page.locator('dialog[open]').filter({ hasText: 'Commit this import?' });
		await expect(confirm).toContainText('Create');
		await confirm.getByRole('button', { name: 'Commit import' }).click();

		await expect(page.getByText('Import committed.', { exact: true })).toBeVisible();
		await expect(page.getByText(/committed and read-only/i)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Commit import' }).first()).toBeHidden();

		await page.goto('/dedup-queue');
		await expect.poll(() => page.locator('main article').count()).toBeGreaterThan(before);
		expect(problems).toEqual([]);
	});
});
