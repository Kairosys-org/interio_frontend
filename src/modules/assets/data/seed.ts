import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import {
	DEMO_SURVEY_KEYS,
	demoAssetId,
	demoSurveyId,
	demoSurveyOpeningId,
	demoSurveyRoomId,
	demoSurveyWallId,
	demoSurveyorId
} from '$shared/data/demo-record-plan';
import { DEMO_TENANTS } from '$shared/data/demo-seed';
import type { AssetRecord } from '$shared/data/records';
import type { AssetUploadState } from '$shared/domain/record-states';
import { hashString } from '$shared/lib/deterministic';
import type { AssetOwnerType } from '../domain/types';

/**
 * Asset seed (phase-2 §5.2).
 *
 * Metadata-only fixtures: no image or PDF bytes are fabricated, so every
 * caption names the placeholder and the media grid renders a labelled tile
 * instead of a stock photo. Ids come from `demoAssetId`, dates from
 * `demoDays`, checksums from a deterministic hash — the seed is byte-identical
 * on every run.
 *
 * Fixtures worth keeping:
 * - a `failed` upload (checksum mismatch) so retry has something to prove;
 * - a `pending` row so the upload queue is not empty on first load;
 * - an opening-owned and a wall-owned asset, proving the owner rule is not
 *   survey-only and that permission is inherited;
 * - a complete asset in the verified tree, which stays read-only.
 */

const TENANT_ID = DEMO_TENANTS[0].id;
const SURVEYOR_ID = demoSurveyorId('surveyor');
const SURVEYOR_2_ID = demoSurveyorId('surveyor-2');

const CAPTURED_AT = demoDays(5);
const LIVE_UPDATED = demoDays(2);
const VERIFIED_UPDATED = demoDays(1);
const SIGNED_URL_EXPIRY = demoDays(-1);

/** 64 lower-case hex characters, stable for a given label (S7 fixture). */
function seedSha(label: string): string {
	return Array.from({ length: 8 }, (_, index) =>
		hashString(`${label}:${index}`).toString(16).padStart(8, '0')
	).join('');
}

function signedUrl(id: string): string {
	return `interio-mock://asset/${id}?expires=${encodeURIComponent(SIGNED_URL_EXPIRY)}`;
}

