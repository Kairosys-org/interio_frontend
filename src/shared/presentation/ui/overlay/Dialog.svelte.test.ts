import { createRawSnippet } from 'svelte';
import { afterEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Dialog from './Dialog.svelte';

const children = createRawSnippet(() => ({
	render: () => '<button type="button">Inner action</button>'
}));

/** A real trigger outside the component, so we can assert native focus return. */
function createTrigger(): HTMLButtonElement {
	const trigger = document.createElement('button');
	trigger.type = 'button';
	trigger.textContent = 'Open dialog';
	trigger.dataset.testTrigger = 'true';
	document.body.append(trigger);
	trigger.focus();
	return trigger;
}

afterEach(() => {
	for (const trigger of document.querySelectorAll('[data-test-trigger]')) trigger.remove();
});

test('opens as a modal dialog and locks page scroll', async () => {
	createTrigger();

	await render(Dialog, { open: true, title: 'Edit project', children });

	const dialog = document.querySelector('dialog');
	expect(dialog).not.toBeNull();
	await expect.poll(() => dialog?.open).toBe(true);
	expect(dialog?.matches(':modal')).toBe(true);
	expect(document.body.style.overflow).toBe('hidden');
});

test('Escape calls onclose and closes the dialog', async () => {
	const onclose = vi.fn();
	createTrigger();

	await render(Dialog, { open: true, title: 'Edit project', onclose, children });
	await expect.element(page.getByRole('dialog')).toBeVisible();

	await userEvent.keyboard('{Escape}');

	await expect.poll(() => document.querySelector('dialog')?.open).toBe(false);
	expect(onclose).toHaveBeenCalledOnce();
	expect(document.body.style.overflow).toBe('');
});

test('Tab cycles inside the dialog and focus returns to the trigger', async () => {
	const trigger = createTrigger();

	await render(Dialog, { open: true, title: 'Edit project', children });
	const dialog = document.querySelector('dialog');
	expect(dialog).not.toBeNull();
	await expect.element(page.getByRole('dialog')).toBeVisible();

	for (let step = 0; step < 8; step += 1) {
		await userEvent.tab();
		if (!dialog?.contains(document.activeElement)) {
			throw new Error(`Focus escaped the dialog after ${step + 1} Tab presses`);
		}
	}

	await userEvent.click(page.getByRole('button', { name: 'Close' }));

	await expect.poll(() => document.activeElement).toBe(trigger);
});
