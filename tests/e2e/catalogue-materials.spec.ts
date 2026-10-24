import { expect, test, type Page } from '@playwright/test';
import {
	ACCOUNTS,
	MFA_CODE,
	expectNoHorizontalOverflow,
	expectOneH1,
	fillCredentials,
	watchConsole
} from './helpers';

/**
 * Phase 3 journeys (requirements/phase-3.md §8): the catalogue and materials
 * master data are only done when a real browser can filter, edit, reject
 * invalid input, keep rule versions, link suppliers and import both new
 * master-data kinds. Every test starts in a fresh context, so the mock
 * database reseeds deterministically.
 */
test.setTimeout(90_000);

/** The owner account carries MFA, so the code field must render before it is filled. */
async function signInOwner(page: Page): Promise<void> {
	await page.goto('/login');
	await fillCredentials(page, ACCOUNTS.owner);
	const code = page.getByLabel(/authentication code/i);
	await expect(code).toBeVisible();
	await code.fill(MFA_CODE);
	await page.getByRole('button', { name: /^verify$/i }).click();
	await expect(page).not.toHaveURL(/\/login/);
}

async function openCabinetDetail(page: Page, caption = 'Base cabinet 600'): Promise<void> {
	await page.goto('/catalogue/cabinets');
	await page.getByRole('link', { name: caption }).click();
	await expect(page.getByRole('heading', { name: caption, level: 1 })).toBeVisible();
}

async function uploadCsv(page: Page, name: string, content: string): Promise<void> {
	await page.locator('input[type="file"]').setInputFiles({
		name,
		mimeType: 'text/csv',
		buffer: Buffer.from(content, 'utf8')
	});
	await expect(page.getByText(name, { exact: true })).toBeVisible();
}

