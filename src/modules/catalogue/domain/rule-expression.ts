/**
 * Component-rule expression helpers (phase-3 §9.1).
 *
 * The catalogue stores a declarative JSON expression per rule. It is never
 * executed in the browser — Phase 6 owns the deterministic engine — so this
 * module only parses, validates and formats the stored value. No `eval`, no
 * `Function`, no implicit arithmetic on user data.
 */

/** Keys that may hold an arithmetic expression string. */
export const ARITHMETIC_KEYS: ReadonlySet<string> = new Set([
	'length',
	'width',
	'height',
	'depth',
	'qty',
	'quantity',
	'thickness'
]);

const ONLY_ARITHMETIC_KEYS_MESSAGE =
	'Only length, width, height, depth, qty, quantity and thickness may hold an expression.';

export interface RuleExpressionIssue {
	message: string;
	/** 1-based line inside the JSON text or the expression string. */
	line: number;
	/** 1-based column inside the JSON text or the expression string. */
	column: number;
	/** Dotted path to the offending key, when the issue is inside the object. */
	path?: string;
}

export type RuleExpressionParseResult =
	{ ok: true; value: Record<string, unknown> } | { ok: false; issue: RuleExpressionIssue };

export type RuleExpressionValidationResult =
	{ ok: true; value: Record<string, unknown> } | { ok: false; issues: RuleExpressionIssue[] };

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positionFromIndex(text: string, index: number): { line: number; column: number } {
	const clamped = Math.max(0, Math.min(index, text.length));
	const before = text.slice(0, clamped);
	const line = before.split('\n').length;
	const lastNewline = before.lastIndexOf('\n');
	return { line, column: clamped - lastNewline };
}

function jsonErrorPosition(text: string, message: string): { line: number; column: number } {
	const lineColumn = /\(line (\d+) column (\d+)\)/.exec(message);
	if (lineColumn) {
		return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
	}

	const position = /at position (\d+)/.exec(message);
	if (position) return positionFromIndex(text, Number(position[1]));

	return positionFromIndex(text, findJsonErrorIndex(text));
}

/**
 * V8 sometimes reports a JSON error without a position (it prints a snippet
 * instead). This scanner mirrors the JSON grammar just far enough to locate
 * the first offending character; the result is only used for line/column.
 */
function findJsonErrorIndex(text: string): number {
	let index = 0;

	const skipWhitespace = (): void => {
		while (index < text.length) {
			const char = text[index];
			if (char === ' ' || char === '\t' || char === '\n' || char === '\r') index += 1;
			else break;
		}
	};

	const fail = (): number => index;

	const parseString = (): number | null => {
		index += 1;
		while (index < text.length) {
			const char = text[index];
			if (char === '"') {
				index += 1;
				return null;
			}
			if (char === '\\') {
				index += 1;
				const escape = text[index];
				if (escape === undefined) return fail();
				if ('"\\/bfnrt'.includes(escape)) {
					index += 1;
					continue;
				}
				if (escape === 'u') {
					for (let offset = 1; offset <= 4; offset += 1) {
						if (!/[0-9a-fA-F]/.test(text[index + offset] ?? '')) return fail();
					}
					index += 5;
					continue;
				}
				return fail();
			}
			if (char === '\n' || char === '\r') return fail();
			index += 1;
		}
		return fail();
	};

	const parseNumber = (): number | null => {
		const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(index));
		if (!match) return fail();
		index += match[0].length;
		return null;
	};

	const parseValue = (): number | null => {
		skipWhitespace();
		const char = text[index];
		if (char === undefined) return fail();

		if (char === '{') {
			index += 1;
			skipWhitespace();
			if (text[index] === '}') {
				index += 1;
				return null;
			}
			while (index < text.length) {
				skipWhitespace();
				if (text[index] !== '"') return fail();
				const stringError = parseString();
				if (stringError !== null) return stringError;
				skipWhitespace();
				if (text[index] !== ':') return fail();
				index += 1;
				const valueError = parseValue();
				if (valueError !== null) return valueError;
				skipWhitespace();
				if (text[index] === ',') {
					index += 1;
					continue;
				}
				if (text[index] === '}') {
					index += 1;
					return null;
				}
				return fail();
			}
			return fail();
		}

		if (char === '[') {
			index += 1;
			skipWhitespace();
			if (text[index] === ']') {
				index += 1;
				return null;
			}
			while (index < text.length) {
				const valueError = parseValue();
				if (valueError !== null) return valueError;
				skipWhitespace();
				if (text[index] === ',') {
					index += 1;
					continue;
				}
				if (text[index] === ']') {
					index += 1;
					return null;
				}
				return fail();
			}
			return fail();
		}

		if (char === '"') return parseString();

		if (char === '-' || (char >= '0' && char <= '9')) return parseNumber();

		if (text.startsWith('true', index)) {
			index += 4;
			return null;
		}
		if (text.startsWith('false', index)) {
			index += 5;
			return null;
		}
		if (text.startsWith('null', index)) {
			index += 4;
			return null;
		}

		return fail();
	};

	const errorIndex = parseValue();
	if (errorIndex !== null) return errorIndex;

	skipWhitespace();
	return index < text.length ? index : Math.max(0, text.length - 1);
}

