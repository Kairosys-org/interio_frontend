import type { Uuid } from '$shared/domain/uuid';
import type {
	Asset,
	AssetInitResult,
	AssetListParams,
	AssetPage,
	AssetSignedUrl,
	AssetStateInput,
	CompleteAssetInput,
	InitAssetInput
} from '../domain/types';

/**
 * Asset repository contract (frozen in wave 0, architecture §4.4).
 *
 * Permission is inherited from the owner: the facade resolves
 * `ASSET_OWNER_PERMISSIONS[ownerType]` and never invents an `asset.*` code.
 * State machine: `pending → uploading → complete | failed`; `complete` is only
 * reachable through `complete()` after the sha256 matches, and a failed row is
 * retried by returning to `uploading` (resumable, never silently completed).
 */
export interface AssetsRepository {
	list(params: AssetListParams): Promise<AssetPage>;
	get(id: Uuid): Promise<Asset>;
	/** Exactly-one-owner check + MIME/size/sha256 validation (Part 9 §12). */
	init(input: InitAssetInput): Promise<AssetInitResult>;
	complete(id: Uuid, input: CompleteAssetInput): Promise<Asset>;
	setState(id: Uuid, input: AssetStateInput): Promise<Asset>;
	signedUrl(id: Uuid): Promise<AssetSignedUrl>;
}
