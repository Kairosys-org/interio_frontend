import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import {
	demoAssetId,
	demoSurveyMeasurementId,
	demoSurveyorId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS } from '$shared/data/demo-seed';
import type { SyncOperationRecord } from '$shared/data/records';

/**
 * Sync seed (phase-2 §5.2, §5.3).
 *
 * Two queued operations make the sync hub honest on first load:
 *
 * 1. The conflict fixture: a measurement edit queued 29 days ago with a base
 *    version 30 days old. The server row moved two days ago (2400 mm), so the
 *    push must refuse it, keep the server value and offer "Re-apply my
 *    change" (Q10).
 * 2. An asset-state op for the queued utility photo. Its first push fails
 *    transiently, so the retry/backoff path is visible without fabricating a
 *    failure at runtime.
 *
 * Ids and dates are literal; the UUIDv7 replay key is a fixed literal so the
 * fixture survives a reload unchanged.
 */

const TENANT_ID = DEMO_TENANTS[0].id;
const SURVEYOR_ID = demoSurveyorId('surveyor');

const CONFLICT_KEY = '0199c6f4-8a2b-7c4d-9e6f-1a2b3c4d5e6f';
const ASSET_STATE_KEY = '0199c6f4-8a2b-7c4d-9e6f-2b3c4d5e6f70';

function operation(key: string, overrides: Partial<SyncOperationRecord>): SyncOperationRecord {
	return {
		id: demoAssetId(`sync:${key}`),
		tenantId: TENANT_ID,
		userId: SURVEYOR_ID,
		idempotencyKey: overrides.idempotencyKey ?? CONFLICT_KEY,
		entity: 'measurement',
		op: 'update',
		localId: demoSurveyMeasurementId(1, 1, 1, 1),
		payload: {},
		baseUpdatedAt: null,
		state: 'queued',
		attempts: 0,
		lastError: null,
		conflict: null,
		result: null,
		clientTimestamp: demoDays(29),
		createdAt: demoDays(29),
		sentAt: null,
		...overrides
	};
}

const conflictOperation = operation('conflict', {
	idempotencyKey: CONFLICT_KEY,
	entity: 'measurement',
	op: 'update',
	localId: demoSurveyMeasurementId(1, 1, 1, 1),
	payload: { valueMm: 2450 },
	baseUpdatedAt: demoDays(30),
	clientTimestamp: demoDays(29),
	createdAt: demoDays(29)
});

const assetStateOperation = operation('asset-state', {
	idempotencyKey: ASSET_STATE_KEY,
	entity: 'asset',
	op: 'asset_state',
	localId: demoAssetId('live:utility:queued'),
	payload: { uploadState: 'uploading' },
	baseUpdatedAt: demoDays(5),
	clientTimestamp: demoDays(2),
	createdAt: demoDays(2)
});

export function seedSync(): Record<string, unknown[]> {
	return {
		[COLLECTIONS.syncOperations]: [conflictOperation, assetStateOperation]
	};
}
