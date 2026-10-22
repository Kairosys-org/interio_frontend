import { describe, expect, it } from 'vitest';
import {
	assignmentFormSchema,
	canTransitionProject,
	fieldErrorsFrom,
	newProjectWizardSchema,
	nextProjectStatuses,
	projectFormSchema
} from './validations';

const CUSTOMER_ID = '3f1c7a52-6d4b-4f4e-9a1e-1c2d3e4f5a6b';
const PROPERTY_ID = '8a2d6b41-5c3e-4d7f-8b9a-2e3f4a5b6c7d';
const SURVEYOR_ID = 'b7e4c2a1-9d8f-4a6b-8c5d-3e2f1a0b9c8d';
const OTHER_SURVEYOR_ID = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';

describe('projectFormSchema', () => {
	it('accepts a complete project form and trims the caption', () => {
		const parsed = projectFormSchema.parse({
			caption: '  Kitchen renovation  ',
			projectType: 'kitchen',
			customerId: CUSTOMER_ID,
			propertyId: PROPERTY_ID
		});

		expect(parsed.caption).toBe('Kitchen renovation');
		expect(parsed.projectType).toBe('kitchen');
	});

	it('requires a caption of 1–200 characters', () => {
		const empty = projectFormSchema.safeParse({
			caption: '   ',
			projectType: 'kitchen',
			customerId: CUSTOMER_ID,
			propertyId: PROPERTY_ID
		});
		expect(empty.success).toBe(false);
		if (!empty.success) {
			expect(fieldErrorsFrom(empty.error)).toMatchObject({
				caption: 'Enter a project caption.'
			});
		}

		const tooLong = projectFormSchema.safeParse({
			caption: 'x'.repeat(201),
			projectType: 'kitchen',
			customerId: CUSTOMER_ID,
			propertyId: PROPERTY_ID
		});
		expect(tooLong.success).toBe(false);
		if (!tooLong.success) {
			expect(fieldErrorsFrom(tooLong.error).caption).toBe(
				'Keep the caption to 200 characters or fewer.'
			);
		}
	});

	it('rejects an unknown project type and non-UUID links', () => {
		const result = projectFormSchema.safeParse({
			caption: 'Kitchen',
			projectType: 'garage',
			customerId: 'customer-1',
			propertyId: 'not-a-uuid'
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			const errors = fieldErrorsFrom(result.error);
			expect(errors.projectType).toBeTruthy();
			expect(errors.customerId).toBe('Choose a customer.');
			expect(errors.propertyId).toBe('Choose a property.');
		}
	});
});

describe('assignmentFormSchema', () => {
	it('accepts a UUID user and rejects anything else', () => {
		expect(assignmentFormSchema.parse({ userId: SURVEYOR_ID })).toEqual({ userId: SURVEYOR_ID });

		const invalid = assignmentFormSchema.safeParse({ userId: 'surveyor' });
		expect(invalid.success).toBe(false);
		if (!invalid.success) {
			expect(fieldErrorsFrom(invalid.error)).toEqual({ userId: 'Choose a surveyor.' });
		}
	});
});

describe('newProjectWizardSchema', () => {
	const values = {
		caption: 'Kitchen renovation',
		projectType: 'kitchen',
		customerId: CUSTOMER_ID,
		propertyId: PROPERTY_ID
	};

	it('requires at least one surveyor', () => {
		const result = newProjectWizardSchema.safeParse({ ...values, surveyorIds: [] });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrorsFrom(result.error).surveyorIds).toBe('Assign at least one surveyor.');
		}
	});

	it('rejects the same surveyor twice', () => {
		const result = newProjectWizardSchema.safeParse({
			...values,
			surveyorIds: [SURVEYOR_ID, SURVEYOR_ID]
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrorsFrom(result.error).surveyorIds).toBe(
				'Each surveyor can only be assigned once.'
			);
		}
	});

	it('accepts one or more distinct surveyors', () => {
		const parsed = newProjectWizardSchema.parse({
			...values,
			surveyorIds: [SURVEYOR_ID, OTHER_SURVEYOR_ID]
		});
		expect(parsed.surveyorIds).toEqual([SURVEYOR_ID, OTHER_SURVEYOR_ID]);
	});
});

describe('project status transitions', () => {
	it('allows only the documented active and on-hold moves', () => {
		expect(canTransitionProject('active', 'on_hold')).toBe(true);
		expect(canTransitionProject('active', 'completed')).toBe(true);
		expect(canTransitionProject('active', 'cancelled')).toBe(true);
		expect(canTransitionProject('on_hold', 'active')).toBe(true);
		expect(canTransitionProject('on_hold', 'cancelled')).toBe(true);

		expect(canTransitionProject('active', 'active')).toBe(false);
		expect(canTransitionProject('on_hold', 'completed')).toBe(false);
		expect(canTransitionProject('completed', 'on_hold')).toBe(false);
		expect(canTransitionProject('cancelled', 'active')).toBe(false);
	});

	it('treats completed and cancelled as terminal', () => {
		expect(nextProjectStatuses('completed')).toEqual([]);
		expect(nextProjectStatuses('cancelled')).toEqual([]);
		expect(nextProjectStatuses('active')).toEqual(['on_hold', 'completed', 'cancelled']);
	});
});
