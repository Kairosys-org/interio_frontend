import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import {
	DEMO_PROJECT_ASSIGNMENT_PLAN,
	DEMO_PROJECT_PLAN,
	demoCustomerId,
	demoProjectId,
	demoPropertyId,
	demoSurveyorId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS } from '$shared/data/demo-seed';
import type { ProjectRecord, ProjectUserRecord } from '$shared/data/records';
import type { ProjectStatus, ProjectType } from '$shared/domain/record-states';
import { deterministicUuid } from '$shared/lib/deterministic';

/**
 * Projects-module seed: `projects` and `project_users` only.
 *
 * Customers and properties are seeded by their own modules from the same
 * `DEMO_PROJECT_PLAN`, so the foreign keys never drift. Dates come from the
 * shared demo clock and every id is name-based, which keeps two consecutive
 * `resetMockDb()` runs byte-identical (architecture §4.9, phase-1 §5.2).
 */

const OPULENT_TENANT_ID = DEMO_TENANTS[0].id;
/** The Sales user who won every demo enquiry (auth seed, role key `sales`). */
const SALES_USER_ID = deterministicUuid('user:opulent:sales');

function projectRecord(n: number): ProjectRecord {
	const plan = DEMO_PROJECT_PLAN[n - 1];
	return {
		id: demoProjectId(plan.n),
		tenantId: OPULENT_TENANT_ID,
		customerId: demoCustomerId(plan.customerN),
		propertyId: demoPropertyId(plan.propertyN),
		caption: plan.caption,
		reference: plan.reference,
		projectType: plan.projectType as ProjectType,
		status: plan.status as ProjectStatus,
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		// Oldest first in the plan, so a newest-first list reads 1 … 18.
		createdAt: demoDays(8 * plan.n),
		updatedAt: demoDays(2),
		createdBy: SALES_USER_ID,
		archivedAt: null
	};
}

function assignmentRecord(projectN: number, surveyorKey: string): ProjectUserRecord {
	return {
		id: deterministicUuid(`project-user:${projectN}:${surveyorKey}`),
		tenantId: OPULENT_TENANT_ID,
		projectId: demoProjectId(projectN),
		userId: demoSurveyorId(surveyorKey),
		assignedAt: demoDays(8 * projectN - 1),
		assignedBy: SALES_USER_ID
	};
}

export function seedProjects(): Record<string, unknown[]> {
	const projects: ProjectRecord[] = DEMO_PROJECT_PLAN.map((plan) => projectRecord(plan.n));
	const assignments: ProjectUserRecord[] = DEMO_PROJECT_ASSIGNMENT_PLAN.map((assignment) =>
		assignmentRecord(assignment.projectN, assignment.surveyorKey)
	);

	return {
		[COLLECTIONS.projects]: projects,
		[COLLECTIONS.projectUsers]: assignments
	};
}
