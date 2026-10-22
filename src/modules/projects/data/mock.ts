import type { ZodError } from 'zod';
import { listTenantAudit, recordTenantAudit } from '$shared/data/audit';
import { COLLECTIONS } from '$shared/data/collections';
import { demoNow } from '$shared/data/demo-clock';
import { requireTenantSession } from '$shared/data/mock-session';
import type {
	AppUserRecord,
	CustomerRecord,
	ProjectRecord,
	ProjectUserRecord,
	PropertyRecord,
	TenantRecord
} from '$shared/data/records';
import type { AuditTrailRow } from '$shared/domain/audit';
import {
	DEDUP_ALREADY_REVIEWED,
	DEDUP_NOTE_REQUIRED,
	DEDUP_TARGET_INVALID,
	DEDUP_TARGET_NOT_FOUND,
	projectMatchReasons,
	type DedupCandidateRef,
	type DedupReviewInput
} from '$shared/domain/dedup';
import { toPage } from '$shared/domain/pagination';
import { PERMISSIONS } from '$shared/domain/permissions';
import type { ProjectStatus } from '$shared/domain/record-states';
import { ROLES } from '$shared/domain/roles';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, registerSeeder, updateCollection } from '$network/mock-backend';
import type {
	AssignableSurveyor,
	AssignmentInput,
	CreateProjectInput,
	Project,
	ProjectAssignment,
	ProjectCustomerRef,
	ProjectGate,
	ProjectHub,
	ProjectListParams,
	ProjectListRow,
	ProjectPage,
	ProjectPropertyRef,
	ProjectStage,
	ProjectSummaryCounts,
	TransitionProjectInput,
	UpdateProjectInput
} from '../domain/types';
import {
	assignmentFormSchema,
	canTransitionProject,
	fieldErrorsFrom,
	nextProjectStatuses,
	projectFormSchema,
	updateProjectSchema
} from '../domain/validations';
import { seedProjects } from './seed';

/** The mock backend behaves like the server: every call is authorised first. */
registerSeeder(seedProjects);

const SUBJECT_TYPE = 'project';
const PROJECT_NOT_FOUND_MESSAGE = 'Project not found.';
const HOLD_REASON_REQUIRED = 'Enter a reason before putting the project on hold.';
const CANCEL_REASON_REQUIRED = 'Enter a reason before cancelling the project.';
const MAX_REASON_LENGTH = 500;

/**
 * Storage records for dedup links. `ProjectRecord['state']` is declared as
 * `active | archived | pending_review`; a linked duplicate is closed as
 * `cancelled` (phase-1 §5.3). Widening that orchestrator-owned union is a
 * wiring need reported with this unit; until then the value is narrowed here
 * so the rest of the module stays type-safe.
 */
const CANCELLED_STATE = 'cancelled' as ProjectRecord['state'];

function isCancelledState(state: string): boolean {
	return state === 'cancelled';
}

function notFound(message = PROJECT_NOT_FOUND_MESSAGE): ApiError {
	return new ApiError({ code: ApiErrorCode.NOT_FOUND, status: 404, message });
}

function conflict(message: string, details?: unknown): ApiError {
	return new ApiError({ code: ApiErrorCode.CONFLICT, status: 409, message, details });
}

function validation(message: string, fieldErrors?: Record<string, string>): ApiError {
	return new ApiError({
		code: ApiErrorCode.VALIDATION,
		status: 400,
		message,
		fieldErrors
	});
}

function mapZodError(error: ZodError): ApiError {
	return validation('Check the highlighted fields and try again.', fieldErrorsFrom(error));
}

function nowIso(): string {
	return demoNow().toISOString();
}

function matches(value: string | null | undefined, needle: string): boolean {
	return typeof value === 'string' && value.toLowerCase().includes(needle);
}

function toProject(record: ProjectRecord): Project {
	return { ...record };
}

function findTenantProject(id: string, tenantId: string): ProjectRecord {
	const project = getCollection<ProjectRecord>(COLLECTIONS.projects).find(
		(row) => row.id === id && row.tenantId === tenantId
	);
	if (!project) throw notFound();
	return project;
}

