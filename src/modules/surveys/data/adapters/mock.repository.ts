import type { SurveysRepository } from '../repository';
import {
	mockArchiveRoom,
	mockCreateMeasurement,
	mockCreateNote,
	mockCreateObstacle,
	mockCreateOpening,
	mockCreateRoom,
	mockCreateSurvey,
	mockCreateUtility,
	mockCreateWall,
	mockCriticalMeasurements,
	mockGetSurvey,
	mockListSurveys,
	mockReviseNote,
	mockSurveyAudit,
	mockSurveyChecklist,
	mockSurveyMedia,
	mockSurveyProgress,
	mockTransitionSurvey,
	mockUpdateMeasurement,
	mockUpdateObstacle,
	mockUpdateOpening,
	mockUpdateRoom,
	mockUpdateSurvey,
	mockUpdateUtility,
	mockUpdateWall,
	mockVerifyMeasurement
} from '../mock';

/** Thin, boring adapter: one line per repository method (architecture §4.7). */
export const mockSurveysRepository: SurveysRepository = {
	list: async (params) => mockListSurveys(params),
	get: async (id) => mockGetSurvey(id),
	create: async (projectId, input) => mockCreateSurvey(projectId, input),
	update: async (id, input) => mockUpdateSurvey(id, input),
	transition: async (id, input) => mockTransitionSurvey(id, input),
	checklist: async (id) => mockSurveyChecklist(id),
	progress: async (id) => mockSurveyProgress(id),
	media: async (id) => mockSurveyMedia(id),
	audit: async (id) => mockSurveyAudit(id),

	createRoom: async (surveyId, input) => mockCreateRoom(surveyId, input),
	updateRoom: async (id, input) => mockUpdateRoom(id, input),
	archiveRoom: async (id) => mockArchiveRoom(id),

	createWall: async (surveyRoomId, input) => mockCreateWall(surveyRoomId, input),
	updateWall: async (id, input) => mockUpdateWall(id, input),

	createOpening: async (surveyRoomId, input) => mockCreateOpening(surveyRoomId, input),
	updateOpening: async (id, input) => mockUpdateOpening(id, input),

	createUtility: async (surveyRoomId, input) => mockCreateUtility(surveyRoomId, input),
	updateUtility: async (id, input) => mockUpdateUtility(id, input),

	createObstacle: async (surveyRoomId, input) => mockCreateObstacle(surveyRoomId, input),
	updateObstacle: async (id, input) => mockUpdateObstacle(id, input),

	createMeasurement: async (surveyId, input) => mockCreateMeasurement(surveyId, input),
	updateMeasurement: async (id, input) => mockUpdateMeasurement(id, input),
	verifyMeasurement: async (id, input) => mockVerifyMeasurement(id, input),
	criticalMeasurements: async (surveyId) => mockCriticalMeasurements(surveyId),

	createNote: async (surveyId, input) => mockCreateNote(surveyId, input),
	reviseNote: async (noteId, input) => mockReviseNote(noteId, input)
};
