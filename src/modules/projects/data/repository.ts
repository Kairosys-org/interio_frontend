import type { AuditTrailRow } from '$shared/domain/audit';
import type { DedupReviewInput } from '$shared/domain/dedup';
import type { Uuid } from '$shared/domain/uuid';
import type {
	AssignmentInput,
	AssignableSurveyor,
	CreateProjectInput,
	Project,
	ProjectAssignment,
	ProjectHub,
	ProjectListParams,
	ProjectPage,
	TransitionProjectInput,
	UpdateProjectInput
} from '../domain/types';

export interface ProjectsRepository {
	list(params: ProjectListParams): Promise<ProjectPage>;
	/** The project hub payload (`/projects/:id/summary`). */
	get(id: Uuid): Promise<ProjectHub>;
	create(input: CreateProjectInput): Promise<Project>;
	update(id: Uuid, input: UpdateProjectInput): Promise<Project>;
	transition(id: Uuid, input: TransitionProjectInput): Promise<Project>;
	archive(id: Uuid): Promise<Project>;
	unarchive(id: Uuid): Promise<Project>;
	reviewDedup(id: Uuid, input: DedupReviewInput): Promise<Project>;
	audit(id: Uuid): Promise<AuditTrailRow[]>;
	assignments(projectId: Uuid): Promise<ProjectAssignment[]>;
	assignableSurveyors(projectId: Uuid): Promise<AssignableSurveyor[]>;
	addAssignment(projectId: Uuid, input: AssignmentInput): Promise<ProjectAssignment>;
	removeAssignment(projectId: Uuid, userId: Uuid): Promise<void>;
}