function findTenantCustomer(id: string, tenantId: string): CustomerRecord | undefined {
	return getCollection<CustomerRecord>(COLLECTIONS.customers).find(
		(row) => row.id === id && row.tenantId === tenantId
	);
}

function findTenantProperty(id: string, tenantId: string): PropertyRecord | undefined {
	return getCollection<PropertyRecord>(COLLECTIONS.properties).find(
		(row) => row.id === id && row.tenantId === tenantId
	);
}

function tenantUsers(tenantId: string): AppUserRecord[] {
	return getCollection<AppUserRecord>(COLLECTIONS.appUsers).filter(
		(user) => user.tenantId === tenantId
	);
}

function isActiveSurveyor(
	user: AppUserRecord | undefined,
	tenantId: string
): user is AppUserRecord {
	return (
		user !== undefined &&
		user.tenantId === tenantId &&
		user.status === 'active' &&
		user.roles.includes(ROLES.SURVEYOR)
	);
}

function assignmentRows(projectId: string, tenantId: string): ProjectUserRecord[] {
	return getCollection<ProjectUserRecord>(COLLECTIONS.projectUsers).filter(
		(row) => row.projectId === projectId && row.tenantId === tenantId
	);
}

function toAssignment(row: ProjectUserRecord, users: readonly AppUserRecord[]): ProjectAssignment {
	const user = users.find((candidate) => candidate.id === row.userId);
	const assigner = row.assignedBy
		? users.find((candidate) => candidate.id === row.assignedBy)
		: undefined;
	return {
		id: row.id,
		projectId: row.projectId,
		userId: row.userId,
		userName: user?.displayName ?? 'Unknown user',
		userEmail: user?.email ?? '',
		assignedAt: row.assignedAt,
		assignedBy: row.assignedBy,
		assignedByName: assigner?.displayName ?? null
	};
}

function propertyAddress(property: PropertyRecord | undefined): string {
	if (!property) return 'Address unavailable';
	return [property.addressLine1, property.addressLine2, property.town, property.postcode]
		.filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
		.join(', ');
}

/* ------------------------------------------------------------------ */
/* Stage indicator (spec Part 11 §2.2 — the 15-stage pipeline).        */
/* ------------------------------------------------------------------ */

interface StageDefinition {
	id: string;
	label: string;
	gateId: string | null;
}

const STAGE_DEFINITIONS: readonly StageDefinition[] = [
	{ id: 'project_setup', label: 'Project setup', gateId: null },
	{ id: 'survey', label: 'Survey', gateId: 'G8' },
	{ id: 'design', label: 'Design', gateId: 'G1' },
	{ id: 'quote', label: 'Quote', gateId: 'G2' },
	{ id: 'approval', label: 'Customer approval', gateId: 'G3' },
	{ id: 'order', label: 'Order', gateId: 'G4' },
	{ id: 'engineering', label: 'Cabinet engineering', gateId: null },
	{ id: 'procurement', label: 'Procurement', gateId: null },
	{ id: 'validation', label: 'Production validation', gateId: 'G5' },
	{ id: 'export', label: 'Export', gateId: 'G6' },
	{ id: 'part_tracking', label: 'Part tracking', gateId: null },
	{ id: 'assembly', label: 'Assembly', gateId: null },
	{ id: 'installation', label: 'Installation', gateId: 'G7' },
	{ id: 'payment', label: 'Payment', gateId: null },
	{ id: 'aftercare', label: 'Aftercare', gateId: null }
];

/**
 * Phase 1 knows only the setup → survey handover; later phases replace the
 * future stages with real cross-module state without changing this contract.
 */
function buildStages(project: ProjectRecord, assignmentCount: number): ProjectStage[] {
	const completed = project.status === 'completed';
	const cancelled = project.status === 'cancelled';
	const live = project.status === 'active' && project.state === 'active';

	return STAGE_DEFINITIONS.map((definition): ProjectStage => {
		if (definition.id === 'project_setup') {
			return { ...definition, state: 'passed' };
		}
		if (definition.id === 'survey') {
			if (cancelled) return { ...definition, state: 'future' };
			if (completed) return { ...definition, state: 'passed' };
			if (live) {
				return { ...definition, state: assignmentCount > 0 ? 'current' : 'blocking' };
			}
			return { ...definition, state: 'blocking' };
		}
		return { ...definition, state: 'future' };
	});
}