/**
 * Parses the editor text. JSON syntax errors carry the real line and column
 * so the editor can say "Rule JSON is not valid at line 3, column 5."
 */
export function parseRuleExpressionText(text: string): RuleExpressionParseResult {
	if (typeof text !== 'string' || text.trim().length === 0) {
		return {
			ok: false,
			issue: { message: 'Enter a rule expression.', line: 1, column: 1 }
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text) as unknown;
	} catch (error) {
		const rawMessage = error instanceof Error ? error.message : '';
		const { line, column } = jsonErrorPosition(text, rawMessage);
		return {
			ok: false,
			issue: {
				message: `Rule JSON is not valid at line ${line}, column ${column}.`,
				line,
				column
			}
		};
	}

	if (!isPlainObject(parsed)) {
		const firstValue = text.search(/\S/);
		const { line, column } = positionFromIndex(text, firstValue < 0 ? 0 : firstValue);
		return {
			ok: false,
			issue: {
				message: 'The rule expression must be a JSON object.',
				line,
				column
			}
		};
	}

	return { ok: true, value: parsed };
}

/* ------------------------------------------------------------------ */
/* Arithmetic grammar: identifiers, numbers, + - * / and parentheses.  */
/* ------------------------------------------------------------------ */

type TokenType = 'number' | 'identifier' | 'operator' | 'lparen' | 'rparen' | 'comma';

interface Token {
	type: TokenType;
	text: string;
	index: number;
}

type TokeniseResult = { ok: true; tokens: Token[] } | { ok: false; issue: RuleExpressionIssue };

function issueAt(text: string, index: number, message: string, path: string): RuleExpressionIssue {
	const { line, column } = positionFromIndex(text, index);
	return { message, line, column, path };
}

function tokenise(text: string, path: string): TokeniseResult {
	const tokens: Token[] = [];
	let index = 0;

	while (index < text.length) {
		const char = text[index];

		if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
			index += 1;
			continue;
		}

		if (char === '"' || char === "'") {
			return {
				ok: false,
				issue: issueAt(text, index, 'Quotes are not allowed in a rule expression.', path)
			};
		}

		if (char === ';') {
			return {
				ok: false,
				issue: issueAt(text, index, 'Semicolons are not allowed in a rule expression.', path)
			};
		}

		if (
			char === '(' ||
			char === ')' ||
			char === '+' ||
			char === '-' ||
			char === '*' ||
			char === '/'
		) {
			tokens.push({
				type: char === '(' ? 'lparen' : char === ')' ? 'rparen' : 'operator',
				text: char,
				index
			});
			index += 1;
			continue;
		}

		if (char === ',') {
			tokens.push({ type: 'comma', text: char, index });
			index += 1;
			continue;
		}

		if (char >= '0' && char <= '9') {
			const start = index;
			while (index < text.length && text[index] >= '0' && text[index] <= '9') index += 1;
			if (text[index] === '.' && text[index + 1] >= '0' && text[index + 1] <= '9') {
				index += 1;
				while (index < text.length && text[index] >= '0' && text[index] <= '9') index += 1;
			}
			tokens.push({ type: 'number', text: text.slice(start, index), index: start });
			continue;
		}

		if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_') {
			const start = index;
			while (index < text.length) {
				const next = text[index];
				const allowed =
					(next >= 'a' && next <= 'z') ||
					(next >= 'A' && next <= 'Z') ||
					(next >= '0' && next <= '9') ||
					next === '_';
				if (!allowed) break;
				index += 1;
			}
			tokens.push({ type: 'identifier', text: text.slice(start, index), index: start });
			continue;
		}

		return {
			ok: false,
			issue: issueAt(text, index, `Unexpected character "${char}".`, path)
		};
	}

	return { ok: true, tokens };
}

type ParseResult = { ok: true } | { ok: false; issue: RuleExpressionIssue };

