import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Mirrors `scripts/check-architecture.mjs` (§14.1) so unit runs fail too. */
const FORBIDDEN_IMPORT = [
	/data\/mock(?:\/[^"']*)?$/,
	/data\/adapters\//,
	/^\.\/mock$/,
	/\$network\/mock-backend/,
	/\$network\/mock-bootstrap/
];

const SCAN_EXTENSIONS = ['.ts', '.svelte'];
const SKIP_DIRECTORIES = new Set(['node_modules', '.svelte-kit', 'build', 'dist', 'coverage']);

interface Violation {
	file: string;
	specifier: string;
}

function isForbiddenSpecifier(specifier: string): boolean {
	return FORBIDDEN_IMPORT.some((pattern) => pattern.test(specifier));
}

function walk(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRECTORIES.has(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) files.push(...walk(full));
		else if (SCAN_EXTENSIONS.some((extension) => entry.endsWith(extension))) files.push(full);
	}
	return files;
}

function specifiersIn(file: string): string[] {
	const source = readFileSync(file, 'utf8');
	const specifiers: string[] = [];
	const staticImport = /\bfrom\s+['"]([^'"]+)['"]/g;
	const dynamicImport = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

	for (const pattern of [staticImport, dynamicImport]) {
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
	}
	return specifiers;
}

function scanTargets(absoluteTargets: string[]): Violation[] {
	const violations: Violation[] = [];
	for (const target of absoluteTargets) {
		for (const file of walk(target)) {
			if (/\.(test|spec)\.(ts|js)$/.test(file)) continue;
			for (const specifier of specifiersIn(file)) {
				if (isForbiddenSpecifier(specifier)) {
					violations.push({ file: relative(ROOT, file), specifier });
				}
			}
		}
	}
	return violations;
}

function guardedTargets(): string[] {
	const modulesDir = join(ROOT, 'src/modules');
	const moduleTargets = existsSync(modulesDir)
		? readdirSync(modulesDir)
				.filter((name) => statSync(join(modulesDir, name)).isDirectory())
				.map((name) => join(modulesDir, name, 'presentation'))
		: [];

	return [join(ROOT, 'src/routes'), join(ROOT, 'src/lib'), ...moduleTargets];
}

describe('repository import boundaries', () => {
	it('routes, src/lib and module presentation never import mock or adapter internals', () => {
		const violations = scanTargets(guardedTargets());

		expect(violations).toEqual([]);
	});

	it('handles missing folders as empty scans', () => {
		const violations = scanTargets([join(ROOT, 'src/__does_not_exist__')]);

		expect(violations).toEqual([]);
	});

	it('uses the same forbidden specifier patterns as arch:check', () => {
		expect(
			[
				'$modules/items/data/mock',
				'$modules/items/data/mock.ts',
				'./data/adapters/mock.repository',
				'./mock',
				'$network/mock-backend',
				'$network/mock-bootstrap'
			].filter(isForbiddenSpecifier)
		).toEqual([
			'$modules/items/data/mock',
			'./data/adapters/mock.repository',
			'./mock',
			'$network/mock-backend',
			'$network/mock-bootstrap'
		]);

		expect(
			[
				'$modules/items/data/api',
				'$shared/data/repository-mode',
				'$network/http-client',
				'./mappers/item.mapper'
			].filter(isForbiddenSpecifier)
		).toEqual([]);
	});
});
