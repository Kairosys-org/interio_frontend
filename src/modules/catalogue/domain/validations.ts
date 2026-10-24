import { z } from 'zod';
import {
	CABINET_FAMILIES,
	CABINET_PARAMETER_UNITS,
	CONSTRUCTION_METHODS
} from '$shared/domain/record-states';
import type { CabinetParameterValue, CabinetParameterInput } from './types';

/**
 * Catalogue form schemas (phase-3 §2, §5.3).
 *
 * Parameter bounds are enforced here and again by the mock repository, so an
 * out-of-bounds configuration never reaches the catalogue (FT-M5-01). The
 * arithmetic expression itself is validated by `rule-expression.ts`.
 */

/** Lower snake_case, starting with a letter. */
export const PARAMETER_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

const ONLY_NUMERIC_BOUNDS_MESSAGE = 'Only mm and count parameters use a minimum and maximum.';
const ONLY_ENUM_VALUES_MESSAGE = 'Only enum parameters use allowed values.';

function blankToNull(value: unknown): unknown {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function collapseText(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

export const cabinetFormSchema = z.object({
	caption: z
		.string()
		.trim()
		.min(1, 'Enter a cabinet caption.')
		.max(120, 'Keep the caption to 120 characters or fewer.')
		.transform(collapseText),
	family: z.enum(CABINET_FAMILIES),
	description: z.preprocess(
		blankToNull,
		z.string().trim().max(500, 'Keep the description to 500 characters or fewer.').nullable()
	),
	constructionMethod: z.enum(CONSTRUCTION_METHODS)
});

export type CabinetFormValues = z.infer<typeof cabinetFormSchema>;

const parameterValueSchema = z
	.union([z.string().trim(), z.number().finite(), z.boolean(), z.null()])
	.default(null);

export const parameterSchema = z
	.object({
		id: z.string().uuid('Choose a valid parameter id.').optional(),
		paramName: z
			.string()
			.trim()
			.min(1, 'Enter a parameter name.')
			.regex(
				PARAMETER_NAME_PATTERN,
				'Use lower snake_case, starting with a letter (for example, door_width).'
			),
		unit: z.enum(CABINET_PARAMETER_UNITS),
		minValue: z.number().finite().nullable().default(null),
		maxValue: z.number().finite().nullable().default(null),
		defaultValue: parameterValueSchema,
		allowedValues: z
			.array(z.string().trim().min(1, 'Allowed values cannot be empty.'))
			.nullable()
			.default(null),
		required: z.boolean().default(true),
		sortOrder: z
			.number()
			.int('Use a whole number for the sort order.')
			.min(0, 'The sort order cannot be negative.')
			.default(0)
	})
	.superRefine((value, ctx) => {
		const numeric = value.unit === 'mm' || value.unit === 'count';

		if (!numeric && (value.minValue !== null || value.maxValue !== null)) {
			ctx.addIssue({
				code: 'custom',
				path: ['minValue'],
				message: ONLY_NUMERIC_BOUNDS_MESSAGE
			});
		}

		if (value.unit !== 'enum' && value.allowedValues !== null) {
			ctx.addIssue({
				code: 'custom',
				path: ['allowedValues'],
				message: ONLY_ENUM_VALUES_MESSAGE
			});
		}

		if (numeric) {
			if (value.minValue !== null && value.maxValue !== null && value.minValue > value.maxValue) {
				ctx.addIssue({
					code: 'custom',
					path: ['minValue'],
					message: 'Enter a minimum no greater than the maximum.'
				});
			}

			if (typeof value.defaultValue !== 'number' || !Number.isFinite(value.defaultValue)) {
				ctx.addIssue({
					code: 'custom',
					path: ['defaultValue'],
					message: 'Enter a default number for this parameter.'
				});
			} else {
				if (value.minValue !== null && value.defaultValue < value.minValue) {
					ctx.addIssue({
						code: 'custom',
						path: ['defaultValue'],
						message: 'Enter a default no lower than the minimum.'
					});
				}
				if (value.maxValue !== null && value.defaultValue > value.maxValue) {
					ctx.addIssue({
						code: 'custom',
						path: ['defaultValue'],
						message: 'Enter a default no higher than the maximum.'
					});
				}
			}
		}

		if (value.unit === 'enum') {
			const allowed = value.allowedValues ?? [];
			if (allowed.length < 2) {
				ctx.addIssue({
					code: 'custom',
					path: ['allowedValues'],
					message: 'Add at least two allowed values.'
				});
			} else if (new Set(allowed).size !== allowed.length) {
				ctx.addIssue({
					code: 'custom',
					path: ['allowedValues'],
					message: 'Allowed values must be unique.'
				});
			}

			if (typeof value.defaultValue !== 'string' || !allowed.includes(value.defaultValue)) {
				ctx.addIssue({
					code: 'custom',
					path: ['defaultValue'],
					message: 'Choose a default from the allowed values.'
				});
			}
		}

		if (value.unit === 'bool') {
			if (value.defaultValue !== null && typeof value.defaultValue !== 'boolean') {
				ctx.addIssue({
					code: 'custom',
					path: ['defaultValue'],
					message: 'Choose true, false or no default.'
				});
			}
		}

		if (value.unit === 'text') {
			if (value.defaultValue !== null && typeof value.defaultValue !== 'string') {
				ctx.addIssue({
					code: 'custom',
					path: ['defaultValue'],
					message: 'Enter text or leave the default empty.'
				});
			}
		}
	});

export type ParameterFormValues = z.infer<typeof parameterSchema>;

export const ruleSchema = z.object({
	partType: z.string().trim().min(1, 'Enter a part type.').transform(collapseText),
	expr: z.record(z.string(), z.unknown()),
	condition: z.record(z.string(), z.unknown()).nullable().default(null)
});

export type RuleFormValues = z.infer<typeof ruleSchema>;

/**
 * Pure normalisation shared by the mock repository and tests. Bounds are
 * never clamped here: an out-of-bounds value must fail validation instead.
 */
export function normaliseParameterInput(input: CabinetParameterInput): CabinetParameterInput {
	const result: CabinetParameterInput = {
		...input,
		paramName: input.paramName.trim()
	};

	if (input.allowedValues !== undefined) {
		result.allowedValues =
			input.allowedValues === null ? null : input.allowedValues.map((value) => value.trim());
	}

	return result;
}

/** Defaults resolved from the parameter rows; stored on the cabinet. */
export function resolveParameterDefaults(
	parameters: ReadonlyArray<{ paramName: string; defaultValue: CabinetParameterValue }>
): Record<string, unknown> {
	const defaults: Record<string, unknown> = {};
	for (const parameter of parameters) {
		defaults[parameter.paramName] = parameter.defaultValue;
	}
	return defaults;
}

/** First message per field, keyed by the schema path (optionally prefixed). */
export function fieldErrorsFrom(error: z.ZodError, prefix = ''): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const path = issue.path.join('.') || 'form';
		const key = prefix.length > 0 ? `${prefix}.${path}` : path;
		if (!(key in errors)) errors[key] = issue.message;
	}
	return errors;
}
