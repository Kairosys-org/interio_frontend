import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import { DEMO_TENANTS } from '$shared/data/demo-seed';
import {
	DEMO_SURVEY_KEYS,
	demoProjectId,
	demoSurveyId,
	demoSurveyMeasurementId,
	demoSurveyNoteId,
	demoSurveyObstacleId,
	demoSurveyOpeningId,
	demoSurveyRoomId,
	demoSurveyUtilityId,
	demoSurveyWallId,
	demoSurveyorId
} from '$shared/data/demo-record-plan';
import type {
	SurveyMeasurementRecord,
	SurveyNoteRecord,
	SurveyObstacleRecord,
	SurveyOpeningRecord,
	SurveyRecord,
	SurveyRoomRecord,
	SurveyUtilityRecord,
	SurveyWallRecord
} from '$shared/data/records';
import type { SurveyState } from '$shared/domain/record-states';
import { isCriticalDimensionKind } from '../domain/types';

/**
 * Survey seed (phase-2 §5.2).
 *
 * Deterministic by construction: ids come from `demo-record-plan`, dates from
 * `demoDays`, no `Math.random` and no wall clock. Foreign keys line up with
 * the Phase 1 project/assignment seed, so `scope: 'mine'` is meaningful:
 *
 * - project 1 (surveyor Aisha): `in_progress` + `verified` — the two-survey
 *   project the spec asks for, carrying the G8 and submit-block fixtures.
 * - project 2 (surveyor Liam): `submitted`, awaiting verification.
 * - project 3 (surveyor Mei): `rejected`, with a reason.
 *
 * Fixtures other phases rely on:
 * - room 5 has no ceiling height → the submit checklist must name it;
 * - room 1 opening 1 is unattached (no wall link);
 * - room 3 ceiling height is a LiDAR reading with device info;
 * - exactly three critical measurements are unverified, so G8 blocks verify;
 * - `demoSurveyMeasurementId(1,1,1,1)` is the sync conflict target: server
 *   value 2400 mm, `updatedAt` two days ago, while the queued op was created
 *   29 days ago (see the sync seed).
 */

const TENANT_ID = DEMO_TENANTS[0].id;
const SURVEYOR_ID = demoSurveyorId('surveyor');
const SURVEYOR_2_ID = demoSurveyorId('surveyor-2');
const SURVEYOR_3_ID = demoSurveyorId('surveyor-3');
const PM_ID = demoSurveyorId('production_manager');

const CAPTURED_AT = demoDays(5);
const LIVE_UPDATED = demoDays(2);
const VERIFIED_UPDATED = demoDays(1);

interface SurveySeedMeta {
	projectN: number;
	surveyN: number;
	surveyorId: string;
	caption: string;
	status: SurveyState;
	appointmentAt: string;
	submittedAt?: string | null;
	verifiedAt?: string | null;
	verifiedBy?: string | null;
	rejectedReason?: string | null;
	reopenCount?: number;
	createdAt?: string;
	updatedAt?: string;
}

function surveyRecord(meta: SurveySeedMeta): SurveyRecord {
	return {
		id: demoSurveyId(meta.projectN, meta.surveyN),
		tenantId: TENANT_ID,
		projectId: demoProjectId(meta.projectN),
		surveyorId: meta.surveyorId,
		caption: meta.caption,
		appointmentAt: meta.appointmentAt,
		status: meta.status,
		reopenCount: meta.reopenCount ?? 0,
		submittedAt: meta.submittedAt ?? null,
		verifiedAt: meta.verifiedAt ?? null,
		verifiedBy: meta.verifiedBy ?? null,
		rejectedReason: meta.rejectedReason ?? null,
		createdAt: meta.createdAt ?? demoDays(12),
		updatedAt: meta.updatedAt ?? LIVE_UPDATED,
		createdBy: meta.surveyorId
	};
}

