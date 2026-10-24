import { describe, expect, it } from 'vitest';
import {
	ARITHMETIC_KEYS,
	formatRuleExpression,
	isPlainObject,
	parseRuleExpressionText,
	ruleExpressionsEqual,
	stableStringify,
	validateRuleExpression
} from './rule-expression';

const PARAMETERS = ['width', 'height', 'depth', 'thickness', 'shelves', 'drawers'];

describe('parseRuleExpressionText', () => {
	it('parses a JSON object', () => {
		const parsed = parseRuleExpressionText('{ "length": "width - 18", "qty": 1 }');
		expect(parsed.ok).toBe(true);
		if (parsed.ok) expect(parsed.value).toEqual({ length: 'width - 18', qty: 1 });
	});

	it('rejects empty text', () => {
		const parsed = parseRuleExpressionText('   ');
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.issue).toMatchObject({
				message: 'Enter a rule expression.',
				line: 1,
				column: 1
			});
		}
	});

	it('reports a real line and column for invalid JSON', () => {
		const parsed = parseRuleExpressionText(
			['{', '  "length": 1,', '  "width": ,', '  "qty": 1', '}'].join('\n')
		);
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.issue.line).toBe(3);
			expect(parsed.issue.column).toBeGreaterThan(10);
			expect(parsed.issue.message).toBe(
				`Rule JSON is not valid at line 3, column ${parsed.issue.column}.`
			);
		}
	});

	it('rejects JSON that is not an object', () => {
		for (const text of ['[1, 2]', '42', '"width"', 'null']) {
			const parsed = parseRuleExpressionText(text);
			expect(parsed.ok).toBe(false);
			if (!parsed.ok) {
				expect(parsed.issue.message).toBe('The rule expression must be a JSON object.');
			}
		}
	});
});

describe('validateRuleExpression', () => {
	it('accepts expressions that only use known parameters and the grammar', () => {
		const value = {
			length: '(width - 2 * thickness) / 2',
			height: 'height - 40',
			qty: 'shelves + drawers',
			depth: 500,
			enabled: true,
			label: null
		};
		const result = validateRuleExpression(value, PARAMETERS);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(value);
	});

	it('accepts unary signs and decimal numbers', () => {
		expect(validateRuleExpression({ length: '-width + 2.5' }, PARAMETERS).ok).toBe(true);
		expect(validateRuleExpression({ length: '+width * (3 - 1)' }, PARAMETERS).ok).toBe(true);
	});

	it('rejects a non-object expression', () => {
		for (const value of [null, [], 'width', 42]) {
			const result = validateRuleExpression(value, PARAMETERS);
			expect(result.ok).toBe(false);
		}
	});

	it('names an unknown identifier', () => {
		const result = validateRuleExpression({ length: 'width - plinth_height' }, PARAMETERS);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues[0]).toMatchObject({
				message: 'Unknown parameter "plinth_height".',
				path: 'length',
				line: 1,
				column: 9
			});
		}
	});

	it('rejects function calls', () => {
		const result = validateRuleExpression({ length: 'max(width, 3)' }, PARAMETERS);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues[0]?.message).toBe(
				'Function calls are not allowed in a rule expression.'
			);
		}
	});

	it('rejects quotes, semicolons and other characters', () => {
		const quoted = validateRuleExpression({ length: 'width + "10"' }, PARAMETERS);
		expect(quoted.ok).toBe(false);
		if (!quoted.ok) {
			expect(quoted.issues[0]?.message).toBe('Quotes are not allowed in a rule expression.');
		}

		const semicolon = validateRuleExpression({ length: 'width; height' }, PARAMETERS);
		expect(semicolon.ok).toBe(false);
		if (!semicolon.ok) {
			expect(semicolon.issues[0]?.message).toBe('Semicolons are not allowed in a rule expression.');
		}

		const percent = validateRuleExpression({ length: 'width % 2' }, PARAMETERS);
		expect(percent.ok).toBe(false);
		if (!percent.ok) {
			expect(percent.issues[0]?.message).toBe('Unexpected character "%".');
		}
	});

	it('rejects strings outside the arithmetic keys', () => {
		const result = validateRuleExpression({ material: 'oak', length: 'width' }, PARAMETERS);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues[0]).toMatchObject({
				path: 'material',
				message:
					'Only length, width, height, depth, qty, quantity and thickness may hold an expression.'
			});
		}
	});

	it('walks nested objects and arrays', () => {
		const value = {
			clauses: [{ length: 'width - 10' }, { height: 'height - 20' }]
		};
		expect(validateRuleExpression(value, PARAMETERS).ok).toBe(true);

		const broken = {
			clauses: [{ length: 'width - 10' }, { height: 'height - missing' }]
		};
		const result = validateRuleExpression(broken, PARAMETERS);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues[0]).toMatchObject({
				path: 'clauses.1.height',
				message: 'Unknown parameter "missing".'
			});
		}
	});

	it('rejects an expression that ends early or leaves a trailing token', () => {
		const early = validateRuleExpression({ length: 'width +' }, PARAMETERS);
		expect(early.ok).toBe(false);
		if (!early.ok) {
			expect(early.issues[0]?.message).toBe('Expected a value or parameter name.');
		}

		const trailing = validateRuleExpression({ length: 'width 3' }, PARAMETERS);
		expect(trailing.ok).toBe(false);
		if (!trailing.ok) {
			expect(trailing.issues[0]?.message).toBe('Unexpected "3" in a rule expression.');
		}
	});

	it('rejects an unclosed parenthesis and an empty expression', () => {
		const unclosed = validateRuleExpression({ length: '(width - 1' }, PARAMETERS);
		expect(unclosed.ok).toBe(false);
		if (!unclosed.ok) expect(unclosed.issues[0]?.message).toBe('Expected ")".');

		const empty = validateRuleExpression({ length: '   ' }, PARAMETERS);
		expect(empty.ok).toBe(false);
		if (!empty.ok) expect(empty.issues[0]?.message).toBe('Enter an expression.');
	});
});

describe('formatting and equality', () => {
	it('formats with two spaces and sorted keys', () => {
		const text = formatRuleExpression({ qty: 1, length: 'width - 18' });
		expect(text).toBe('{\n  "length": "width - 18",\n  "qty": 1\n}');
	});

	it('formats nested values deterministically', () => {
		const first = formatRuleExpression({ b: [2, 1], a: { z: true, y: null } });
		const second = formatRuleExpression({ a: { y: null, z: true }, b: [2, 1] });
		expect(first).toBe(second);
	});

	it('compares values independent of key order', () => {
		expect(ruleExpressionsEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
		expect(ruleExpressionsEqual({ a: 1 }, { a: 2 })).toBe(false);
		expect(ruleExpressionsEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
		expect(ruleExpressionsEqual(null, null)).toBe(true);
	});

	it('exposes the arithmetic keys and a plain-object guard', () => {
		expect([...ARITHMETIC_KEYS].sort()).toEqual([
			'depth',
			'height',
			'length',
			'qty',
			'quantity',
			'thickness',
			'width'
		]);
		expect(isPlainObject({})).toBe(true);
		expect(isPlainObject([])).toBe(false);
		expect(isPlainObject(null)).toBe(false);
		expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
	});
});
