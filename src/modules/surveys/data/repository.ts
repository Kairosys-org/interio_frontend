import type { AuditTrailRow } from '$shared/domain/audit';
import type { Uuid } from '$shared/domain/uuid';
import type {
	CreateMeasurementInput,
	CreateNoteInput,
	CreateObstacleInput,
	CreateOpeningInput,
	CreateRoomInput,
	CreateSurveyInput,
	CreateUtilityInput,
	CreateWallInput,
	ReviseNoteInput,
	Survey,
	SurveyChecklist,
	SurveyDetail,
	SurveyListParams,
	SurveyMeasurement,
	SurveyMediaItem,
	SurveyNote,
	SurveyObstacle,
	SurveyOpening,
	SurveyPage,
	SurveyProgressCounts,
	SurveyRoom,
	SurveyUtility,
	SurveyWall,
	TransitionSurveyInput,
	UpdateMeasurementInput,
	UpdateObstacleInput,
	UpdateOpeningInput,
	UpdateRoomInput,
	UpdateSurveyInput,
	UpdateUtilityInput,
	UpdateWallInput,
	VerifyMeasurementInput
} from '../domain/types';

/**
 * Survey repository contract (frozen in wave 0, architecture §4.4).
 *
 * The equality of rule enforcement lives in the mock today and in the API
 * adapter later: this interface is the only shape the facade and the UI code
 * against. Survey status only changes through `transition()` — children never
 * mutate status directly (Part 4 §2, Part 9 §13).
 *
 * Permission map applied by `data/api.ts`:
 * - reads → `survey.view`
 * - survey and child writes → `survey.update`
 * - `transition()` → `SURVEY_TRANSITIONS[action].permission` (+ role gate)
 * - `verifyMeasurement()` → `survey.approve`
 * Every transition, reopen and verification writes an audit event.
 */
export interface SurveysRepository {
	list(params: SurveyListParams): Promise<SurveyPage>;
	get(id: Uuid): Promise<SurveyDetail>;
	create(projectId: Uuid, input: CreateSurveyInput): Promise<Survey>;
	update(id: Uuid, input: UpdateSurveyInput): Promise<Survey>;
	/** Part 4 §2 machine; throws `gate_blocked` (G8 / checklist) or `state_conflict`. */
	transition(id: Uuid, input: TransitionSurveyInput): Promise<Survey>;
	checklist(id: Uuid): Promise<SurveyChecklist>;
	progress(id: Uuid): Promise<SurveyProgressCounts>;
	media(id: Uuid): Promise<SurveyMediaItem[]>;
	audit(id: Uuid): Promise<AuditTrailRow[]>;

	/* Rooms — archive is the only delete-shaped action, and only in `draft`. */
	createRoom(surveyId: Uuid, input: CreateRoomInput): Promise<SurveyRoom>;
	updateRoom(id: Uuid, input: UpdateRoomInput): Promise<SurveyRoom>;
	archiveRoom(id: Uuid): Promise<SurveyRoom>;

	/* Walls — labels are unique within a room (Part 9 §6). */
	createWall(surveyRoomId: Uuid, input: CreateWallInput): Promise<SurveyWall>;
	updateWall(id: Uuid, input: UpdateWallInput): Promise<SurveyWall>;

	/* Openings — an opening must fit its wall when one is linked (S4). */
	createOpening(surveyRoomId: Uuid, input: CreateOpeningInput): Promise<SurveyOpening>;
	updateOpening(id: Uuid, input: UpdateOpeningInput): Promise<SurveyOpening>;

	createUtility(surveyRoomId: Uuid, input: CreateUtilityInput): Promise<SurveyUtility>;
	updateUtility(id: Uuid, input: UpdateUtilityInput): Promise<SurveyUtility>;

	createObstacle(surveyRoomId: Uuid, input: CreateObstacleInput): Promise<SurveyObstacle>;
	updateObstacle(id: Uuid, input: UpdateObstacleInput): Promise<SurveyObstacle>;

	/* Measurements — provenance required; verify is the G8 input (S8/S9). */
	createMeasurement(surveyId: Uuid, input: CreateMeasurementInput): Promise<SurveyMeasurement>;
	/**
	 * Editing `valueMm` clears verification (server rule, Part 4 §2). While the
	 * survey is `verified`, any measurement write is refused until an audited
	 * reopen.
	 */
	updateMeasurement(id: Uuid, input: UpdateMeasurementInput): Promise<SurveyMeasurement>;
	verifyMeasurement(id: Uuid, input: VerifyMeasurementInput): Promise<SurveyMeasurement>;
	criticalMeasurements(surveyId: Uuid): Promise<SurveyMeasurement[]>;

	/* Notes — append-only revisions; a post-submit edit creates a new row (S6). */
	createNote(surveyId: Uuid, input: CreateNoteInput): Promise<SurveyNote>;
	reviseNote(noteId: Uuid, input: ReviseNoteInput): Promise<SurveyNote>;
}