/**
 * The hold reason lives in the append-only audit stream (there is no reason
 * column on `project`); resuming clears it because the latest hold event is
 * no longer the project's current state.
 */
function latestHoldReason(project: ProjectRecord): string | null {
	const events = listTenantAudit(project.tenantId, SUBJECT_TYPE, project.id);
	let latest: AuditTrailRow | null = null;
	for (const event of events) {
		if (event.action !== 'state_transition') continue;
		if (event.payload?.to !== 'on_hold') continue;
		if (latest === null || event.occurredAt >= latest.occurredAt) latest = event;
	}
	const reason = latest?.payload?.reason;
	return typeof reason === 'string' && reason.trim().length > 0 ? reason : null;
}

function buildGates(project: ProjectRecord, assignmentCount: number): ProjectGate[] {
	const gates: ProjectGate[] = [];
	const live = project.status === 'active' && project.state === 'active';

	if (live && assignmentCount === 0) {
		gates.push({
			id: 'assignment',
			title: 'Assign a surveyor',
			state: 'blocking',
			reasons: ['A project needs at least one surveyor before surveys can start.']
		});
	}

	if (project.status === 'on_hold') {
		const reason = latestHoldReason(project);
		gates.push({
			id: 'on_hold',
			title: 'Project on hold',
			state: 'warning',
			reasons: reason ? [reason] : []
		});
	}

	return gates;
}

const EMPTY_COUNTS: ProjectSummaryCounts = {
	surveys: 0,
	designs: 0,
	quotes: 0,
	orders: 0,
	job: false
};

/* ------------------------------------------------------------------ */
/* Reference numbers (display-only, never a key).                     */
/* ------------------------------------------------------------------ */

function nextReferenceNumber(projects: readonly ProjectRecord[], tenantId: string): string {
	let highest = 0;
	for (const project of projects) {
		if (project.tenantId !== tenantId) continue;
		const match = /(\d+)\s*$/.exec(project.reference.trim());
		if (match) highest = Math.max(highest, Number.parseInt(match[1], 10));
	}
	return String(highest + 1).padStart(4, '0');
}

function buildReference(
	tenant: TenantRecord | undefined,
	projects: readonly ProjectRecord[],
	tenantId: string
): string {
	const year = String(demoNow().getUTCFullYear());
	const number = nextReferenceNumber(projects, tenantId);
	const pattern = tenant?.referencePattern?.trim();
	if (!pattern) return `OIG-${year}-${number}`;

	let reference = pattern
		.replaceAll('{TENANT}', (tenant?.slug ?? 'OIG').toUpperCase())
		.replaceAll('{YYYY}', year)
		.replaceAll('{NNNN}', number);
	if (!pattern.includes('{NNNN}')) reference = `${reference}-${number}`;
	return reference;
}

/* ------------------------------------------------------------------ */
/* Deadlock / duplicate helpers.                                      */
/* ------------------------------------------------------------------ */

function candidateRefs(
	tenantId: string,
	candidate: { propertyId: string; projectType: string; caption: string }
): DedupCandidateRef[] {
	return getCollection<ProjectRecord>(COLLECTIONS.projects)
		.filter((project) => project.tenantId === tenantId && !isCancelledState(project.state))
		.map((project) => ({
			project,
			matchReasons: projectMatchReasons(candidate, {
				propertyId: project.propertyId,
				projectType: project.projectType,
				caption: project.caption
			})
		}))
		.filter(({ matchReasons }) => matchReasons.length > 0)
		.sort(
			(first, second) =>
				second.project.createdAt.localeCompare(first.project.createdAt) ||
				first.project.id.localeCompare(second.project.id)
		)
		.map(({ project, matchReasons }) => ({
			id: project.id,
			entityType: 'project' as const,
			caption: project.caption,
			createdAt: project.createdAt,
			matchReasons
		}));
}

