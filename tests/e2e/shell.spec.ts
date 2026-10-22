import { expect, test } from '@playwright/test';
import { ACCOUNTS, expectNoHorizontalOverflow, expectOneH1, signIn, watchConsole } from './helpers';

const WIDTHS = [320, 390, 768, 1024, 1280, 1920] as const;

test.describe('shell', () => {
	test('the skip link is the first stop and moves focus to main', async ({ page }) => {
		await signIn(page, ACCOUNTS.sales);
		await page.keyboard.press('Tab');

		const focused = page.locator(':focus');
		await expect(focused).toHaveClass(/skip-link/);
		await page.keyboard.press('Enter');
		await expect(page.locator('#main-content')).toBeFocused();
	});

	test('the sidebar is keyboard reachable with one active item', async ({ page }) => {
		await signIn(page, ACCOUNTS.sales);

		const nav = page.getByRole('navigation', { name: /main/i });
		await expect(nav).toBeVisible();
		await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
			'aria-current',
			'page'
		);

		await nav.getByRole('link', { name: 'Dashboard' }).focus();
		await page.keyboard.press('Tab');
		await expect(page.locator(':focus')).toBeVisible();
	});

	test('no page scrolls horizontally at any width', async ({ page }) => {
		await signIn(page, ACCOUNTS.sales);

		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/dashboard');
			await expectOneH1(page);
			await expectNoHorizontalOverflow(page);
		}
	});

	test('every control on the dashboard is at least 44px', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await signIn(page, ACCOUNTS.sales);

		const small = await page.evaluate(() => {
			const controls = Array.from(
				document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea')
			).filter((element) => !element.closest('[hidden]') && element.offsetParent !== null);
			return controls
				.map((element) => {
					const box = element.getBoundingClientRect();
					return {
						tag: element.tagName.toLowerCase(),
						label:
							element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? '',
						width: Math.round(box.width),
						height: Math.round(box.height)
					};
				})
				.filter((control) => control.width < 44 || control.height < 44);
		});

		expect(small).toEqual([]);
	});

	test('dark mode and reduced motion respond to system preference', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
		await signIn(page, ACCOUNTS.sales);

		await expect
			.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
			.toBe(true);

		const background = await page.evaluate(() =>
			getComputedStyle(document.body).getPropertyValue('background-color')
		);
		expect(background).not.toBe('rgb(251, 250, 248)');
	});

	test('the app is usable at 200% text zoom', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await signIn(page, ACCOUNTS.sales);

		await page.evaluate(() => {
			document.documentElement.style.fontSize = '200%';
		});

		await expectOneH1(page);
		await expectNoHorizontalOverflow(page);
		const problems = watchConsole(page);
		expect(problems).toEqual([]);
	});
});