/** Recursive-descent parser; it validates the shape and never evaluates. */
function parseArithmetic(
	text: string,
	path: string,
	parameterNames: ReadonlySet<string>
): ParseResult {
	if (text.trim().length === 0) {
		return { ok: false, issue: issueAt(text, 0, 'Enter an expression.', path) };
	}

	const tokenised = tokenise(text, path);
	if (!tokenised.ok) return { ok: false, issue: tokenised.issue };

	const tokens = tokenised.tokens;
	let cursor = 0;

	const current = (): Token | undefined => tokens[cursor];
	const currentIndex = (): number => current()?.index ?? text.length;
	const fail = (index: number, message: string): ParseResult => ({
		ok: false,
		issue: issueAt(text, index, message, path)
	});
	const unexpected = (token: Token | undefined): ParseResult =>
		token
			? fail(token.index, `Unexpected "${token.text}" in a rule expression.`)
			: fail(text.length, 'The expression ends unexpectedly.');

	function parseExpression(): ParseResult {
		const first = parseTerm();
		if (!first.ok) return first;

		while (current()?.type === 'operator' && (current()?.text === '+' || current()?.text === '-')) {
			cursor += 1;
			const right = parseTerm();
			if (!right.ok) return right;
		}
		return { ok: true };
	}

	function parseTerm(): ParseResult {
		const first = parseFactor();
		if (!first.ok) return first;

		while (current()?.type === 'operator' && (current()?.text === '*' || current()?.text === '/')) {
			cursor += 1;
			const right = parseFactor();
			if (!right.ok) return right;
		}
		return { ok: true };
	}

	function parseFactor(): ParseResult {
		const token = current();
		if (!token) return fail(text.length, 'Expected a value or parameter name.');

		if (token.type === 'operator' && (token.text === '+' || token.text === '-')) {
			cursor += 1;
			return parseFactor();
		}

		if (token.type === 'number') {
			cursor += 1;
			return { ok: true };
		}

		if (token.type === 'identifier') {
			cursor += 1;
			const next = current();
			if (next?.type === 'lparen') {
				return fail(next.index, 'Function calls are not allowed in a rule expression.');
			}
			if (!parameterNames.has(token.text)) {
				return fail(token.index, `Unknown parameter "${token.text}".`);
			}
			return { ok: true };
		}

		if (token.type === 'lparen') {
			cursor += 1;
			const inner = parseExpression();
			if (!inner.ok) return inner;
			const closing = current();
			if (closing?.type !== 'rparen') {
				return fail(currentIndex(), 'Expected ")".');
			}
			cursor += 1;
			return { ok: true };
		}

		return unexpected(token);
	}

	const parsed = parseExpression();
	if (!parsed.ok) return parsed;

	if (cursor < tokens.length) return unexpected(tokens[cursor]);

	return { ok: true };
}

function walkExpression(
	node: unknown,
	path: string[],
	key: string | null,
	parameterNames: ReadonlySet<string>,
	issues: RuleExpressionIssue[]
): void {
	if (typeof node === 'string') {
		if (key === null || !ARITHMETIC_KEYS.has(key)) {
			issues.push({
				message: ONLY_ARITHMETIC_KEYS_MESSAGE,
				line: 1,
				column: 1,
				path: path.join('.')
			});
			return;
		}

		const parsed = parseArithmetic(node, path.join('.'), parameterNames);
		if (!parsed.ok) issues.push(parsed.issue);
		return;
	}

	if (Array.isArray(node)) {
		node.forEach((item, index) => {
			walkExpression(item, [...path, String(index)], null, parameterNames, issues);
		});
		return;
	}

	if (isPlainObject(node)) {
		for (const [childKey, childValue] of Object.entries(node)) {
			walkExpression(childValue, [...path, childKey], childKey, parameterNames, issues);
		}
	}
}

/**
 * Validates the stored object: objects only, expressions only under the
 * arithmetic keys, grammar limited to identifiers/numbers/+ - * / ( ), and
 * every identifier must be a parameter of the cabinet.
 */
export function validateRuleExpression(
	value: unknown,
	parameterNames: readonly string[]
): RuleExpressionValidationResult {
	if (!isPlainObject(value)) {
		return {
			ok: false,
			issues: [
				{
					message: 'The rule expression must be a JSON object.',
					line: 1,
					column: 1
				}
			]
		};
	}

	const names = new Set(parameterNames);
	const issues: RuleExpressionIssue[] = [];
	walkExpression(value, [], null, names, issues);

	return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}

/* ------------------------------------------------------------------ */
/* Stable formatting and comparison (rule_version uses this).          */
/* ------------------------------------------------------------------ */

function canonicalise(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalise);
	if (isPlainObject(value)) {
		const result: Record<string, unknown> = {};
		for (const key of Object.keys(value).sort()) {
			result[key] = canonicalise(value[key]);
		}
		return result;
	}
	return value;
}

/** Key-sorted JSON, so two equal values always produce the same text. */
export function stableStringify(value: unknown): string {
	return JSON.stringify(canonicalise(value)) ?? 'undefined';
}

/** Stable 2-space JSON for the editor's "Format" action. */
export function formatRuleExpression(value: unknown): string {
	return JSON.stringify(canonicalise(value), null, 2);
}

export function ruleExpressionsEqual(first: unknown, second: unknown): boolean {
	return stableStringify(first) === stableStringify(second);
}