function editableProject(id: string, tenantId: string): ProjectRecord {
	const project = findTenantProject(id, tenantId);
	if (project.state === 'pending_review') {
		throw conflict('This project is waiting for duplicate review. Resolve it before editing.');
	}
	if (project.state === 'archived') {
		throw conflict('Restore this project before editing it.');
	}
	if (isCancelledState(project.state)) {
		throw conflict('This project was linked as a duplicate and is closed.');
	}
	return project;
}

function formatNextStates(status: ProjectStatus): string {
	const next = nextProjectStatuses(status);
	if (next.length === 0) return 'none — this status is final';
	if (next.length === 1) return next[0];
	return `${next.slice(0, -1).join(', ')} or ${next[next.length - 1]}`;
}

/* ------------------------------------------------------------------ */
/* List + hub.                                                        */
/* ------------------------------------------------------------------ */

export async function mockListProjects(params: ProjectListParams = {}): Promise<ProjectPage> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.PROJECT_VIEW);

	const projects = getCollection<ProjectRecord>(COLLECTIONS.projects).filter(
		(project) => project.tenantId === tenantId
	);
	const customers = getCollection<CustomerRecord>(COLLECTIONS.customers).filter(
		(customer) => customer.tenantId === tenantId
	);
	const properties = getCollection<PropertyRecord>(COLLECTIONS.properties).filter(
		(property) => property.tenantId === tenantId
	);
	const users = tenantUsers(tenantId);
	const assignments = getCollection<ProjectUserRecord>(COLLECTIONS.projectUsers).filter(
		(row) => row.tenantId === tenantId
	);

	const search = params.search?.trim().toLowerCase() ?? '';
	const type = params.type ?? 'all';
	const status = params.status ?? 'all';
	const surveyorId = params.surveyorId ?? null;
	const mine = params.scope === 'mine';

	const assignmentsByProject = new Map<string, ProjectUserRecord[]>();
	for (const assignment of assignments) {
		const rows = assignmentsByProject.get(assignment.projectId) ?? [];
		rows.push(assignment);
		assignmentsByProject.set(assignment.projectId, rows);
	}

	const rows: ProjectListRow[] = projects
		.map((project) => {
			const customer = customers.find((row) => row.id === project.customerId);
			const property = properties.find((row) => row.id === project.propertyId);
			const projectAssignments = assignmentsByProject.get(project.id) ?? [];
			return {
				project,
				assignments: projectAssignments,
				row: {
					id: project.id,
					caption: project.caption,
					reference: project.reference,
					projectType: project.projectType,
					status: project.status,
					state: project.state,
					customerId: project.customerId,
					customerCaption: customer?.caption ?? 'Customer not found',
					propertyId: project.propertyId,
					propertyAddress: propertyAddress(property),
					surveyorNames: projectAssignments
						.map((assignment) => users.find((row) => row.id === assignment.userId)?.displayName)
						.filter((name): name is string => typeof name === 'string'),
					createdAt: project.createdAt
				} satisfies ProjectListRow
			};
		})
		.filter(({ project, assignments: projectAssignments, row }) => {
			if (type !== 'all' && project.projectType !== type) return false;
			if (status !== 'all' && project.status !== status) return false;
			if (surveyorId !== null && !projectAssignments.some((row2) => row2.userId === surveyorId)) {
				return false;
			}
			if (mine && !projectAssignments.some((row2) => row2.userId === user.id)) return false;
			if (search.length === 0) return true;
			return (
				matches(row.caption, search) ||
				matches(row.reference, search) ||
				matches(row.customerCaption, search) ||
				matches(row.propertyAddress, search)
			);
		})
		.map(({ row }) => row);

	const sort = params.sort ?? 'createdAt';
	const direction =
		params.sortDir === 'asc' ? 1 : params.sortDir === 'desc' ? -1 : sort === 'createdAt' ? -1 : 1;

	rows.sort((first, second) => {
		let comparison = 0;
		switch (sort) {
			case 'caption':
				comparison = first.caption.localeCompare(second.caption, 'en-GB');
				break;
			case 'reference':
				comparison = first.reference.localeCompare(second.reference, 'en-GB');
				break;
			case 'status':
				comparison = first.status.localeCompare(second.status, 'en-GB');
				break;
			case 'createdAt':
			default:
				comparison = first.createdAt.localeCompare(second.createdAt);
				break;
		}
		return comparison * direction || first.id.localeCompare(second.id);
	});

	return toPage(rows, { page: params.page, pageSize: params.pageSize });
}

