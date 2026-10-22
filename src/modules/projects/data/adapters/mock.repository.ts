import type { ProjectsRepository } from '../repository';
import {
	mockAddProjectAssignment,
	mockArchiveProject,
	mockCreateProject,
	mockGetProject,
	mockListAssignableSurveyors,
	mockListProjectAssignments,
	mockListProjectAudit,
	mockListProjects,
	mockRemoveProjectAssignment,
	mockReviewProjectDedup,
	mockTransitionProject,
	mockUnarchiveProject,
	mockUpdateProject
} from '../mock';

/** Thin, boring adapter: one line per repository method (architecture §4.7). */
export const mockProjectsRepository: ProjectsRepository = {
	list: async (params) => mockListProjects(params),
	get: async (id) => mockGetProject(id),
	create: async (input) => mockCreateProject(input),
	update: async (id, input) => mockUpdateProject(id, input),
	transition: async (id, input) => mockTransitionProject(id, input),
	archive: async (id) => mockArchiveProject(id),
	unarchive: async (id) => mockUnarchiveProject(id),
	reviewDedup: async (id, input) => mockReviewProjectDedup(id, input),
	audit: async (id) => mockListProjectAudit(id),
	assignments: async (projectId) => mockListProjectAssignments(projectId),
	assignableSurveyors: async (projectId) => mockListAssignableSurveyors(projectId),
	addAssignment: async (projectId, input) => mockAddProjectAssignment(projectId, input),
	removeAssignment: async (projectId, userId) => mockRemoveProjectAssignment(projectId, userId)
};
