import { describe, expect, it } from 'vitest';
import {
	cabinetFormSchema,
	fieldErrorsFrom,
	normaliseParameterInput,
	parameterSchema,
	resolveParameterDefaults,
	ruleSchema
} from './validations';

const CABINET = {
	caption: 'Base cabinet 600',
	family: 'base' as const,
	description: 'Single-door base unit.',
	constructionMethod: 'cam_lock' as const
};

const PARAMETER = {
	paramName: 'width',
	unit: 'mm' as const,
	minValue: 300,
	maxValue: 1200,
	defaultValue: 600
};

describe('cabinetFormSchema', () => {
	it('trims and collapses the caption', () => {
		const parsed = cabinetFormSchema.parse({ ...CABINET, caption: '  Base    cabinet 600 ' });
		expect(parsed.caption).toBe('Base cabinet 600');
	});

	it('rejects an empty caption and a caption over 120 characters', () => {
		const empty = cabinetFormSchema.safeParse({ ...CABINET, caption: '   ' });
		expect(empty.success).toBe(false);
		if (!empty.success) {
			expect(fieldErrorsFrom(empty.error).caption).toBe('Enter a cabinet caption.');
		}

		const long = cabinetFormSchema.safeParse({ ...CABINET, caption: 'x'.repeat(121) });
		expect(long.success).toBe(false);
		if (!long.success) {
			expect(fieldErrorsFrom(long.error).caption).toBe(
				'Keep the caption to 120 characters or fewer.'
			);
		}
	});

	it('turns a blank description into null and rejects one over 500 characters', () => {
		const blank = cabinetFormSchema.parse({ ...CABINET, description: '   ' });
		expect(blank.description).toBeNull();

		const long = cabinetFormSchema.safeParse({ ...CABINET, description: 'x'.repeat(501) });
		expect(long.success).toBe(false);
		if (!long.success) {
			expect(fieldErrorsFrom(long.error).description).toBe(
				'Keep the description to 500 characters or fewer.'
			);
		}
	});

	it('rejects an unknown family or construction method', () => {
		expect(cabinetFormSchema.safeParse({ ...CABINET, family: 'island' }).success).toBe(false);
		expect(cabinetFormSchema.safeParse({ ...CABINET, constructionMethod: 'glue' }).success).toBe(
			false
		);
	});
});