export async function mockGetProject(id: string): Promise<ProjectHub> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROJECT_VIEW);
	const project = findTenantProject(id, tenantId);

	const users = tenantUsers(tenantId);
	const assignments = assignmentRows(project.id, tenantId)
		.slice()
		.sort(
			(first, second) =>
				first.assignedAt.localeCompare(second.assignedAt) || first.id.localeCompare(second.id)
		)
		.map((row) => toAssignment(row, users));

	const customerRecord = findTenantCustomer(project.customerId, tenantId);
	const propertyRecord = findTenantProperty(project.propertyId, tenantId);

	const customer: ProjectCustomerRef | null = customerRecord
		? {
				id: customerRecord.id,
				caption: customerRecord.caption,
				email: customerRecord.email,
				phone: customerRecord.phone
			}
		: null;

	const property: ProjectPropertyRef | null = propertyRecord
		? {
				id: propertyRecord.id,
				addressLine1: propertyRecord.addressLine1,
				addressLine2: propertyRecord.addressLine2,
				town: propertyRecord.town,
				postcode: propertyRecord.postcode,
				accessNotes: propertyRecord.accessNotes
			}
		: null;

	return {
		project: toProject(project),
		customer,
		property,
		assignments,
		stages: buildStages(project, assignments.length),
		gates: buildGates(project, assignments.length),
		counts: { ...EMPTY_COUNTS }
	};
}

/* ------------------------------------------------------------------ */
/* Writes.                                                            */
/* ------------------------------------------------------------------ */

export async function mockCreateProject(input: CreateProjectInput): Promise<Project> {
	const { tenantId, user } = requireTenantSession(PERMISSIONS.PROJECT_CREATE);

	const parsed = projectFormSchema.safeParse({
		caption: input.caption,
		projectType: input.projectType,
		customerId: input.customerId,
		propertyId: input.propertyId
	});
	if (!parsed.success) throw mapZodError(parsed.error);
	const values = parsed.data;

	const customer = findTenantCustomer(values.customerId, tenantId);
	if (!customer) {
		throw validation('Choose a customer in this workspace.', {
			customerId: 'Choose a customer in this workspace.'
		});
	}

	const property = findTenantProperty(values.propertyId, tenantId);
	if (!property) {
		throw validation('Choose a property in this workspace.', {
			propertyId: 'Choose a property in this workspace.'
		});
	}
	if (property.customerId !== customer.id) {
		throw validation('Choose a property that belongs to the selected customer.', {
			propertyId: 'Choose a property that belongs to the selected customer.'
		});
	}

	const users = tenantUsers(tenantId);
	const requestedSurveyors = [...new Set(input.surveyorIds ?? [])];
	for (const surveyorId of requestedSurveyors) {
		const surveyor = users.find((candidate) => candidate.id === surveyorId);
		if (!isActiveSurveyor(surveyor, tenantId)) {
			const message = `${surveyorId} is not an active user holding the Surveyor role in this workspace.`;
			throw validation(message, { surveyorIds: message });
		}
	}

	const projects = getCollection<ProjectRecord>(COLLECTIONS.projects);
	const tenant = getCollection<TenantRecord>(COLLECTIONS.tenants).find(
		(row) => row.id === tenantId
	);
	const now = nowIso();
	const record: ProjectRecord = {
		id: newUuid(),
		tenantId,
		customerId: customer.id,
		propertyId: property.id,
		caption: values.caption,
		reference: buildReference(tenant, projects, tenantId),
		projectType: values.projectType,
		status: 'active',
		state: 'active',
		dedupOfId: null,
		reviewNote: null,
		createdAt: now,
		updatedAt: now,
		createdBy: user.id,
		archivedAt: null
	};

	const candidates = candidateRefs(tenantId, {
		propertyId: record.propertyId,
		projectType: record.projectType,
		caption: record.caption
	});

	if (candidates.length > 0) {
		const held: ProjectRecord = {
			...record,
			state: 'pending_review',
			dedupOfId: candidates[0].id
		};
		updateCollection<ProjectRecord>(COLLECTIONS.projects, (rows) => [...rows, held]);
		recordTenantAudit({
			tenantId,
			action: 'create',
			subjectType: SUBJECT_TYPE,
			subjectId: held.id,
			payload: { held: true }
		});
		throw conflict('A similar project already exists. Review the match before creating another.', {
			entityType: 'project',
			heldId: held.id,
			candidates
		});
	}

	updateCollection<ProjectRecord>(COLLECTIONS.projects, (rows) => [...rows, record]);

	if (requestedSurveyors.length > 0) {
		const assignmentRecords: ProjectUserRecord[] = requestedSurveyors.map((surveyorId) => ({
			id: newUuid(),
			tenantId,
			projectId: record.id,
			userId: surveyorId,
			assignedAt: now,
			assignedBy: user.id
		}));
		updateCollection<ProjectUserRecord>(COLLECTIONS.projectUsers, (rows) => [
			...rows,
			...assignmentRecords
		]);
		for (const assignment of assignmentRecords) {
			recordTenantAudit({
				tenantId,
				action: 'assignment_add',
				subjectType: SUBJECT_TYPE,
				subjectId: record.id,
				payload: { userId: assignment.userId }
			});
		}
	}

	recordTenantAudit({
		tenantId,
		action: 'create',
		subjectType: SUBJECT_TYPE,
		subjectId: record.id,
		payload: { reference: record.reference, surveyorIds: requestedSurveyors }
	});

	return toProject(record);
}

