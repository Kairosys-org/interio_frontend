import type { DedupCandidateRef, DedupReviewInput } from '$shared/domain/dedup';
import type { Page } from '$shared/domain/pagination';
import type { ProjectStatus, ProjectType } from '$shared/domain/record-states';
import type { Uuid } from '$shared/domain/uuid';

export type { ProjectStatus, ProjectType, DedupCandidateRef, DedupReviewInput };

export interface Project {
	id: Uuid;
	tenantId: Uuid;
	customerId: Uuid;
	propertyId: Uuid;
	caption: string;
	/** Display-only reference from tenant settings; never used as a key. */
	reference: string;
	projectType: ProjectType;
	status: ProjectStatus;
	state: 'active' | 'archived' | 'pending_review' | 'cancelled';
	dedupOfId: Uuid | null;
	reviewNote: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: Uuid | null;
	archivedAt: string | null;
}

export type ProjectSort = 'caption' | 'createdAt' | 'updatedAt' | 'status' | 'reference';

export interface ProjectListParams {
	search?: string;
	type?: ProjectType | 'all';
	status?: ProjectStatus | 'all';
	surveyorId?: Uuid | null;
	/** `mine` is reserved for the Surveyor scoped list (Part 10 §5). */
	scope?: 'all' | 'mine';
	sort?: ProjectSort;
	sortDir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

export interface ProjectListRow {
	id: Uuid;
	caption: string;
	reference: string;
	projectType: ProjectType;
	status: ProjectStatus;
	state: 'active' | 'archived' | 'pending_review' | 'cancelled';
	customerId: Uuid;
	customerCaption: string;
	propertyId: Uuid;
	propertyAddress: string;
	surveyorNames: string[];
	createdAt: string;
}

export interface ProjectAssignment {
	id: Uuid;
	projectId: Uuid;
	userId: Uuid;
	userName: string;
	userEmail: string;
	assignedAt: string;
	assignedBy: Uuid | null;
	assignedByName: string | null;
}

export interface AssignableSurveyor {
	id: Uuid;
	displayName: string;
	email: string;
	assigned: boolean;
}

export interface ProjectCustomerRef {
	id: Uuid;
	caption: string;
	email: string | null;
	phone: string | null;
}

export interface ProjectPropertyRef {
	id: Uuid;
	addressLine1: string;
	addressLine2: string | null;
	town: string | null;
	postcode: string | null;
	accessNotes: string | null;
}

export interface ProjectSummaryCounts {
	surveys: number;
	designs: number;
	quotes: number;
	orders: number;
	job: boolean;
}

export type ProjectStageState = 'passed' | 'current' | 'future' | 'blocking' | 'warning';

export interface ProjectStage {
	id: string;
	label: string;
	gateId: string | null;
	state: ProjectStageState;
}

export type ProjectGateState = 'passed' | 'blocking' | 'warning';

export interface ProjectGate {
	id: string;
	title: string;
	state: ProjectGateState;
	reasons: string[];
}

export interface ProjectHub {
	project: Project;
	customer: ProjectCustomerRef | null;
	property: ProjectPropertyRef | null;
	assignments: ProjectAssignment[];
	stages: ProjectStage[];
	gates: ProjectGate[];
	counts: ProjectSummaryCounts;
}

export interface CreateProjectInput {
	customerId: Uuid;
	propertyId: Uuid;
	caption: string;
	projectType: ProjectType;
	/** Wizard step 4; each id must belong to a user holding the Surveyor role. */
	surveyorIds: Uuid[];
}

export interface UpdateProjectInput {
	caption?: string;
	projectType?: ProjectType;
}

export interface TransitionProjectInput {
	status: ProjectStatus;
	reason?: string | null;
}

export interface AssignmentInput {
	userId: Uuid;
}

export type ProjectPage = Page<ProjectListRow>;

export interface ProjectDedupConflict {
	entityType: 'project';
	heldId: Uuid;
	candidates: DedupCandidateRef[];
}
