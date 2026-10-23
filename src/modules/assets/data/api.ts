import { apiCall } from '$network/api';
import { requirePermission } from '$network/guard';
import { PERMISSIONS } from '$shared/domain/permissions';
import type { Uuid } from '$shared/domain/uuid';
import {
	ASSET_OWNER_PERMISSIONS,
	type AssetListParams,
	type AssetStateInput,
	type CompleteAssetInput,
	type InitAssetInput
} from '../domain/types';
import { getAssetsRepository } from './repository-provider';

const READ = { latencyMs: 180 } as const;
const WRITE = { latencyMs: 300 } as const;

/**
 * Asset facade (architecture §4.5, Part 6 §3).
 *
 * There is no `asset.*` permission: every action resolves the owner and
 * requires its inherited code. Listing and reading need the inherited view
 * permission; the mock narrows capture-only surveyors to their assignments.
 */
export const assetsApi = {
	list(params: AssetListParams = {}) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getAssetsRepository().list(params);
		}, READ);
	},

	get(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.SURVEY_VIEW);
			return getAssetsRepository().get(id);
		}, READ);
	},

	init(input: InitAssetInput) {
		return apiCall(() => {
			requirePermission(ASSET_OWNER_PERMISSIONS[input.ownerType].write);
			return getAssetsRepository().init(input);
		}, WRITE);
	},

	complete(id: string, input: CompleteAssetInput) {
		return apiCall(async () => {
			await requireInherited(id, 'write');
			return getAssetsRepository().complete(id, input);
		}, WRITE);
	},

	setState(id: string, input: AssetStateInput) {
		return apiCall(async () => {
			await requireInherited(id, 'write');
			return getAssetsRepository().setState(id, input);
		}, WRITE);
	},

	signedUrl(id: string) {
		return apiCall(async () => {
			await requireInherited(id, 'view');
			return getAssetsRepository().signedUrl(id);
		}, READ);
	}
};

/** Resolve the row first so an unknown id stays a 404, not a permission leak. */
async function requireInherited(id: Uuid, access: 'view' | 'write'): Promise<void> {
	const asset = await getAssetsRepository().get(id);
	requirePermission(ASSET_OWNER_PERMISSIONS[asset.ownerType][access]);
}