export async function mockUpdateProject(id: string, input: UpdateProjectInput): Promise<Project> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROJECT_UPDATE);
	const project = editableProject(id, tenantId);

	const hasChanges = input.caption !== undefined || input.projectType !== undefined;
	if (!hasChanges) throw validation('Change the caption or project type before saving.');

	const parsed = updateProjectSchema.safeParse({
		caption: input.caption,
		projectType: input.projectType
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const fields: string[] = [];
	const updated: ProjectRecord = { ...project };
	if (parsed.data.caption !== undefined) {
		updated.caption = parsed.data.caption;
		fields.push('caption');
	}
	if (parsed.data.projectType !== undefined) {
		updated.projectType = parsed.data.projectType;
		fields.push('projectType');
	}
	updated.updatedAt = nowIso();

	updateCollection<ProjectRecord>(COLLECTIONS.projects, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
	recordTenantAudit({
		tenantId,
		action: 'update',
		subjectType: SUBJECT_TYPE,
		subjectId: updated.id,
		payload: { fields }
	});

	return toProject(updated);
}

export async function mockTransitionProject(
	id: string,
	input: TransitionProjectInput
): Promise<Project> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROJECT_UPDATE);
	const project = editableProject(id, tenantId);

	if (!canTransitionProject(project.status, input.status)) {
		throw conflict(
			`A project that is ${project.status.replace('_', ' ')} cannot move to ${String(
				input.status
			).replace('_', ' ')}. The legal next states are ${formatNextStates(project.status)}.`
		);
	}

	const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
	if (input.status === 'on_hold' || input.status === 'cancelled') {
		const message = input.status === 'on_hold' ? HOLD_REASON_REQUIRED : CANCEL_REASON_REQUIRED;
		if (reason.length === 0) throw validation(message, { reason: message });
		if (reason.length > MAX_REASON_LENGTH) {
			throw validation(`Keep the reason to ${MAX_REASON_LENGTH} characters or fewer.`, {
				reason: `Keep the reason to ${MAX_REASON_LENGTH} characters or fewer.`
			});
		}
	}

	const from = project.status;
	const updated: ProjectRecord = {
		...project,
		status: input.status,
		updatedAt: nowIso()
	};
	updateCollection<ProjectRecord>(COLLECTIONS.projects, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
	recordTenantAudit({
		tenantId,
		action: 'state_transition',
		subjectType: SUBJECT_TYPE,
		subjectId: updated.id,
		payload: { from, to: updated.status, reason: reason.length > 0 ? reason : null }
	});

	return toProject(updated);
}

export async function mockArchiveProject(id: string): Promise<Project> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROJECT_ARCHIVE);
	const project = findTenantProject(id, tenantId);

	if (project.state === 'pending_review') {
		throw conflict('This project is waiting for duplicate review and cannot be archived.');
	}
	if (project.state === 'archived') {
		throw conflict('This project is already archived.');
	}
	if (isCancelledState(project.state)) {
		throw conflict('This project was linked as a duplicate and is already closed.');
	}

	const now = nowIso();
	const updated: ProjectRecord = {
		...project,
		state: 'archived',
		archivedAt: now,
		updatedAt: now
	};
	updateCollection<ProjectRecord>(COLLECTIONS.projects, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
	recordTenantAudit({
		tenantId,
		action: 'archive',
		subjectType: SUBJECT_TYPE,
		subjectId: updated.id
	});

	return toProject(updated);
}