interface AssetSeedMeta {
	key: string;
	ownerType: AssetOwnerType;
	ownerId: string;
	assetKind: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	uploadState: AssetUploadState;
	caption: string;
	capturedAt?: string;
	deviceModel?: string | null;
	orientation?: string | null;
	uploadedBy?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

function assetRecord(meta: AssetSeedMeta): AssetRecord {
	const id = demoAssetId(meta.key);
	const complete = meta.uploadState === 'complete';
	return {
		id,
		tenantId: TENANT_ID,
		ownerType: meta.ownerType,
		ownerId: meta.ownerId,
		assetKind: meta.assetKind,
		fileName: meta.fileName,
		mimeType: meta.mimeType,
		sizeBytes: meta.sizeBytes,
		sha256: seedSha(meta.key),
		uploadState: meta.uploadState,
		caption: meta.caption,
		signedUrl: complete ? signedUrl(id) : null,
		signedUrlExpiresAt: complete ? SIGNED_URL_EXPIRY : null,
		capturedAt: meta.capturedAt ?? CAPTURED_AT,
		deviceModel: meta.deviceModel ?? null,
		orientation: meta.orientation ?? null,
		uploadedBy: meta.uploadedBy ?? SURVEYOR_ID,
		createdAt: meta.createdAt ?? CAPTURED_AT,
		updatedAt: meta.updatedAt ?? LIVE_UPDATED
	};
}

const LIVE = DEMO_SURVEY_KEYS.inProgress;
const VERIFIED = DEMO_SURVEY_KEYS.verified;
const SUBMITTED = DEMO_SURVEY_KEYS.submitted;

const liveAssets: AssetRecord[] = [
	assetRecord({
		key: 'live:kitchen:overview',
		ownerType: 'survey',
		ownerId: demoSurveyId(LIVE.projectN, LIVE.surveyN),
		assetKind: 'photo',
		fileName: 'kitchen-overview.jpg',
		mimeType: 'image/jpeg',
		sizeBytes: 2_516_582,
		uploadState: 'complete',
		caption: 'Placeholder — kitchen overview from the doorway (metadata only).',
		deviceModel: 'iPhone 15',
		orientation: 'landscape'
	}),
	assetRecord({
		key: 'live:kitchen:window',
		ownerType: 'opening',
		ownerId: demoSurveyOpeningId(LIVE.projectN, LIVE.surveyN, 1, 2),
		assetKind: 'photo',
		fileName: 'garden-door-threshold.jpg',
		mimeType: 'image/jpeg',
		sizeBytes: 1_884_160,
		uploadState: 'complete',
		caption: 'Placeholder — garden door threshold and reveal (metadata only).',
		deviceModel: 'iPhone 15',
		orientation: 'portrait'
	}),
	assetRecord({
		key: 'live:living:bay',
		ownerType: 'room',
		ownerId: demoSurveyRoomId(LIVE.projectN, LIVE.surveyN, 3),
		assetKind: 'photo',
		fileName: 'bay-window-run.jpg',
		mimeType: 'image/jpeg',
		sizeBytes: 3_145_728,
		uploadState: 'complete',
		caption: 'Placeholder — bay window run along Wall A (metadata only).',
		deviceModel: 'iPhone 15'
	}),
	assetRecord({
		key: 'live:utility:queued',
		ownerType: 'room',
		ownerId: demoSurveyRoomId(LIVE.projectN, LIVE.surveyN, 4),
		assetKind: 'photo',
		fileName: 'utility-extractor.jpg',
		mimeType: 'image/jpeg',
		sizeBytes: 2_097_152,
		uploadState: 'pending',
		caption: 'Placeholder — extractor duct and ceiling access (metadata only).',
		deviceModel: 'iPhone 15'
	}),
	assetRecord({
		key: 'live:hall:failed',
		ownerType: 'room',
		ownerId: demoSurveyRoomId(LIVE.projectN, LIVE.surveyN, 5),
		assetKind: 'photo',
		fileName: 'rear-hall-ceiling.jpg',
		mimeType: 'image/jpeg',
		sizeBytes: 2_621_440,
		uploadState: 'failed',
		caption:
			'Placeholder — rear hall ceiling, checksum mismatch so this upload must be retried (metadata only).',
		deviceModel: 'iPhone 15',
		updatedAt: demoDays(1)
	}),
	assetRecord({
		key: 'live:plan:existing',
		ownerType: 'survey',
		ownerId: demoSurveyId(LIVE.projectN, LIVE.surveyN),
		assetKind: 'plan',
		fileName: 'existing-floor-plan.pdf',
		mimeType: 'application/pdf',
		sizeBytes: 4_718_592,
		uploadState: 'complete',
		caption: 'Placeholder — estate agent floor plan supplied by the client (metadata only).',
		uploadedBy: null
	})
];

const verifiedAssets: AssetRecord[] = [
	assetRecord({
		key: 'verified:bedroom:overview',
		ownerType: 'room',
		ownerId: demoSurveyRoomId(VERIFIED.projectN, VERIFIED.surveyN, 1),
		assetKind: 'photo',
		fileName: 'principal-bedroom-overview.jpg',
		mimeType: 'image/jpeg',
		sizeBytes: 2_202_009,
		uploadState: 'complete',
		caption: 'Placeholder — principal bedroom, wardrobe wall (metadata only).',
		deviceModel: 'iPhone 14',
		capturedAt: demoDays(21),
		createdAt: demoDays(21),
		updatedAt: VERIFIED_UPDATED
	}),
	assetRecord({
		key: 'verified:bedroom:wall-b',
		ownerType: 'wall',
		ownerId: demoSurveyWallId(VERIFIED.projectN, VERIFIED.surveyN, 1, 2),
		assetKind: 'photo',
		fileName: 'principal-bedroom-wall-b.jpg',
		mimeType: 'image/jpeg',
		sizeBytes: 1_572_864,
		uploadState: 'complete',
		caption: 'Placeholder — Wall B, out-of-square corner (metadata only).',
		deviceModel: 'iPhone 14',
		capturedAt: demoDays(21),
		createdAt: demoDays(21),
		updatedAt: VERIFIED_UPDATED
	})
];

const submittedAssets: AssetRecord[] = [
	assetRecord({
		key: 'submitted:bootroom:door',
		ownerType: 'opening',
		ownerId: demoSurveyOpeningId(SUBMITTED.projectN, SUBMITTED.surveyN, 1, 1),
		assetKind: 'photo',
		fileName: 'boot-room-side-entrance.jpg',
		mimeType: 'image/jpeg',
		sizeBytes: 1_966_080,
		uploadState: 'complete',
		caption: 'Placeholder — side entrance and step (metadata only).',
		deviceModel: 'Pixel 8',
		uploadedBy: SURVEYOR_2_ID,
		capturedAt: demoDays(14),
		createdAt: demoDays(14),
		updatedAt: VERIFIED_UPDATED
	})
];

export function seedAssets(): Record<string, unknown[]> {
	return {
		[COLLECTIONS.assets]: [...liveAssets, ...verifiedAssets, ...submittedAssets]
	};
}
