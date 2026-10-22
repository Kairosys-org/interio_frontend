import { apiCall } from '$network/api';
import { requirePermission } from '$network/guard';
import type { DedupReviewInput } from '$shared/domain/dedup';
import { PERMISSIONS } from '$shared/domain/permissions';
import type {
	AssignmentInput,
	CreateProjectInput,
	ProjectListParams,
	TransitionProjectInput,
	UpdateProjectInput
} from '../domain/types';
import { getProjectsRepository } from './repository-provider';

const READ = { latencyMs: 200 } as const;
const WRITE = { latencyMs: 320 } as const;

export const projectsApi = {
	list(params: ProjectListParams = {}) {
		return apiCall(() => getProjectsRepository().list(params), READ);
	},

	get(id: string) {
		return apiCall(() => getProjectsRepository().get(id), READ);
	},

	create(input: CreateProjectInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROJECT_CREATE);
			return getProjectsRepository().create(input);
		}, WRITE);
	},

	update(id: string, input: UpdateProjectInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROJECT_UPDATE);
			return getProjectsRepository().update(id, input);
		}, WRITE);
	},

	transition(id: string, input: TransitionProjectInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROJECT_UPDATE);
			return getProjectsRepository().transition(id, input);
		}, WRITE);
	},

	archive(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROJECT_ARCHIVE);
			return getProjectsRepository().archive(id);
		}, WRITE);
	},

	unarchive(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROJECT_ARCHIVE);
			return getProjectsRepository().unarchive(id);
		}, WRITE);
	},

	reviewDedup(id: string, input: DedupReviewInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROJECT_UPDATE);
			return getProjectsRepository().reviewDedup(id, input);
		}, WRITE);
	},

	audit(id: string) {
		return apiCall(() => getProjectsRepository().audit(id), READ);
	},

	assignments(projectId: string) {
		return apiCall(() => getProjectsRepository().assignments(projectId), READ);
	},

	assignableSurveyors(projectId: string) {
		return apiCall(() => getProjectsRepository().assignableSurveyors(projectId), READ);
	},

	addAssignment(projectId: string, input: AssignmentInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROJECT_UPDATE);
			return getProjectsRepository().addAssignment(projectId, input);
		}, WRITE);
	},

	removeAssignment(projectId: string, userId: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.PROJECT_UPDATE);
			return getProjectsRepository().removeAssignment(projectId, userId);
		}, WRITE);
	}
};