export async function mockUnarchiveProject(id: string): Promise<Project> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROJECT_ARCHIVE);
	const project = findTenantProject(id, tenantId);

	if (project.state !== 'archived') {
		throw conflict('This project is not archived.');
	}

	const updated: ProjectRecord = {
		...project,
		state: 'active',
		archivedAt: null,
		updatedAt: nowIso()
	};
	updateCollection<ProjectRecord>(COLLECTIONS.projects, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
	recordTenantAudit({
		tenantId,
		action: 'unarchive',
		subjectType: SUBJECT_TYPE,
		subjectId: updated.id
	});

	return toProject(updated);
}

export async function mockReviewProjectDedup(
	id: string,
	input: DedupReviewInput
): Promise<Project> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROJECT_UPDATE);
	const project = findTenantProject(id, tenantId);

	if (project.state !== 'pending_review') throw conflict(DEDUP_ALREADY_REVIEWED);

	if (input.decision !== 'link_to_existing' && input.decision !== 'confirm_distinct') {
		throw validation('Choose how to resolve this duplicate.');
	}

	const reviewNote = typeof input.reviewNote === 'string' ? input.reviewNote.trim() : '';

	let updated: ProjectRecord;
	if (input.decision === 'confirm_distinct') {
		if (reviewNote.length === 0) {
			throw validation(DEDUP_NOTE_REQUIRED, { reviewNote: DEDUP_NOTE_REQUIRED });
		}
		updated = {
			...project,
			state: 'active',
			reviewNote,
			updatedAt: nowIso()
		};
	} else {
		if (typeof input.targetId !== 'string' || input.targetId.length === 0) {
			throw validation(DEDUP_TARGET_INVALID, { targetId: DEDUP_TARGET_INVALID });
		}
		if (input.targetId === project.id) {
			throw validation(DEDUP_TARGET_INVALID, { targetId: DEDUP_TARGET_INVALID });
		}
		const target = getCollection<ProjectRecord>(COLLECTIONS.projects).find(
			(row) =>
				row.id === input.targetId &&
				row.tenantId === tenantId &&
				row.state !== 'pending_review' &&
				!isCancelledState(row.state)
		);
		if (!target) throw notFound(DEDUP_TARGET_NOT_FOUND);
		updated = {
			...project,
			state: CANCELLED_STATE,
			dedupOfId: target.id,
			reviewNote: reviewNote.length > 0 ? reviewNote : null,
			updatedAt: nowIso()
		};
	}

	updateCollection<ProjectRecord>(COLLECTIONS.projects, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);
	recordTenantAudit({
		tenantId,
		action: 'dedup_review',
		subjectType: SUBJECT_TYPE,
		subjectId: updated.id,
		payload: {
			decision: input.decision,
			targetId: input.decision === 'link_to_existing' ? updated.dedupOfId : null,
			reviewNote: updated.reviewNote
		}
	});

	return toProject(updated);
}