test.describe('catalogue', () => {
	test('a cabinet is created, filtered by family and opened on both tabs', async ({ page }) => {
		const problems = watchConsole(page);
		await signInOwner(page);

		await page.goto('/catalogue/cabinets');
		await expectOneH1(page);
		await expect(page.getByRole('heading', { name: 'Cabinets', level: 1 })).toBeVisible();
		await expect(page.getByText('24 cabinets', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'New cabinet' }).click();
		const dialog = page.locator('dialog[open]');
		await expect(dialog.getByRole('heading', { name: 'New cabinet' })).toBeVisible();
		await dialog.getByLabel('Caption').fill('E2E Cabinet 600');
		await dialog.getByLabel('Family').selectOption({ label: 'Base units' });
		await dialog.getByLabel('Construction method').selectOption({ label: 'Cam lock' });
		await dialog.getByRole('button', { name: 'Create cabinet' }).click();

		await expect(dialog).toBeHidden();
		await expect(page.getByText('Cabinet saved.', { exact: true })).toBeVisible();
		await expect(page.getByText('25 cabinets', { exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'E2E Cabinet 600' })).toBeVisible();

		// Family is a URL-backed filter: five base cabinets including the new one.
		await page.getByRole('button', { name: 'Base units', exact: true }).click();
		await expect(page).toHaveURL(/family=base/);
		await expect(page.getByText('5 cabinets', { exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'E2E Cabinet 600' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Wall cabinet 600' })).toBeHidden();

		await page.getByRole('button', { name: 'Clear filters' }).click();
		await expect(page.getByText('25 cabinets', { exact: true })).toBeVisible();

		await page.getByRole('link', { name: 'Base cabinet 600' }).click();
		await expect(page.getByRole('heading', { name: 'Base cabinet 600', level: 1 })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Parameters (18)' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'width', exact: true })).toBeVisible();

		await page.getByRole('tab', { name: /Component rules/ }).click();
		await expect(page).toHaveURL(/tab=rules/);
		const rulesTable = page.getByRole('table', { name: 'Cabinet component rules' });
		await expect(rulesTable).toBeVisible();
		await expect(rulesTable.getByText('v2', { exact: true })).toBeVisible();
		await expect(rulesTable.getByText('carcass', { exact: true }).first()).toBeVisible();

		await expectNoHorizontalOverflow(page);
		expect(problems).toEqual([]);
	});

	test('invalid bounds and rule JSON are rejected, then a change creates version 3', async ({
		page
	}) => {
		await signInOwner(page);
		await openCabinetDetail(page);

		// A mm parameter whose minimum is above its maximum names the offending field.
		await page.getByRole('button', { name: 'Add parameter' }).click();
		const parameterDrawer = page.locator('dialog[open]');
		await expect(parameterDrawer.getByRole('heading', { name: 'Add parameter' })).toBeVisible();
		await parameterDrawer.getByLabel('Parameter name').fill('e2e_width');
		await parameterDrawer.getByLabel('Type and unit').selectOption({ label: 'Millimetres' });
		await parameterDrawer.getByLabel('Minimum').fill('500');
		await parameterDrawer.getByLabel('Maximum').fill('100');
		await parameterDrawer.getByLabel('Default', { exact: true }).fill('300');
		await parameterDrawer.getByRole('button', { name: 'Add parameter' }).click();
		await expect(
			parameterDrawer.getByText('Enter a minimum no greater than the maximum.', { exact: true })
		).toBeVisible();
		await expect(parameterDrawer).toBeVisible();

		await parameterDrawer.getByLabel('Minimum').fill('100');
		await parameterDrawer.getByLabel('Maximum').fill('400');
		await parameterDrawer.getByRole('button', { name: 'Add parameter' }).click();
		await expect(parameterDrawer).toBeHidden();
		await expect(page.getByText('Parameter saved.', { exact: true })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'e2e_width', exact: true })).toBeVisible();

		// A new version starts from the active rule and keeps the part type fixed.
		await page.getByRole('tab', { name: /Component rules/ }).click();
		await page
			.getByRole('row')
			.filter({ hasText: 'v2' })
			.getByRole('button', { name: 'New version of carcass' })
			.click();
		const ruleDrawer = page.locator('dialog[open]');
		await expect(ruleDrawer.getByRole('heading', { name: 'New version of carcass' })).toBeVisible();
		await expect(ruleDrawer.getByLabel('Part type')).toHaveValue('carcass');
		await expect(ruleDrawer.getByLabel('Part type')).toBeDisabled();

		await ruleDrawer.getByLabel('Expression').fill('{ "length": }');
		await ruleDrawer.getByRole('button', { name: 'Save rule' }).click();
		await expect(ruleDrawer.getByRole('alert')).toContainText(/Rule JSON is not valid at line/);
		await expect(ruleDrawer).toBeVisible();

		await ruleDrawer
			.getByLabel('Expression')
			.fill('{ "length": "width - 4 * thickness", "height": "height - 20", "qty": 1 }');
		await ruleDrawer.getByRole('button', { name: 'Save rule' }).click();
		await expect(ruleDrawer).toBeHidden();
		await expect(page.getByText('Component rule saved.', { exact: true })).toBeVisible();

		const rulesTable = page.getByRole('table', { name: 'Cabinet component rules' });
		await expect(rulesTable.getByText('v3', { exact: true })).toBeVisible();
		await expect(rulesTable.getByText('v2', { exact: true })).toBeVisible();
	});

	test('the cross-cabinet rules page filters by version and toggles without deleting', async ({
		page
	}) => {
		await signInOwner(page);
		await page.goto('/catalogue/rules');
		await expect(page.getByRole('heading', { name: 'Component rules', level: 1 })).toBeVisible();
		await expect(page.getByText('12 rules', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Version 2', exact: true }).click();
		await expect(page).toHaveURL(/version=2/);
		await expect(page.getByText('1 rule', { exact: true })).toBeVisible();

		const row = page.getByRole('row').filter({ hasText: 'Base cabinet 600' });
		const toggle = row.getByRole('switch', { name: 'Active' });
		await expect(toggle).toHaveAttribute('aria-checked', 'true');
		await toggle.click();
		await expect(page.getByText('Rule deactivated.', { exact: true })).toBeVisible();
		await expect(toggle).toHaveAttribute('aria-checked', 'false');

		// The row stays in the history with the same version.
		await expect(row.getByText('v2', { exact: true })).toBeVisible();
		await expect(row).toBeVisible();
	});
});

test.describe('materials', () => {
	test('decor filters, tabs, second primary supplier and attributes', async ({ page }) => {
		await signInOwner(page);
		await page.goto('/materials/decor');
		await expectOneH1(page);
		await expect(page.getByRole('heading', { name: 'Decor', level: 1 })).toBeVisible();
		await expect(page.getByText('40 decors', { exact: true })).toBeVisible();

		await page.getByLabel('Search decors').fill('Arctic White');
		await expect(page).toHaveURL(/q=Arctic\+White/);
		await expect(page.getByText('1 decor', { exact: true })).toBeVisible();

		await page.getByRole('link', { name: 'Arctic White' }).click();
		await expect(page.getByRole('heading', { name: 'Arctic White', level: 1 })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Edgings (2)' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Suppliers (2)' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Attributes (2)' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'Alpine White 22 mm', exact: true })).toBeVisible();

		await page.getByRole('tab', { name: 'Suppliers (2)' }).click();
		await expect(page).toHaveURL(/tab=suppliers/);
		await expect(page.getByRole('link', { name: 'Nordic Board Supply' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Continental Panels' })).toBeVisible();
		await expect(
			page.getByRole('row').filter({ hasText: 'Nordic Board Supply' }).getByText('Primary')
		).toBeVisible();

		// One primary per decor: the mock names the existing primary and saves nothing.
		await page.getByRole('button', { name: 'Link supplier' }).click();
		const supplierDialog = page.locator('dialog[open]');
		await expect(supplierDialog.getByRole('heading', { name: 'Link a supplier' })).toBeVisible();
		await supplierDialog.locator('select').selectOption({ label: 'Thames Timber' });
		await supplierDialog.getByLabel('Supplier code').fill('THA-E2E');
		await supplierDialog.getByLabel('Primary supplier').check();
		await supplierDialog.getByRole('button', { name: 'Link supplier' }).click();
		await expect(supplierDialog.getByRole('alert')).toContainText(
			/already has a primary supplier: Nordic Board Supply/
		);
		await expect(supplierDialog).toBeVisible();

		await supplierDialog.getByLabel('Primary supplier').uncheck();
		await supplierDialog.getByRole('button', { name: 'Link supplier' }).click();
		await expect(supplierDialog).toBeHidden();
		await expect(page.getByText('Supplier linked.', { exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Thames Timber' })).toBeVisible();

		// Attributes are a unique key/value set and save as one action.
		await page.getByRole('tab', { name: 'Attributes (2)' }).click();
		await expect(page.getByLabel('Key 1')).toHaveValue('Edge profile');
		await page.getByRole('button', { name: 'Add attribute' }).click();
		await page.getByLabel('Key 3').fill('E2E key');
		await page.getByLabel('Value 3').fill('E2E value');
		await page.getByRole('button', { name: 'Save attributes' }).click();
		await expect(page.getByText('Decor attributes saved.', { exact: true })).toBeVisible();
		await expect(page.getByLabel('Key 1')).toHaveValue('E2E key');

		// Decor 1 carries a sample asset, so the tab shows the file, not a placeholder.
		await page.getByRole('tab', { name: 'Sample asset' }).click();
		await expect(
			page.getByRole('cell', { name: 'smoked-oak-veneer-sample.jpg', exact: true })
		).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Current sample', { exact: true }).first()).toBeVisible({
			timeout: 15_000
		});
	});

	test('a duplicate supplier is reported but never merged', async ({ page }) => {
		await signInOwner(page);
		await page.goto('/materials/suppliers');
		await expect(page.getByRole('heading', { name: 'Suppliers', level: 1 })).toBeVisible();
		await expect(page.getByText('6 suppliers', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'New supplier' }).click();
		const dialog = page.locator('dialog[open]');
		await dialog.getByLabel('Caption').fill('Nordic Board Supply');
		await dialog.getByLabel('Contact').fill('orders@nordicboard.example');
		await dialog.getByLabel('Lead time (days)').fill('14');
		await dialog.getByRole('button', { name: 'Create supplier' }).click();

		await expect(dialog).toBeHidden();
		await expect(page.getByText('Supplier saved.', { exact: true })).toBeVisible();
		const notice = page.getByRole('status').filter({ hasText: 'was created' });
		await expect(notice).toContainText('It looks similar to existing suppliers.');
		await expect(notice).toContainText('Nordic Board Supply');
		await expect(notice).toContainText('Nothing was merged.');

		await page.getByRole('button', { name: 'Dismiss duplicate notice' }).click();
		await expect(notice).toBeHidden();
	});

	test('manufacturers and their collections are created inline', async ({ page }) => {
		await signInOwner(page);
		await page.goto('/materials/manufacturers');
		await expect(page.getByRole('heading', { name: 'Manufacturers', level: 1 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Kairos Laminates' })).toBeVisible();

		await page.getByRole('button', { name: 'New manufacturer' }).click();
		const manufacturerDialog = page.locator('dialog[open]');
		await manufacturerDialog.getByLabel('Caption').fill('E2E Laminates');
		await manufacturerDialog.getByLabel('Country').fill('United Kingdom');
		await manufacturerDialog.getByRole('button', { name: 'Create manufacturer' }).click();
		await expect(manufacturerDialog).toBeHidden();
		await expect(page.getByText('Manufacturer saved.', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'E2E Laminates' })).toBeVisible();

		await page.getByRole('button', { name: 'New collection for E2E Laminates' }).click();
		const collectionDialog = page.locator('dialog[open]');
		await expect(collectionDialog.getByRole('heading', { name: 'New collection' })).toBeVisible();
		await collectionDialog.getByLabel('Caption').fill('E2E Core');
		await collectionDialog.getByRole('button', { name: 'Create collection' }).click();
		await expect(collectionDialog).toBeHidden();
		await expect(page.getByText('Collection saved.', { exact: true })).toBeVisible();
		await expect(
			page.getByRole('table', { name: 'Collections for E2E Laminates' }).getByRole('cell', {
				name: 'E2E Core',
				exact: true
			})
		).toBeVisible();
	});
});

test.describe('master-data imports', () => {
	test('the supplier kind stages, commits and feeds the supplier list', async ({ page }) => {
		await signInOwner(page);
		await page.goto('/imports/new');

		await uploadCsv(
			page,
			'supplier-e2e.csv',
			'caption,contact,lead_time_days\nE2E Supply,hello@e2e-supply.example,5\n'
		);
		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(page.getByRole('heading', { name: 'Kind' })).toBeVisible();

		await page.locator('input[type="radio"][value="supplier"]').check();
		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(page.getByRole('heading', { name: 'Map columns' })).toBeVisible();
		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();
		await expect(page.getByText(/1 ready, 0 need review, 0 rejected/)).toBeVisible();

		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(page.getByRole('heading', { name: 'Stage' })).toBeVisible();
		await expect(page.getByRole('main').getByText('Suppliers', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Stage import' }).click();

		await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
		await expect(page.getByRole('heading', { name: 'supplier-e2e.csv', level: 1 })).toBeVisible();
		await page.getByRole('button', { name: 'Commit import' }).click();
		const confirm = page.locator('dialog[open]');
		await expect(confirm).toContainText('Commit this import?');
		await confirm.getByRole('button', { name: 'Commit import' }).click();
		await expect(page.getByText('Import committed.', { exact: true })).toBeVisible();

		await page.goto('/materials/suppliers');
		await expect(page.getByRole('link', { name: 'E2E Supply' })).toBeVisible();
	});

	test('the decor kind stages, commits and feeds the decor list', async ({ page }) => {
		await signInOwner(page);
		await page.goto('/imports/new');

		await uploadCsv(
			page,
			'decor-e2e.csv',
			'manufacturer,collection,caption,decor_code\nKairos Laminates,Core Matt,E2E Walnut,E2E-9001\n'
		);
		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(page.getByRole('heading', { name: 'Kind' })).toBeVisible();

		await page.locator('input[type="radio"][value="decor"]').check();
		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(page.getByRole('heading', { name: 'Map columns' })).toBeVisible();
		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();
		await expect(page.getByText(/1 ready, 0 need review, 0 rejected/)).toBeVisible();

		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(page.getByRole('heading', { name: 'Stage' })).toBeVisible();
		await expect(page.getByRole('main').getByText('Decors', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Stage import' }).click();

		await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
		await expect(page.getByRole('heading', { name: 'decor-e2e.csv', level: 1 })).toBeVisible();
		await page.getByRole('button', { name: 'Commit import' }).click();
		const confirm = page.locator('dialog[open]');
		await expect(confirm).toContainText('Commit this import?');
		await confirm.getByRole('button', { name: 'Commit import' }).click();
		await expect(page.getByText('Import committed.', { exact: true })).toBeVisible();

		await page.goto('/materials/decor');
		await page.getByLabel('Search decors').fill('E2E Walnut');
		await expect(page.getByRole('link', { name: 'E2E Walnut' })).toBeVisible();
	});
});
