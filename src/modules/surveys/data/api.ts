import { apiCall } from '$network/api';
import { requirePermission } from '$network/guard';
import { PERMISSIONS } from '$shared/domain/permissions';
import {
	SURVEY_TRANSITIONS,
	type CreateMeasurementInput,
	type CreateNoteInput,
	type CreateObstacleInput,
	type CreateOpeningInput,
	type CreateRoomInput,
	type CreateSurveyInput,
	type CreateUtilityInput,
	type CreateWallInput,
	type ReviseNoteInput,
	type SurveyListParams,
	type TransitionSurveyInput,
	type UpdateMeasurementInput,
	type UpdateObstacleInput,
	type UpdateOpeningInput,
	type UpdateRoomInput,
	type UpdateSurveyInput,
	type UpdateUtilityInput,
	type UpdateWallInput,
	type VerifyMeasurementInput
} from '../domain/types';
import { getSurveysRepository } from './repository-provider';

const READ = { latencyMs: 180 } as const;
const WRITE = { latencyMs: 300 } as const;

/**
 * Survey facade (architecture §4.5). Permission comes from the canonical
 * matrix; the transaction action decides its own code so verify/reject/cancel
 * cannot borrow `survey.update`.
 */
export const surveysApi = {
	list(params: SurveyListParams = {}) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSurveysRepository().list(params);
		}, READ);
	},

	get(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSurveysRepository().get(id);
		}, READ);
	},

	create(projectId: string, input: CreateSurveyInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_CREATE);
			return getSurveysRepository().create(projectId, input);
		}, WRITE);
	},

	update(id: string, input: UpdateSurveyInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().update(id, input);
		}, WRITE);
	},

	transition(id: string, input: TransitionSurveyInput) {
		return apiCall(() => {
			requirePermission(SURVEY_TRANSITIONS[input.action].permission);
			return getSurveysRepository().transition(id, input);
		}, WRITE);
	},

	checklist(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSurveysRepository().checklist(id);
		}, READ);
	},

	progress(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSurveysRepository().progress(id);
		}, READ);
	},

	media(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSurveysRepository().media(id);
		}, READ);
	},

	audit(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSurveysRepository().audit(id);
		}, READ);
	},

	createRoom(surveyId: string, input: CreateRoomInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().createRoom(surveyId, input);
		}, WRITE);
	},

	updateRoom(id: string, input: UpdateRoomInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().updateRoom(id, input);
		}, WRITE);
	},

	archiveRoom(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().archiveRoom(id);
		}, WRITE);
	},

	createWall(surveyRoomId: string, input: CreateWallInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().createWall(surveyRoomId, input);
		}, WRITE);
	},

	updateWall(id: string, input: UpdateWallInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().updateWall(id, input);
		}, WRITE);
	},

	createOpening(surveyRoomId: string, input: CreateOpeningInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().createOpening(surveyRoomId, input);
		}, WRITE);
	},

	updateOpening(id: string, input: UpdateOpeningInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().updateOpening(id, input);
		}, WRITE);
	},

	createUtility(surveyRoomId: string, input: CreateUtilityInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().createUtility(surveyRoomId, input);
		}, WRITE);
	},

	updateUtility(id: string, input: UpdateUtilityInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().updateUtility(id, input);
		}, WRITE);
	},

	createObstacle(surveyRoomId: string, input: CreateObstacleInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().createObstacle(surveyRoomId, input);
		}, WRITE);
	},

	updateObstacle(id: string, input: UpdateObstacleInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().updateObstacle(id, input);
		}, WRITE);
	},

	createMeasurement(surveyId: string, input: CreateMeasurementInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().createMeasurement(surveyId, input);
		}, WRITE);
	},

	updateMeasurement(id: string, input: UpdateMeasurementInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().updateMeasurement(id, input);
		}, WRITE);
	},

	verifyMeasurement(id: string, input: VerifyMeasurementInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_APPROVE);
			return getSurveysRepository().verifyMeasurement(id, input);
		}, WRITE);
	},

	criticalMeasurements(surveyId: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getSurveysRepository().criticalMeasurements(surveyId);
		}, READ);
	},

	createNote(surveyId: string, input: CreateNoteInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().createNote(surveyId, input);
		}, WRITE);
	},

	reviseNote(noteId: string, input: ReviseNoteInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_UPDATE);
			return getSurveysRepository().reviseNote(noteId, input);
		}, WRITE);
	}
};
