import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default tseslint.config(
	{
		ignores: [
			'.svelte-kit/**',
			'build/**',
			'node_modules/**',
			'.playwright-cli/**',
			'test-results/**',
			'playwright-report/**',
			'coverage/**'
		]
	},
	...tseslint.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				extraFileExtensions: ['.svelte'],
				parser: tseslint.parser,
				svelteConfig,
				/**
				 * `standards/architecture.md` §14.2. Type-aware rules need the
				 * program: `svelte/no-navigation-without-resolve` only trusts a
				 * `resolve()` call or a value typed `ResolvedPathname`, and
				 * without the program it rejects every resolved value.
				 */
				projectService: true,
				tsconfigRootDir: import.meta.dirname
			}
		}
	},
	{
		files: [
			'src/routes/**/*.{ts,svelte}',
			'src/lib/**/*.{ts,svelte}',
			'src/modules/**/presentation/**/*.{ts,svelte}'
		],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						'**/data/mock*',
						'**/data/adapters/mock.repository*',
						'**/data/adapters/api.repository*',
						'**/network/mock-backend*'
					]
				}
			]
		}
	},
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
			],
			'no-undef': 'off'
		}
	}
);
