import type { Page } from '$shared/domain/pagination';
import { PERMISSIONS } from '$shared/domain/permissions';
import { ASSET_UPLOAD_STATES, type AssetUploadState } from '$shared/domain/record-states';
import type { Uuid } from '$shared/domain/uuid';

export { ASSET_UPLOAD_STATES };
export type { AssetUploadState };

/**
 * Asset domain contract (spec Part 9 §12, Part 10 §8, Part 4 §12).
 *
 * Assets are shared beyond surveys (approvals, renders, sign-off), so the
 * module is generic: an asset has exactly one owner and inherits that owner's
 * permission — there is no `asset.*` permission code in the canonical
 * vocabulary (Part 6 §3). Integrity is `sha256`; a mismatch ends `failed` and
 * can never become `complete`.
 */

export const ASSET_KINDS = ['photo', 'video', 'plan'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/**
 * Phase 2 owners are the survey tree. Later phases extend this list
 * additively (`quote`, `job`, `order`, `design_version`, `approval`); the
 * exactly-one-owner rule is unchanged.
 */
export const ASSET_OWNER_TYPES = ['survey', 'room', 'wall', 'opening'] as const;
export type AssetOwnerType = (typeof ASSET_OWNER_TYPES)[number];

export interface AssetOwner {
	type: AssetOwnerType;
	id: Uuid;
}

/** Inherited permissions per owner type (Part 6 §3 note). */
export const ASSET_OWNER_PERMISSIONS: Readonly<
	Record<AssetOwnerType, { readonly view: string; readonly write: string }>
> = Object.freeze({
	survey: { view: PERMISSIONS.SURVEY_VIEW, write: PERMISSIONS.SURVEY_UPDATE },
	room: { view: PERMISSIONS.SURVEY_VIEW, write: PERMISSIONS.SURVEY_UPDATE },
	wall: { view: PERMISSIONS.SURVEY_VIEW, write: PERMISSIONS.SURVEY_UPDATE },
	opening: { view: PERMISSIONS.SURVEY_VIEW, write: PERMISSIONS.SURVEY_UPDATE }
});

export const ASSET_MIME_TYPES: Readonly<Record<AssetKind, readonly string[]>> = Object.freeze({
	photo: ['image/jpeg', 'image/png', 'image/heic'],
	video: ['video/mp4', 'video/quicktime'],
	plan: ['application/pdf', 'image/png', 'image/jpeg']
});

/**
 * Hard transport cap. Part 9 §12 caps plans at 50 MB and leaves photo/video
 * byte limits to configuration; the daily 2 GB quota is not enforced while
 * Q15 is open (phase-2 §1 "Not in this phase").
 */
export const MAX_ASSET_SIZE_BYTES = 50 * 1024 * 1024;

/** Lower-case hex SHA-256 (64 chars). */
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export interface Asset {
	id: Uuid;
	tenantId: Uuid;
	ownerType: AssetOwnerType;
	ownerId: Uuid;
	assetKind: AssetKind;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	sha256: string;
	uploadState: AssetUploadState;
	caption: string | null;
	/** Short-lived signed URL; never a public path (Part 10 §8). */
	signedUrl: string | null;
	signedUrlExpiresAt: string | null;
	capturedAt: string | null;
	deviceModel: string | null;
	orientation: string | null;
	uploadedBy: Uuid | null;
	createdAt: string;
	updatedAt: string;
}

/** `POST /assets` response: the pending row plus the one-shot upload URL. */
export interface AssetInitResult {
	asset: Asset;
	uploadUrl: string;
	expiresAt: string;
}

export interface AssetSignedUrl {
	url: string;
	expiresAt: string;
}

export interface InitAssetInput {
	ownerType: AssetOwnerType;
	ownerId: Uuid;
	assetKind: AssetKind;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	sha256: string;
	caption?: string | null;
	capturedAt?: string | null;
	deviceModel?: string | null;
	orientation?: string | null;
}

export interface CompleteAssetInput {
	/** Re-sent so the mock verifies integrity on completion (S7). */
	sha256: string;
}

/** Resumable progress only reaches the states listed here. */
export interface AssetStateInput {
	uploadState: 'pending' | 'uploading' | 'failed';
}

export interface AssetListParams {
	ownerType?: AssetOwnerType;
	ownerId?: Uuid;
	/** Media page: every asset in the survey tree, grouped by owner. */
	surveyId?: Uuid;
	uploadState?: AssetUploadState | 'all';
	page?: number;
	pageSize?: number;
}

export type AssetPage = Page<Asset>;
