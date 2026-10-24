import { expect, test, type Page } from '@playwright/test';
import { demoSurveyId } from '../../src/shared/data/demo-record-plan';
import { expectNoHorizontalOverflow, expectOneH1, signIn, watchConsole } from './helpers';

const SURVEYOR = 'surveyor@opulentinteriors.co.uk';
const LIVE = demoSurveyId(1, 1);
const VERIFIED = demoSurveyId(1, 2);
const TABS = ['Projects', 'Surveys', 'Sync', 'Account'] as const;

/** Smallest valid PNG so the upload path has real bytes and a real digest. */
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

async function openSurvey(page: Page, path = ''): Promise<void> {
	await page.goto(`/m/surveys/${LIVE}${path}`);
	await expect(page.locator('h1')).toBeVisible();
}

/**
 * Phase 2 journeys (requirements/phase-2.md §8): capture works offline, the
 * outbox drains on reconnect, a moved server row produces a reviewable
 * conflict, submission is blocked by a named reason, G8 blocks verification
 * until every critical measurement records a method, and the mobile shell
 * exposes nothing outside the survey.
 */
test.describe('survey capture', () => {
	test('captures a reading offline, queues it, and drains on reconnect', async ({ page }) => {
		test.setTimeout(60_000);
		const problems = watchConsole(page);
		await page.setViewportSize({ width: 390, height: 844 });
		await signIn(page, SURVEYOR);

		await page.goto('/m/projects');
		await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();
		await expectNoHorizontalOverflow(page);

		await openSurvey(page, '/measurements');

		await page.context().setOffline(true);
		await expect(page.getByText(/you are offline/i).first()).toBeVisible();

		await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
		const editor = page.getByRole('dialog');
		await expect(editor).toBeVisible();
		await editor.getByRole('textbox', { name: /reading/i }).fill('2450');
		await editor.getByRole('button', { name: 'Save reading' }).click();
		await expect(page.getByText('Measurement saved.')).toBeVisible();
		await expect(page.getByTestId('sync-status-chip')).toContainText(/queued/i);

		await page.context().setOffline(false);
		await page.goto('/m/sync');
		await expect(page.getByText('Waiting to send')).toBeVisible();
		await page.getByRole('button', { name: 'Sync now' }).click();
		await expect(page.getByText(/Sync finished/i)).toBeVisible();

		expect(problems).toEqual([]);
	});

	test('a server-side change produces a conflict the surveyor can re-apply', async ({ page }) => {
		const problems = watchConsole(page);
		await page.setViewportSize({ width: 390, height: 844 });
		await signIn(page, SURVEYOR);
		await page.goto('/m/sync');

		await page.getByRole('button', { name: 'Sync now' }).click();
		await expect(page.getByRole('heading', { name: 'Conflicts' })).toBeVisible();
		await expect(page.getByTestId('sync-status-chip')).toContainText(/conflict/i);

		await page.getByRole('button', { name: 'Compare both versions' }).first().click();
		const sheet = page.getByRole('dialog');
		await expect(sheet).toContainText(/This record changed on the server/i);
		await expect(sheet.getByRole('columnheader', { name: /server \(kept\)/i })).toBeVisible();
		await expect(sheet.getByRole('columnheader', { name: /my change/i })).toBeVisible();
		await expect(sheet.getByRole('cell', { name: '2400' })).toBeVisible();
		await expect(sheet.getByRole('cell', { name: '2450' })).toBeVisible();

		await sheet.getByRole('button', { name: 'Re-apply my change' }).click();
		await expect(page.getByTestId('sync-status-chip')).not.toContainText(/conflict/i);

		expect(problems).toEqual([]);
	});

	test('submission is blocked by a named reason before every check passes', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await signIn(page, SURVEYOR);
		await openSurvey(page, '/submit');

		await expect(page.getByRole('heading', { name: 'Blocking reasons' })).toBeVisible();
		await expect(page.getByText(/ceiling height/i).first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Submit for verification' })).toBeDisabled();
		await expectNoHorizontalOverflow(page);
	});

	test('G8 blocks verification until every critical reading records a method', async ({ page }) => {
		const problems = watchConsole(page);
		await signIn(page, SURVEYOR);

		await page.goto(`/surveys/${LIVE}/verify`);
		await expectOneH1(page);
		await expect(page.getByText(/G8 · Manufacturing-critical measurements/i)).toBeVisible();
		await expect(page.getByText('12 of 15')).toBeVisible();

		await page.getByRole('button', { name: 'Verify all remaining' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Verification method').selectOption('re_measure');
		await dialog.getByRole('button', { name: 'Verify all' }).click();

		await expect(page.getByText('15 of 15')).toBeVisible();
		await expect(page.getByText(/still need a recorded method/i)).toHaveCount(0);
		await expect(page.getByText(/G8 · Manufacturing-critical measurements/i)).toHaveCount(0);

		expect(problems).toEqual([]);
	});

	test('web review shows the status, checklist, room board, critical table and media', async ({
		page
	}) => {
		const problems = watchConsole(page);
		await signIn(page, SURVEYOR);

		await page.goto('/surveys');
		await expect(page.getByRole('heading', { name: 'Surveys', level: 1 })).toBeVisible();
		await expect(page.getByRole('row')).toHaveCount(3);
		await expect(page.getByText('3 unverified').first()).toBeVisible();

		await page.goto(`/surveys/${LIVE}`);
		await expectOneH1(page);
		await expect(page.getByText(/In progress/).first()).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Rooms' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Measurements' }).first()).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible();
		await expect(page.getByText(/Kitchen refurbishment — initial capture/).first()).toBeVisible();

		await page
			.getByRole('button', { name: /Checklist/ })
			.first()
			.click();
		const drawer = page.getByRole('dialog');
		await expect(drawer).toContainText(/Submission checklist/i);
		await drawer.getByRole('button', { name: /close/i }).click();

		await expectNoHorizontalOverflow(page);
		expect(problems).toEqual([]);
	});

	test('a verified survey is read-only until a production manager reopens it', async ({ page }) => {
		await signIn(page, SURVEYOR);
		await page.goto(`/surveys/${VERIFIED}`);
		await expect(page.getByText(/Verified/).first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Verify survey' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Reopen' })).toHaveCount(0);
	});

	test('media upload reaches complete and the failed seed stays failed', async ({ page }) => {
		const problems = watchConsole(page);
		await signIn(page, SURVEYOR);

		await page.goto(`/surveys/${LIVE}/media`);
		await expectOneH1(page);

		await page.locator('input[type="file"]').first().setInputFiles({
			name: 'site-photo.png',
			mimeType: 'image/png',
			buffer: PNG
		});
		await expect(
			page.getByText('Upload finished. Every file is listed with its state.')
		).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByText(/failed/i).first()).toBeVisible();

		expect(problems).toEqual([]);
	});

	test('the mobile shell exposes only the four survey destinations', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await signIn(page, SURVEYOR);
		await page.goto('/m/projects');

		const nav = page.getByRole('navigation', { name: 'Mobile survey' });
		const links = nav.getByRole('link');
		await expect(links).toHaveCount(TABS.length);
		for (const label of TABS) {
			await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
		}

		const hrefs = await page
			.locator('a[href]')
			.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
		expect(hrefs.filter((href) => /^\/(quotes|orders|platform|admin|workshop)/.test(href))).toEqual(
			[]
		);
		await expectNoHorizontalOverflow(page);
	});

	test('a surveyor without an assignment cannot open another surveyor’s project', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await signIn(page, SURVEYOR);
		await page.goto('/m/surveys');
		await expect(page.getByRole('heading', { name: 'Your surveys' })).toBeVisible();

		await expect(page.getByText(/Kitchen refurbishment/).first()).toBeVisible();
		// Project 2 belongs to another surveyor; the list never offers it.
		await expect(page.getByText(/Boot room joinery/i)).toHaveCount(0);
	});
});
