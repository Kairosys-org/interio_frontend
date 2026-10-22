import path from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const alias = {
	$modules: path.resolve('./src/modules'),
	$shared: path.resolve('./src/shared'),
	$network: path.resolve('./src/network'),
	$lib: path.resolve('./src/lib')
};

export default defineConfig({
	resolve: { alias },
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				plugins: [svelte({ hot: false })],
				resolve: { alias },
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
					exclude: ['**/*.svelte.test.ts', '**/node_modules/**']
				}
			},
			{
				plugins: [svelte({ hot: false })],
				resolve: { alias },
				test: {
					name: 'client',
					include: ['src/**/*.svelte.test.ts'],
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }]
					}
				}
			}
		]
	}
});