/* ------------------------------------------------------------------ */
/* Assignments (S1).                                                  */
/* ------------------------------------------------------------------ */

export async function mockListProjectAssignments(projectId: string): Promise<ProjectAssignment[]> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROJECT_VIEW);
	const project = findTenantProject(projectId, tenantId);
	const users = tenantUsers(tenantId);
	return assignmentRows(project.id, tenantId)
		.slice()
		.sort(
			(first, second) =>
				first.assignedAt.localeCompare(second.assignedAt) || first.id.localeCompare(second.id)
		)
		.map((row) => toAssignment(row, users));
}

export async function mockListAssignableSurveyors(
	projectId: string
): Promise<AssignableSurveyor[]> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROJECT_VIEW);
	const project = findTenantProject(projectId, tenantId);
	const assigned = new Set(assignmentRows(project.id, tenantId).map((row) => row.userId));

	return tenantUsers(tenantId)
		.filter((user) => isActiveSurveyor(user, tenantId))
		.sort(
			(first, second) =>
				first.displayName.localeCompare(second.displayName, 'en-GB') ||
				first.id.localeCompare(second.id)
		)
		.map((user) => ({
			id: user.id,
			displayName: user.displayName,
			email: user.email,
			assigned: assigned.has(user.id)
		}));
}

export async function mockAddProjectAssignment(
	projectId: string,
	input: AssignmentInput
): Promise<ProjectAssignment> {
	const { tenantId, user: actor } = requireTenantSession(PERMISSIONS.PROJECT_UPDATE);
	const project = findTenantProject(projectId, tenantId);

	const parsed = assignmentFormSchema.safeParse({ userId: input.userId });
	if (!parsed.success) throw mapZodError(parsed.error);

	const users = tenantUsers(tenantId);
	const target = users.find((candidate) => candidate.id === parsed.data.userId);
	if (!isActiveSurveyor(target, tenantId)) {
		const message = `${parsed.data.userId} is not an active user holding the Surveyor role in this workspace.`;
		throw validation(message, { userId: message });
	}

	const existing = assignmentRows(project.id, tenantId).find(
		(row) => row.userId === parsed.data.userId
	);
	if (existing) throw conflict('That surveyor is already assigned to this project.');

	const row: ProjectUserRecord = {
		id: newUuid(),
		tenantId,
		projectId: project.id,
		userId: parsed.data.userId,
		assignedAt: nowIso(),
		assignedBy: actor.id
	};
	updateCollection<ProjectUserRecord>(COLLECTIONS.projectUsers, (rows) => [...rows, row]);

	recordTenantAudit({
		tenantId,
		action: 'assignment_add',
		subjectType: SUBJECT_TYPE,
		subjectId: project.id,
		payload: { userId: row.userId }
	});

	return toAssignment(row, users);
}

export async function mockRemoveProjectAssignment(
	projectId: string,
	userId: string
): Promise<void> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROJECT_UPDATE);
	const project = findTenantProject(projectId, tenantId);

	const row = assignmentRows(project.id, tenantId).find(
		(assignment) => assignment.userId === userId
	);
	if (!row) throw notFound('That surveyor is not assigned to this project.');

	updateCollection<ProjectUserRecord>(COLLECTIONS.projectUsers, (rows) =>
		rows.filter((assignment) => assignment.id !== row.id)
	);
	recordTenantAudit({
		tenantId,
		action: 'assignment_remove',
		subjectType: SUBJECT_TYPE,
		subjectId: project.id,
		payload: {
			userId,
			note: 'Existing surveys are kept; new surveys are blocked for this surveyor.'
		}
	});
}

export async function mockListProjectAudit(id: string): Promise<AuditTrailRow[]> {
	const { tenantId } = requireTenantSession(PERMISSIONS.PROJECT_VIEW);
	const project = findTenantProject(id, tenantId);
	return listTenantAudit(tenantId, SUBJECT_TYPE, project.id);
}
