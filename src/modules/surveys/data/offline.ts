import { isOnline } from '$shared/application/connectivity.svelte';
import type { Uuid } from '$shared/domain/uuid';
import { enqueueOutbox } from '$modules/sync/data/outbox';
import type { SyncEntity, SyncOp } from '$modules/sync/domain/types';
import { surveyActionTarget, surveyRowPayload, surveyRowUpdatedAt } from './mock';
import type { SurveysRepository } from './repository';

/**
 * UI-level offline seam (phase-2 §4.1 note, Part 9 §13).
 *
 * Writes are always applied locally first. When the browser reports offline,
 * the provider also records the same change in the durable outbox so the
 * mobile shell can drain it later. This is deliberately not a second storage
 * layer: it reuses the mock DB and the orchestrator-owned outbox, and the
 * presentation never learns that any of this exists.
 *
 * The op payload is the final field values of the write so replay converges,
 * and `baseUpdatedAt` is the row version read *before* the write — the sync
 * push compares it with the server row (server wins on a moved version).
 */

export function isOffline(): boolean {
	return !isOnline();
}

function enqueue(
	entity: SyncEntity,
	op: SyncOp,
	localId: Uuid,
	payload: Record<string, unknown> | null,
	baseUpdatedAt: string | null = null
): void {
	if (!isOffline()) return;
	enqueueOutbox({
		entity,
		op,
		localId,
		payload: payload ?? {},
		baseUpdatedAt
	});
}

function finalRow(entity: SyncEntity, id: Uuid): Record<string, unknown> {
	return surveyRowPayload(entity, id) ?? { id };
}

/**
 * Wraps the survey repository so every successful write is mirrored into the
 * outbox while offline. Reads pass straight through: the local rows are the
 * offline read model.
 */
export function withOfflineOutbox(repository: SurveysRepository): SurveysRepository {
	return {
		...repository,

		create: async (projectId, input) => {
			const result = await repository.create(projectId, input);
			enqueue('survey', 'create', result.id, {
				...finalRow('survey', result.id),
				projectId
			});
			return result;
		},

		update: async (id, input) => {
			const base = surveyRowUpdatedAt('survey', id);
			const result = await repository.update(id, input);
			enqueue('survey', 'update', id, finalRow('survey', id), base);
			return result;
		},

		transition: async (id, input) => {
			const base = surveyRowUpdatedAt('survey', id);
			const result = await repository.transition(id, input);
			enqueue(
				'survey',
				'transition',
				id,
				{
					action: input.action,
					to: surveyActionTarget(input.action),
					reason: input.reason ?? null
				},
				base
			);
			return result;
		},

		createRoom: async (surveyId, input) => {
			const result = await repository.createRoom(surveyId, input);
			enqueue('room', 'create', result.id, finalRow('room', result.id));
			return result;
		},

		updateRoom: async (id, input) => {
			const base = surveyRowUpdatedAt('room', id);
			const result = await repository.updateRoom(id, input);
			enqueue('room', 'update', id, finalRow('room', id), base);
			return result;
		},

		archiveRoom: async (id) => {
			const base = surveyRowUpdatedAt('room', id);
			const result = await repository.archiveRoom(id);
			enqueue('room', 'update', id, finalRow('room', id), base);
			return result;
		},

		createWall: async (surveyRoomId, input) => {
			const result = await repository.createWall(surveyRoomId, input);
			enqueue('wall', 'create', result.id, finalRow('wall', result.id));
			return result;
		},

		updateWall: async (id, input) => {
			const base = surveyRowUpdatedAt('wall', id);
			const result = await repository.updateWall(id, input);
			enqueue('wall', 'update', id, finalRow('wall', id), base);
			return result;
		},

		createOpening: async (surveyRoomId, input) => {
			const result = await repository.createOpening(surveyRoomId, input);
			enqueue('opening', 'create', result.id, finalRow('opening', result.id));
			return result;
		},

		updateOpening: async (id, input) => {
			const base = surveyRowUpdatedAt('opening', id);
			const result = await repository.updateOpening(id, input);
			enqueue('opening', 'update', id, finalRow('opening', id), base);
			return result;
		},

		createUtility: async (surveyRoomId, input) => {
			const result = await repository.createUtility(surveyRoomId, input);
			enqueue('utility', 'create', result.id, finalRow('utility', result.id));
			return result;
		},

		updateUtility: async (id, input) => {
			const base = surveyRowUpdatedAt('utility', id);
			const result = await repository.updateUtility(id, input);
			enqueue('utility', 'update', id, finalRow('utility', id), base);
			return result;
		},

		createObstacle: async (surveyRoomId, input) => {
			const result = await repository.createObstacle(surveyRoomId, input);
			enqueue('obstacle', 'create', result.id, finalRow('obstacle', result.id));
			return result;
		},

		updateObstacle: async (id, input) => {
			const base = surveyRowUpdatedAt('obstacle', id);
			const result = await repository.updateObstacle(id, input);
			enqueue('obstacle', 'update', id, finalRow('obstacle', id), base);
			return result;
		},

		createMeasurement: async (surveyId, input) => {
			const result = await repository.createMeasurement(surveyId, input);
			enqueue('measurement', 'create', result.id, finalRow('measurement', result.id));
			return result;
		},

		updateMeasurement: async (id, input) => {
			const base = surveyRowUpdatedAt('measurement', id);
			const result = await repository.updateMeasurement(id, input);
			enqueue('measurement', 'update', id, finalRow('measurement', id), base);
			return result;
		},

		verifyMeasurement: async (id, input) => {
			const base = surveyRowUpdatedAt('measurement', id);
			const result = await repository.verifyMeasurement(id, input);
			enqueue(
				'measurement',
				'verify',
				id,
				{ method: input.method, note: input.note ?? null },
				base
			);
			return result;
		},

		createNote: async (surveyId, input) => {
			const result = await repository.createNote(surveyId, input);
			enqueue('note', 'create', result.id, finalRow('note', result.id));
			return result;
		},

		reviseNote: async (noteId, input) => {
			const base = surveyRowUpdatedAt('note', noteId);
			const result = await repository.reviseNote(noteId, input);
			enqueue('note', 'revision', noteId, { body: input.body }, base);
			return result;
		}
	};
}