describe('parameterSchema', () => {
	it('accepts numeric bounds in order with a default inside them', () => {
		const parsed = parameterSchema.parse(PARAMETER);
		expect(parsed).toMatchObject({
			paramName: 'width',
			unit: 'mm',
			minValue: 300,
			maxValue: 1200,
			defaultValue: 600,
			required: true,
			sortOrder: 0
		});
	});

	it('rejects a parameter name that is not lower snake_case', () => {
		for (const paramName of ['Width', 'door-width', 'door width', '1width', 'doorWidth']) {
			const parsed = parameterSchema.safeParse({ ...PARAMETER, paramName });
			expect(parsed.success).toBe(false);
			if (!parsed.success) {
				expect(fieldErrorsFrom(parsed.error).paramName).toBe(
					'Use lower snake_case, starting with a letter (for example, door_width).'
				);
			}
		}
	});

	it('rejects a minimum above the maximum', () => {
		const parsed = parameterSchema.safeParse({ ...PARAMETER, minValue: 900, maxValue: 600 });
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			expect(fieldErrorsFrom(parsed.error).minValue).toBe(
				'Enter a minimum no greater than the maximum.'
			);
		}
	});

	it('rejects a default outside the numeric bounds', () => {
		const below = parameterSchema.safeParse({ ...PARAMETER, defaultValue: 200 });
		expect(below.success).toBe(false);
		if (!below.success) {
			expect(fieldErrorsFrom(below.error).defaultValue).toBe(
				'Enter a default no lower than the minimum.'
			);
		}

		const above = parameterSchema.safeParse({ ...PARAMETER, defaultValue: 1500 });
		expect(above.success).toBe(false);
		if (!above.success) {
			expect(fieldErrorsFrom(above.error).defaultValue).toBe(
				'Enter a default no higher than the maximum.'
			);
		}
	});

	it('requires a numeric default for mm and count parameters', () => {
		const parsed = parameterSchema.safeParse({ ...PARAMETER, defaultValue: null });
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			expect(fieldErrorsFrom(parsed.error).defaultValue).toBe(
				'Enter a default number for this parameter.'
			);
		}
	});

	it('rejects numeric bounds on enum, bool and text parameters', () => {
		const parsed = parameterSchema.safeParse({
			paramName: 'door_style',
			unit: 'enum',
			minValue: 1,
			maxValue: 3,
			defaultValue: 'flat',
			allowedValues: ['flat', 'shaker']
		});
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			expect(fieldErrorsFrom(parsed.error).minValue).toBe(
				'Only mm and count parameters use a minimum and maximum.'
			);
		}
	});

	it('requires at least two unique allowed values and a default among them', () => {
		const oneValue = parameterSchema.safeParse({
			paramName: 'door_style',
			unit: 'enum',
			defaultValue: 'flat',
			allowedValues: ['flat']
		});
		expect(oneValue.success).toBe(false);
		if (!oneValue.success) {
			expect(fieldErrorsFrom(oneValue.error).allowedValues).toBe(
				'Add at least two allowed values.'
			);
		}

		const duplicate = parameterSchema.safeParse({
			paramName: 'door_style',
			unit: 'enum',
			defaultValue: 'flat',
			allowedValues: ['flat', 'flat', 'shaker']
		});
		expect(duplicate.success).toBe(false);
		if (!duplicate.success) {
			expect(fieldErrorsFrom(duplicate.error).allowedValues).toBe('Allowed values must be unique.');
		}

		const outside = parameterSchema.safeParse({
			paramName: 'door_style',
			unit: 'enum',
			defaultValue: 'beaded',
			allowedValues: ['flat', 'shaker']
		});
		expect(outside.success).toBe(false);
		if (!outside.success) {
			expect(fieldErrorsFrom(outside.error).defaultValue).toBe(
				'Choose a default from the allowed values.'
			);
		}
	});

	it('accepts boolean and text defaults, including null', () => {
		expect(
			parameterSchema.parse({
				paramName: 'soft_close',
				unit: 'bool',
				defaultValue: true
			})
		).toMatchObject({ defaultValue: true, minValue: null, allowedValues: null });

		expect(
			parameterSchema.parse({
				paramName: 'finish_note',
				unit: 'text',
				defaultValue: 'Sprayed satin'
			})
		).toMatchObject({ defaultValue: 'Sprayed satin' });

		expect(
			parameterSchema.parse({
				paramName: 'carcass_note',
				unit: 'text',
				defaultValue: null
			})
		).toMatchObject({ defaultValue: null });
	});

	it('rejects a non-boolean bool default and a non-text text default', () => {
		expect(
			parameterSchema.safeParse({ paramName: 'soft_close', unit: 'bool', defaultValue: 'yes' })
				.success
		).toBe(false);
		expect(
			parameterSchema.safeParse({ paramName: 'finish_note', unit: 'text', defaultValue: 42 })
				.success
		).toBe(false);
	});

	it('rejects allowed values on non-enum parameters', () => {
		const parsed = parameterSchema.safeParse({
			...PARAMETER,
			allowedValues: ['a', 'b']
		});
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			expect(fieldErrorsFrom(parsed.error).allowedValues).toBe(
				'Only enum parameters use allowed values.'
			);
		}
	});

	it('rejects a negative or fractional sort order', () => {
		expect(parameterSchema.safeParse({ ...PARAMETER, sortOrder: -1 }).success).toBe(false);
		expect(parameterSchema.safeParse({ ...PARAMETER, sortOrder: 1.5 }).success).toBe(false);
	});
});

describe('ruleSchema', () => {
	it('accepts an object expression and a nullable condition', () => {
		const parsed = ruleSchema.parse({
			partType: '  carcass ',
			expr: { length: 'width - 18', qty: 1 }
		});
		expect(parsed).toMatchObject({
			partType: 'carcass',
			expr: { length: 'width - 18', qty: 1 },
			condition: null
		});
	});

	it('rejects an empty part type and a non-object expression', () => {
		expect(ruleSchema.safeParse({ partType: '  ', expr: {} }).success).toBe(false);
		expect(ruleSchema.safeParse({ partType: 'door', expr: [1, 2] }).success).toBe(false);
		expect(ruleSchema.safeParse({ partType: 'door', expr: 'width' }).success).toBe(false);
	});
});

describe('helpers', () => {
	it('normalises the parameter name and trims allowed values', () => {
		const normalised = normaliseParameterInput({
			paramName: ' door_style ',
			unit: 'enum',
			defaultValue: 'flat',
			allowedValues: [' flat ', ' shaker ']
		});
		expect(normalised.paramName).toBe('door_style');
		expect(normalised.allowedValues).toEqual(['flat', 'shaker']);

		const untouched = normaliseParameterInput({ paramName: 'width', unit: 'mm' });
		expect(untouched.allowedValues).toBeUndefined();
	});

	it('resolves the placement defaults from the parameter rows', () => {
		expect(
			resolveParameterDefaults([
				{ paramName: 'width', defaultValue: 600 },
				{ paramName: 'door_style', defaultValue: 'flat' },
				{ paramName: 'carcass_note', defaultValue: null }
			])
		).toEqual({ width: 600, door_style: 'flat', carcass_note: null });
	});

	it('maps the first message per field, with an optional prefix', () => {
		const parsed = parameterSchema.safeParse({
			paramName: 'Width',
			unit: 'mm',
			defaultValue: null
		});
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			const errors = fieldErrorsFrom(parsed.error, 'parameters.0');
			expect(errors['parameters.0.paramName']).toBeDefined();
			expect(errors['parameters.0.defaultValue']).toBeDefined();
		}
	});
});
