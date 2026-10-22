import { z } from 'zod';
import {
	PROJECT_STATUSES,
	PROJECT_TYPES,
	type ProjectStatus,
	type ProjectType
} from '$shared/domain/record-states';

/**
 * Project forms and status rules.
 *
 * These schemas are the client-side gate only; the mock repository validates
 * the same input again because it behaves like the server (R4, architecture
 * §4.6). Messages are user-readable sentences (DESIGN §12.5).
 */

const caption = z
	.string()
	.trim()
	.min(1, 'Enter a project caption.')
	.max(200, 'Keep the caption to 200 characters or fewer.');

const uuidField = (message: string) => z.string().uuid(message);

export const projectFormSchema = z.object({
	caption,
	projectType: z.enum(PROJECT_TYPES),
	customerId: uuidField('Choose a customer.'),
	propertyId: uuidField('Choose a property.')
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

/** `PATCH /projects/:id` accepts only the identity fields the spec allows. */
export const updateProjectSchema = z.object({
	caption: caption.optional(),
	projectType: z.enum(PROJECT_TYPES).optional()
});

export type UpdateProjectFormValues = z.infer<typeof updateProjectSchema>;

export const assignmentFormSchema = z.object({
	userId: uuidField('Choose a surveyor.')
});

export type AssignmentFormValues = z.infer<typeof assignmentFormSchema>;

/**
 * New-project wizard: the four decisions before review (ui-ux §8.7). The
 * repository also accepts a project with no surveyor — the hub then shows the
 * assignment gate — but the wizard itself insists on at least one.
 */
export const newProjectWizardSchema = projectFormSchema.extend({
	surveyorIds: z
		.array(uuidField('Choose a surveyor.'))
		.min(1, 'Assign at least one surveyor.')
		.refine((ids) => new Set(ids).size === ids.length, {
			message: 'Each surveyor can only be assigned once.'
		})
});

export type NewProjectWizardValues = z.infer<typeof newProjectWizardSchema>;

/** First message per field, keyed by the schema path. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.') || 'form';
		if (!(key in errors)) errors[key] = issue.message;
	}
	return errors;
}

/**
 * Allowed project status changes (Part 4 §1 lists the values but does not
 * publish a diagram; the whitelist below is the one reported to the
 * orchestrator as a spec gap). Completed and cancelled are terminal.
 */
const PROJECT_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
	active: ['on_hold', 'completed', 'cancelled'],
	on_hold: ['active', 'cancelled'],
	completed: [],
	cancelled: []
};

export function nextProjectStatuses(from: ProjectStatus): readonly ProjectStatus[] {
	return PROJECT_TRANSITIONS[from];
}

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
	return PROJECT_TRANSITIONS[from].includes(to);
}

/** Re-exported for the mock, which mirrors the state vocabulary. */
export const PROJECT_STATUS_VALUES = PROJECT_STATUSES;
export type { ProjectStatus, ProjectType };