interface RoomSeedMeta {
	projectN: number;
	surveyN: number;
	roomN: number;
	caption: string;
	roomType: string;
	ceilingHeightMm: number | null;
	roomLengthMm: number | null;
	roomWidthMm: number | null;
	shapeNotes?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

function roomRecord(meta: RoomSeedMeta): SurveyRoomRecord {
	return {
		id: demoSurveyRoomId(meta.projectN, meta.surveyN, meta.roomN),
		tenantId: TENANT_ID,
		surveyId: demoSurveyId(meta.projectN, meta.surveyN),
		caption: meta.caption,
		roomType: meta.roomType,
		sortOrder: meta.roomN,
		ceilingHeightMm: meta.ceilingHeightMm,
		roomLengthMm: meta.roomLengthMm,
		roomWidthMm: meta.roomWidthMm,
		shapeNotes: meta.shapeNotes ?? null,
		archivedAt: null,
		createdAt: meta.createdAt ?? CAPTURED_AT,
		updatedAt: meta.updatedAt ?? LIVE_UPDATED
	};
}

function wallRecord(
	projectN: number,
	surveyN: number,
	roomN: number,
	wallN: number,
	lengthMm: number,
	heightMm: number,
	condition: string | null = null
): SurveyWallRecord {
	return {
		id: demoSurveyWallId(projectN, surveyN, roomN, wallN),
		tenantId: TENANT_ID,
		surveyRoomId: demoSurveyRoomId(projectN, surveyN, roomN),
		caption: `Wall ${wallN === 1 ? 'A' : 'B'}`,
		lengthMm,
		heightMm,
		condition,
		sortOrder: wallN,
		createdAt: CAPTURED_AT,
		updatedAt: LIVE_UPDATED
	};
}

interface OpeningSeedMeta {
	projectN: number;
	surveyN: number;
	roomN: number;
	openingN: number;
	openingType: string;
	caption: string;
	widthMm: number;
	heightMm: number;
	sillHeightMm: number | null;
	swingDirection: string | null;
	revealDepthMm: number | null;
	surveyWallId: string | null;
	unattached: boolean;
	notes?: string | null;
}

function openingRecord(meta: OpeningSeedMeta): SurveyOpeningRecord {
	return {
		id: demoSurveyOpeningId(meta.projectN, meta.surveyN, meta.roomN, meta.openingN),
		tenantId: TENANT_ID,
		surveyRoomId: demoSurveyRoomId(meta.projectN, meta.surveyN, meta.roomN),
		surveyWallId: meta.surveyWallId,
		unattached: meta.unattached,
		openingType: meta.openingType,
		caption: meta.caption,
		widthMm: meta.widthMm,
		heightMm: meta.heightMm,
		sillHeightMm: meta.sillHeightMm,
		swingDirection: meta.swingDirection,
		revealDepthMm: meta.revealDepthMm,
		notes: meta.notes ?? null,
		createdAt: CAPTURED_AT,
		updatedAt: LIVE_UPDATED
	};
}

function utilityRecord(
	projectN: number,
	surveyN: number,
	roomN: number,
	utilityN: number,
	utilityType: string,
	locationDesc: string,
	options: {
		surveyWallId?: string | null;
		positionOffsetMm?: number | null;
		notes?: string | null;
	} = {}
): SurveyUtilityRecord {
	return {
		id: demoSurveyUtilityId(projectN, surveyN, roomN, utilityN),
		tenantId: TENANT_ID,
		surveyRoomId: demoSurveyRoomId(projectN, surveyN, roomN),
		surveyWallId: options.surveyWallId ?? null,
		utilityType,
		locationDesc,
		positionOffsetMm: options.positionOffsetMm ?? null,
		heightFromFloorMm: null,
		notes: options.notes ?? null,
		createdAt: CAPTURED_AT,
		updatedAt: LIVE_UPDATED
	};
}

function obstacleRecord(
	projectN: number,
	surveyN: number,
	roomN: number,
	obstacleN: number,
	obstacleType: string,
	description: string,
	options: {
		widthMm?: number | null;
		heightMm?: number | null;
		depthMm?: number | null;
		blocksPositioning?: boolean;
		positionDesc?: string | null;
	} = {}
): SurveyObstacleRecord {
	return {
		id: demoSurveyObstacleId(projectN, surveyN, roomN, obstacleN),
		tenantId: TENANT_ID,
		surveyRoomId: demoSurveyRoomId(projectN, surveyN, roomN),
		obstacleType,
		description,
		widthMm: options.widthMm ?? null,
		heightMm: options.heightMm ?? null,
		depthMm: options.depthMm ?? null,
		blocksPositioning: options.blocksPositioning ?? false,
		positionDesc: options.positionDesc ?? null,
		createdAt: CAPTURED_AT,
		updatedAt: LIVE_UPDATED
	};
}

interface MeasurementSeedMeta {
	projectN: number;
	surveyN: number;
	roomN: number;
	measurementN: number;
	targetType: string;
	valueMm: number;
	source: string;
	targetCaption?: string | null;
	deviceInfo?: string | null;
	surveyWallId?: string | null;
	verified?: boolean;
	updatedAt?: string;
}

function measurementRecord(meta: MeasurementSeedMeta): SurveyMeasurementRecord {
	return {
		id: demoSurveyMeasurementId(meta.projectN, meta.surveyN, meta.roomN, meta.measurementN),
		tenantId: TENANT_ID,
		surveyRoomId: demoSurveyRoomId(meta.projectN, meta.surveyN, meta.roomN),
		surveyWallId: meta.surveyWallId ?? null,
		surveyOpeningId: null,
		targetType: meta.targetType,
		targetCaption: meta.targetCaption ?? null,
		valueMm: meta.valueMm,
		source: meta.source,
		deviceInfo: meta.deviceInfo ?? null,
		isManufacturingCritical: isCriticalDimensionKind(meta.targetType),
		verifiedBy: meta.verified ? PM_ID : null,
		verifiedAt: meta.verified ? demoDays(1) : null,
		verificationMethod: meta.verified ? 're_measure' : null,
		verificationNote: null,
		capturedAt: CAPTURED_AT,
		createdAt: CAPTURED_AT,
		updatedAt: meta.updatedAt ?? LIVE_UPDATED
	};
}

interface NoteSeedMeta {
	projectN: number;
	surveyN: number;
	noteN: number;
	surveyRoomId: string | null;
	category: string;
	body: string;
}

function noteRecord(meta: NoteSeedMeta): SurveyNoteRecord {
	return {
		id: demoSurveyNoteId(meta.projectN, meta.surveyN, meta.noteN),
		tenantId: TENANT_ID,
		surveyId: demoSurveyId(meta.projectN, meta.surveyN),
		surveyRoomId: meta.surveyRoomId,
		category: meta.category,
		body: meta.body,
		revision: 1,
		supersedesNoteId: null,
		createdBy: SURVEYOR_ID,
		createdAt: CAPTURED_AT
	};
}

/* ------------------------------------------------------------------ */
/* Project 1 / survey 1 — in progress (the working fixture)            */
/* ------------------------------------------------------------------ */

const LIVE = DEMO_SURVEY_KEYS.inProgress;

const liveRooms: SurveyRoomRecord[] = [
	roomRecord({
		...LIVE,
		roomN: 1,
		caption: 'Kitchen',
		roomType: 'kitchen',
		ceilingHeightMm: 2400,
		roomLengthMm: 4800,
		roomWidthMm: 3600
	}),
	roomRecord({
		...LIVE,
		roomN: 2,
		caption: 'Dining room',
		roomType: 'dining',
		ceilingHeightMm: 2400,
		roomLengthMm: 3900,
		roomWidthMm: 3100
	}),
	roomRecord({
		...LIVE,
		roomN: 3,
		caption: 'Living room',
		roomType: 'living',
		ceilingHeightMm: 2650,
		roomLengthMm: 5200,
		roomWidthMm: 4100,
		shapeNotes: 'Bay window and a chimney breast on Wall B.'
	}),
	roomRecord({
		...LIVE,
		roomN: 4,
		caption: 'Utility room',
		roomType: 'utility',
		ceilingHeightMm: 2300,
		roomLengthMm: 2800,
		roomWidthMm: 2400
	}),
	// Deliberate submit blocker: no ceiling height captured yet.
	roomRecord({
		...LIVE,
		roomN: 5,
		caption: 'Rear hall',
		roomType: 'hall',
		ceilingHeightMm: null,
		roomLengthMm: 1900,
		roomWidthMm: 1200
	})
];

const liveWalls: SurveyWallRecord[] = [
	wallRecord(LIVE.projectN, LIVE.surveyN, 1, 1, 4800, 2400),
	wallRecord(LIVE.projectN, LIVE.surveyN, 1, 2, 3600, 2400, 'Slight bow, about 6 mm over the run.'),
	wallRecord(LIVE.projectN, LIVE.surveyN, 2, 1, 3900, 2400),
	wallRecord(LIVE.projectN, LIVE.surveyN, 2, 2, 3100, 2400),
	wallRecord(LIVE.projectN, LIVE.surveyN, 3, 1, 5200, 2650),
	wallRecord(LIVE.projectN, LIVE.surveyN, 3, 2, 4100, 2650),
	wallRecord(LIVE.projectN, LIVE.surveyN, 4, 1, 2800, 2300),
	wallRecord(LIVE.projectN, LIVE.surveyN, 4, 2, 2400, 2300),
	wallRecord(LIVE.projectN, LIVE.surveyN, 5, 1, 1900, 2400),
	wallRecord(LIVE.projectN, LIVE.surveyN, 5, 2, 1200, 2400)
];

const liveOpenings: SurveyOpeningRecord[] = [
	// Unattached opening: captured before the wall it belongs to (Part 9 §7).
	openingRecord({
		...LIVE,
		roomN: 1,
		openingN: 1,
		openingType: 'window',
		caption: 'Side window (wall not recorded yet)',
		widthMm: 1200,
		heightMm: 1400,
		sillHeightMm: 900,
		swingDirection: null,
		revealDepthMm: 120,
		surveyWallId: null,
		unattached: true,
		notes: 'Wall link to be confirmed on the re-visit.'
	}),
	openingRecord({
		...LIVE,
		roomN: 1,
		openingN: 2,
		openingType: 'door',
		caption: 'Garden door',
		widthMm: 900,
		heightMm: 2100,
		sillHeightMm: null,
		swingDirection: 'left',
		revealDepthMm: 100,
		surveyWallId: demoSurveyWallId(LIVE.projectN, LIVE.surveyN, 1, 1),
		unattached: false
	}),
	openingRecord({
		...LIVE,
		roomN: 2,
		openingN: 1,
		openingType: 'window',
		caption: 'Front window',
		widthMm: 1500,
		heightMm: 1400,
		sillHeightMm: 850,
		swingDirection: null,
		revealDepthMm: 140,
		surveyWallId: demoSurveyWallId(LIVE.projectN, LIVE.surveyN, 2, 1),
		unattached: false
	}),
	openingRecord({
		...LIVE,
		roomN: 3,
		openingN: 1,
		openingType: 'window',
		caption: 'Bay window',
		widthMm: 2100,
		heightMm: 1500,
		sillHeightMm: 700,
		swingDirection: null,
		revealDepthMm: 160,
		surveyWallId: demoSurveyWallId(LIVE.projectN, LIVE.surveyN, 3, 1),
		unattached: false
	}),
	openingRecord({
		...LIVE,
		roomN: 4,
		openingN: 1,
		openingType: 'door',
		caption: 'External door',
		widthMm: 850,
		heightMm: 2050,
		sillHeightMm: null,
		swingDirection: 'right',
		revealDepthMm: 90,
		surveyWallId: demoSurveyWallId(LIVE.projectN, LIVE.surveyN, 4, 1),
		unattached: false
	})
];

const liveUtilities: SurveyUtilityRecord[] = [
	utilityRecord(LIVE.projectN, LIVE.surveyN, 1, 1, 'water', 'Under the sink, rear wall', {
		surveyWallId: demoSurveyWallId(LIVE.projectN, LIVE.surveyN, 1, 2),
		positionOffsetMm: 1450
	}),
	utilityRecord(
		LIVE.projectN,
		LIVE.surveyN,
		3,
		1,
		'electric',
		'Consumer unit in the hall cupboard',
		{
			surveyWallId: demoSurveyWallId(LIVE.projectN, LIVE.surveyN, 3, 2)
		}
	),
	utilityRecord(LIVE.projectN, LIVE.surveyN, 4, 1, 'vent', 'Extractor duct through the ceiling', {
		notes: 'Vent terminates on the flat roof. Volume flap open.'
	})
];

const liveObstacles: SurveyObstacleRecord[] = [
	obstacleRecord(LIVE.projectN, LIVE.surveyN, 1, 1, 'radiator', 'Radiator under the front window', {
		widthMm: 1200,
		heightMm: 600,
		depthMm: 140,
		blocksPositioning: true,
		positionDesc: 'Centred on Wall A'
	}),
	obstacleRecord(
		LIVE.projectN,
		LIVE.surveyN,
		3,
		1,
		'beam',
		'Exposed steel beam across the ceiling',
		{
			widthMm: 180,
			heightMm: 220,
			blocksPositioning: true
		}
	)
];

const liveMeasurements: SurveyMeasurementRecord[] = [
	// The sync conflict fixture: server value 2400, unverified, critical.
	measurementRecord({
		...LIVE,
		roomN: 1,
		measurementN: 1,
		targetType: 'ceiling_height',
		valueMm: 2400,
		source: 'laser',
		verified: false
	}),
	measurementRecord({
		...LIVE,
		roomN: 1,
		measurementN: 2,
		targetType: 'room_length',
		valueMm: 4800,
		source: 'laser',
		verified: true
	}),
	measurementRecord({
		...LIVE,
		roomN: 1,
		measurementN: 3,
		targetType: 'room_width',
		valueMm: 3600,
		source: 'laser',
		verified: true
	}),
	measurementRecord({
		...LIVE,
		roomN: 1,
		measurementN: 4,
		targetType: 'wall_length',
		valueMm: 4800,
		source: 'laser',
		surveyWallId: demoSurveyWallId(LIVE.projectN, LIVE.surveyN, 1, 1),
		verified: false
	}),
	measurementRecord({
		...LIVE,
		roomN: 1,
		measurementN: 5,
		targetType: 'other',
		targetCaption: 'Window reveal depth',
		valueMm: 140,
		source: 'manual'
	}),

	measurementRecord({
		...LIVE,
		roomN: 2,
		measurementN: 1,
		targetType: 'ceiling_height',
		valueMm: 2400,
		source: 'laser',
		verified: true
	}),
	measurementRecord({
		...LIVE,
		roomN: 2,
		measurementN: 2,
		targetType: 'room_length',
		valueMm: 3900,
		source: 'laser',
		verified: true
	}),
	measurementRecord({
		...LIVE,
		roomN: 2,
		measurementN: 3,
		targetType: 'room_width',
		valueMm: 3100,
		source: 'laser',
		verified: false
	}),
	measurementRecord({
		...LIVE,
		roomN: 2,
		measurementN: 4,
		targetType: 'other',
		targetCaption: 'Extractor duct run',
		valueMm: 900,
		source: 'manual'
	}),

	measurementRecord({
		...LIVE,
		roomN: 3,
		measurementN: 1,
		targetType: 'ceiling_height',
		valueMm: 2650,
		source: 'lidar',
		deviceInfo: 'Leica BLK2GO',
		verified: true
	}),
	measurementRecord({
		...LIVE,
		roomN: 3,
		measurementN: 2,
		targetType: 'room_length',
		valueMm: 5200,
		source: 'laser',
		verified: true
	}),
	measurementRecord({
		...LIVE,
		roomN: 3,
		measurementN: 3,
		targetType: 'room_width',
		valueMm: 4100,
		source: 'laser',
		verified: true
	}),
	measurementRecord({
		...LIVE,
		roomN: 3,
		measurementN: 4,
		targetType: 'other',
		targetCaption: 'Alcove depth',
		valueMm: 600,
		source: 'manual'
	}),

	measurementRecord({
		...LIVE,
		roomN: 4,
		measurementN: 1,
		targetType: 'ceiling_height',
		valueMm: 2300,
		source: 'laser',
		verified: true
	}),
	measurementRecord({
		...LIVE,
		roomN: 4,
		measurementN: 2,
		targetType: 'room_length',
		valueMm: 2800,
		source: 'laser',
		verified: true
	}),
	measurementRecord({
		...LIVE,
		roomN: 4,
		measurementN: 3,
		targetType: 'room_width',
		valueMm: 2400,
		source: 'laser',
		verified: true
	}),

	measurementRecord({
		...LIVE,
		roomN: 5,
		measurementN: 1,
		targetType: 'room_length',
		valueMm: 1900,
		source: 'laser',
		verified: true
	}),
	measurementRecord({
		...LIVE,
		roomN: 5,
		measurementN: 2,
		targetType: 'room_width',
		valueMm: 1200,
		source: 'laser',
		verified: true
	})
];

const liveNotes: SurveyNoteRecord[] = [
	noteRecord({
		...LIVE,
		noteN: 1,
		surveyRoomId: null,
		category: 'access',
		body: 'Access via the side gate; the key safe code is on the job sheet.'
	}),
	noteRecord({
		...LIVE,
		noteN: 2,
		surveyRoomId: demoSurveyRoomId(LIVE.projectN, LIVE.surveyN, 3),
		category: 'observation',
		body: 'Chimney breast is out of square by roughly 8 mm. Flag for the design team.'
	})
];

/* ------------------------------------------------------------------ */
/* Project 1 / survey 2 — verified (complete, read-only tree)          */
/* ------------------------------------------------------------------ */

const VERIFIED = DEMO_SURVEY_KEYS.verified;

const verifiedRooms: SurveyRoomRecord[] = [
	roomRecord({
		...VERIFIED,
		roomN: 1,
		caption: 'Principal bedroom',
		roomType: 'bedroom',
		ceilingHeightMm: 2600,
		roomLengthMm: 4500,
		roomWidthMm: 3800,
		createdAt: demoDays(20),
		updatedAt: VERIFIED_UPDATED
	}),
	roomRecord({
		...VERIFIED,
		roomN: 2,
		caption: 'Dressing room',
		roomType: 'bedroom',
		ceilingHeightMm: 2400,
		roomLengthMm: 3200,
		roomWidthMm: 2600,
		createdAt: demoDays(20),
		updatedAt: VERIFIED_UPDATED
	})
];

const verifiedWalls: SurveyWallRecord[] = [
	wallRecord(VERIFIED.projectN, VERIFIED.surveyN, 1, 1, 4500, 2600),
	wallRecord(VERIFIED.projectN, VERIFIED.surveyN, 1, 2, 3800, 2600),
	wallRecord(VERIFIED.projectN, VERIFIED.surveyN, 2, 1, 3200, 2400),
	wallRecord(VERIFIED.projectN, VERIFIED.surveyN, 2, 2, 2600, 2400)
].map((wall) => ({ ...wall, createdAt: demoDays(20), updatedAt: VERIFIED_UPDATED }));

const verifiedOpenings: SurveyOpeningRecord[] = [
	openingRecord({
		...VERIFIED,
		roomN: 1,
		openingN: 1,
		openingType: 'window',
		caption: 'Rear window',
		widthMm: 1600,
		heightMm: 1400,
		sillHeightMm: 800,
		swingDirection: null,
		revealDepthMm: 150,
		surveyWallId: demoSurveyWallId(VERIFIED.projectN, VERIFIED.surveyN, 1, 1),
		unattached: false
	}),
	openingRecord({
		...VERIFIED,
		roomN: 1,
		openingN: 2,
		openingType: 'door',
		caption: 'En-suite door',
		widthMm: 800,
		heightMm: 2040,
		sillHeightMm: null,
		swingDirection: 'right',
		revealDepthMm: 100,
		surveyWallId: demoSurveyWallId(VERIFIED.projectN, VERIFIED.surveyN, 1, 2),
		unattached: false
	}),
	openingRecord({
		...VERIFIED,
		roomN: 2,
		openingN: 1,
		openingType: 'window',
		caption: 'Side window',
		widthMm: 1200,
		heightMm: 1200,
		sillHeightMm: 900,
		swingDirection: null,
		revealDepthMm: 130,
		surveyWallId: demoSurveyWallId(VERIFIED.projectN, VERIFIED.surveyN, 2, 1),
		unattached: false
	})
].map((opening) => ({ ...opening, createdAt: demoDays(20), updatedAt: VERIFIED_UPDATED }));

const verifiedUtilities: SurveyUtilityRecord[] = [
	utilityRecord(VERIFIED.projectN, VERIFIED.surveyN, 1, 1, 'heating', 'Radiator on Wall A', {
		surveyWallId: demoSurveyWallId(VERIFIED.projectN, VERIFIED.surveyN, 1, 1)
	}),
	utilityRecord(
		VERIFIED.projectN,
		VERIFIED.surveyN,
		2,
		1,
		'electric',
		'Socket ring behind the wardrobe run',
		{
			surveyWallId: demoSurveyWallId(VERIFIED.projectN, VERIFIED.surveyN, 2, 2)
		}
	)
].map((utility) => ({ ...utility, createdAt: demoDays(20), updatedAt: VERIFIED_UPDATED }));

const verifiedObstacles: SurveyObstacleRecord[] = [
	obstacleRecord(VERIFIED.projectN, VERIFIED.surveyN, 1, 1, 'chimney', 'Chimney breast on Wall B', {
		widthMm: 900,
		heightMm: 2600,
		depthMm: 350,
		blocksPositioning: true,
		positionDesc: 'Wall B, left of centre'
	})
].map((obstacle) => ({ ...obstacle, createdAt: demoDays(20), updatedAt: VERIFIED_UPDATED }));

const verifiedMeasurements: SurveyMeasurementRecord[] = [
	measurementRecord({
		...VERIFIED,
		roomN: 1,
		measurementN: 1,
		targetType: 'ceiling_height',
		valueMm: 2600,
		source: 'laser',
		verified: true,
		updatedAt: VERIFIED_UPDATED
	}),
	measurementRecord({
		...VERIFIED,
		roomN: 1,
		measurementN: 2,
		targetType: 'room_length',
		valueMm: 4500,
		source: 'laser',
		verified: true,
		updatedAt: VERIFIED_UPDATED
	}),
	measurementRecord({
		...VERIFIED,
		roomN: 1,
		measurementN: 3,
		targetType: 'room_width',
		valueMm: 3800,
		source: 'laser',
		verified: true,
		updatedAt: VERIFIED_UPDATED
	}),
	measurementRecord({
		...VERIFIED,
		roomN: 2,
		measurementN: 1,
		targetType: 'ceiling_height',
		valueMm: 2400,
		source: 'laser',
		verified: true,
		updatedAt: VERIFIED_UPDATED
	}),
	measurementRecord({
		...VERIFIED,
		roomN: 2,
		measurementN: 2,
		targetType: 'room_length',
		valueMm: 3200,
		source: 'laser',
		verified: true,
		updatedAt: VERIFIED_UPDATED
	}),
	measurementRecord({
		...VERIFIED,
		roomN: 2,
		measurementN: 3,
		targetType: 'room_width',
		valueMm: 2600,
		source: 'laser',
		verified: true,
		updatedAt: VERIFIED_UPDATED
	})
];

const verifiedNotes: SurveyNoteRecord[] = [
	noteRecord({
		...VERIFIED,
		noteN: 1,
		surveyRoomId: null,
		category: 'general',
		body: 'Second visit confirmed the wardrobe run dimensions. Ready for design.'
	})
];

/* ------------------------------------------------------------------ */
/* Project 2 / survey 1 — submitted                                    */
/* ------------------------------------------------------------------ */

const SUBMITTED = DEMO_SURVEY_KEYS.submitted;

const submittedRooms: SurveyRoomRecord[] = [
	roomRecord({
		...SUBMITTED,
		roomN: 1,
		caption: 'Boot room',
		roomType: 'utility',
		ceilingHeightMm: 2350,
		roomLengthMm: 3000,
		roomWidthMm: 2200,
		createdAt: demoDays(14),
		updatedAt: VERIFIED_UPDATED
	})
];

const submittedWalls: SurveyWallRecord[] = [
	{
		...wallRecord(SUBMITTED.projectN, SUBMITTED.surveyN, 1, 1, 3000, 2350),
		createdAt: demoDays(14),
		updatedAt: VERIFIED_UPDATED
	}
];

const submittedOpenings: SurveyOpeningRecord[] = [
	{
		...openingRecord({
			...SUBMITTED,
			roomN: 1,
			openingN: 1,
			openingType: 'door',
			caption: 'Side entrance',
			widthMm: 900,
			heightMm: 2050,
			sillHeightMm: null,
			swingDirection: 'left',
			revealDepthMm: 110,
			surveyWallId: demoSurveyWallId(SUBMITTED.projectN, SUBMITTED.surveyN, 1, 1),
			unattached: false
		}),
		createdAt: demoDays(14),
		updatedAt: VERIFIED_UPDATED
	}
];

const submittedMeasurements: SurveyMeasurementRecord[] = [
	measurementRecord({
		...SUBMITTED,
		roomN: 1,
		measurementN: 1,
		targetType: 'ceiling_height',
		valueMm: 2350,
		source: 'laser',
		verified: true,
		updatedAt: VERIFIED_UPDATED
	}),
	measurementRecord({
		...SUBMITTED,
		roomN: 1,
		measurementN: 2,
		targetType: 'room_length',
		valueMm: 3000,
		source: 'laser',
		verified: true,
		updatedAt: VERIFIED_UPDATED
	}),
	measurementRecord({
		...SUBMITTED,
		roomN: 1,
		measurementN: 3,
		targetType: 'room_width',
		valueMm: 2200,
		source: 'laser',
		verified: true,
		updatedAt: VERIFIED_UPDATED
	})
];

/* ------------------------------------------------------------------ */
/* Project 3 / survey 1 — rejected                                     */
/* ------------------------------------------------------------------ */

const REJECTED = DEMO_SURVEY_KEYS.rejected;

const rejectedRooms: SurveyRoomRecord[] = [
	roomRecord({
		...REJECTED,
		roomN: 1,
		caption: 'Home office',
		roomType: 'other',
		ceilingHeightMm: 2500,
		roomLengthMm: 3600,
		roomWidthMm: 3000,
		createdAt: demoDays(18),
		updatedAt: LIVE_UPDATED
	})
];

const rejectedWalls: SurveyWallRecord[] = [
	{
		...wallRecord(REJECTED.projectN, REJECTED.surveyN, 1, 1, 3600, 2500),
		createdAt: demoDays(18),
		updatedAt: LIVE_UPDATED
	}
];

const rejectedMeasurements: SurveyMeasurementRecord[] = [
	measurementRecord({
		...REJECTED,
		roomN: 1,
		measurementN: 1,
		targetType: 'ceiling_height',
		valueMm: 2500,
		source: 'laser',
		verified: true,
		updatedAt: LIVE_UPDATED
	}),
	measurementRecord({
		...REJECTED,
		roomN: 1,
		measurementN: 2,
		targetType: 'room_length',
		valueMm: 3600,
		source: 'laser',
		verified: true,
		updatedAt: LIVE_UPDATED
	}),
	measurementRecord({
		...REJECTED,
		roomN: 1,
		measurementN: 3,
		targetType: 'room_width',
		valueMm: 3000,
		source: 'laser',
		verified: true,
		updatedAt: LIVE_UPDATED
	})
];

export function seedSurveys(): Record<string, unknown[]> {
	const surveys: SurveyRecord[] = [
		surveyRecord({
			...LIVE,
			surveyorId: SURVEYOR_ID,
			caption: 'Kitchen refurbishment — initial capture',
			status: 'in_progress',
			appointmentAt: demoDays(3)
		}),
		surveyRecord({
			...VERIFIED,
			surveyorId: SURVEYOR_ID,
			caption: 'Principal bedroom and dressing room',
			status: 'verified',
			appointmentAt: demoDays(20),
			submittedAt: demoDays(3),
			verifiedAt: demoDays(1),
			verifiedBy: PM_ID,
			createdAt: demoDays(21),
			updatedAt: VERIFIED_UPDATED
		}),
		surveyRecord({
			...SUBMITTED,
			surveyorId: SURVEYOR_2_ID,
			caption: 'Boot room joinery — re-visit',
			status: 'submitted',
			appointmentAt: demoDays(6),
			submittedAt: demoDays(1),
			createdAt: demoDays(15),
			updatedAt: VERIFIED_UPDATED
		}),
		surveyRecord({
			...REJECTED,
			surveyorId: SURVEYOR_3_ID,
			caption: 'Home office shelving',
			status: 'rejected',
			appointmentAt: demoDays(9),
			submittedAt: demoDays(4),
			rejectedReason:
				'Door width conflicts with the proposed run — re-measure the entrance and resubmit.',
			createdAt: demoDays(19),
			updatedAt: LIVE_UPDATED
		})
	];

	return {
		[COLLECTIONS.surveys]: surveys,
		[COLLECTIONS.surveyRooms]: [
			...liveRooms,
			...verifiedRooms,
			...submittedRooms,
			...rejectedRooms
		],
		[COLLECTIONS.surveyWalls]: [
			...liveWalls,
			...verifiedWalls,
			...submittedWalls,
			...rejectedWalls
		],
		[COLLECTIONS.surveyOpenings]: [...liveOpenings, ...verifiedOpenings, ...submittedOpenings],
		[COLLECTIONS.surveyUtilities]: [...liveUtilities, ...verifiedUtilities],
		[COLLECTIONS.surveyObstacles]: [...liveObstacles, ...verifiedObstacles],
		[COLLECTIONS.surveyMeasurements]: [
			...liveMeasurements,
			...verifiedMeasurements,
			...submittedMeasurements,
			...rejectedMeasurements
		],
		[COLLECTIONS.surveyNotes]: [...liveNotes, ...verifiedNotes]
	};
}
