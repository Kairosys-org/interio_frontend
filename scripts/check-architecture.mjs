#!/usr/bin/env node
/**
 * Architecture boundary check (standards/architecture.md §14.1).
 *
 * Routes, src/lib and every module's presentation layer must never reach into
 * mock implementations or adapters. The repository provider is the only place
 * that picks an adapter, and presentation talks to the feature's data/api.ts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

const FORBIDDEN_IMPORT = [
	/data\/mock(?:\/[^"']*)?$/,
	/data\/adapters\//,
	/^\.\/mock$/,
	/\$network\/mock-backend/,
	/\$network\/mock-bootstrap/
];

const SCAN_EXTENSIONS = ['.ts', '.svelte'];
const SKIP_DIRECTORIES = new Set(['node_modules', '.svelte-kit', 'build', 'dist', 'coverage']);

/** @param {string} dir @returns {string[]} */
function walk(dir) {
	/** @type {string[]} */
	const files = [];
	let entries;
	try {
		entries = readdirSync(dir);
	} catch {
		return files;
	}
	for (const entry of entries) {
		if (SKIP_DIRECTORIES.has(entry)) continue;
		const full = join(dir, entry);
		const stats = statSync(full);
		if (stats.isDirectory()) {
			files.push(...walk(full));
		} else if (SCAN_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
			files.push(full);
		}
	}
	return files;
}

/** @param {string} file @returns {string[]} */
function specifiersIn(file) {
	const source = readFileSync(file, 'utf8');
	const specifiers = [];
	const staticImport = /\bfrom\s+['"]([^'"]+)['"]/g;
	const dynamicImport = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
	for (const pattern of [staticImport, dynamicImport]) {
		let match;
		while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
	}
	return specifiers;
}

const targets = [
	'src/routes',
	'src/lib',
	...(() => {
		const modulesDir = join(ROOT, 'src/modules');
		let names = [];
		try {
			names = readdirSync(modulesDir).filter((name) =>
				statSync(join(modulesDir, name)).isDirectory()
			);
		} catch {
			return [];
		}
		return names.map((name) => `src/modules/${name}/presentation`);
	})()
];

/** @type {string[]} */
const violations = [];
let scanned = 0;

for (const target of targets) {
	for (const file of walk(join(ROOT, target))) {
		scanned += 1;
		if (/\.(test|spec)\.(ts|js)$/.test(file)) continue;
		for (const specifier of specifiersIn(file)) {
			if (FORBIDDEN_IMPORT.some((pattern) => pattern.test(specifier))) {
				violations.push(`${relative(ROOT, file)} -> ${specifier}`);
			}
		}
	}
}

if (violations.length > 0) {
	for (const violation of violations) console.error(violation);
	console.error(`\nExpected: 0 violations, found: ${violations.length}`);
	process.exit(1);
}

console.log(`arch:check OK — ${scanned} files scanned, 0 violations`);
