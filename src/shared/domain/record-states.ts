/**
 * Canonical record states shared by the records spine (spec Part 4 §1) and
 * the import pipeline (spec Part 10 §26). These are the only values the mock
 * backend accepts; presentation maps them through the central state-chip map.
 */

export const CUSTOMER_STATES = ['active', 'pending_review', 'archived', 'cancelled'] as const;
export type CustomerState = (typeof CUSTOMER_STATES)[number];

/** Properties use the same extended archival states as customers (R5 hold). */
export type PropertyState = CustomerState;

export const CUSTOMER_SOURCES = ['survey', 'referral', 'walk_in', 'other', 'crm_lead'] as const;
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];

/**
 * Spec Part 5 §4.1 enumerates `email | phone | sms | none`. Phase 1 §9.7
 * suggests `email | phone | whatsapp | post`. The spec outranks the phase
 * plan, so the spec list is implemented and the difference is reported.
 */
export const PREFERRED_CHANNELS = ['email', 'phone', 'sms', 'none'] as const;
export type PreferredChannel = (typeof PREFERRED_CHANNELS)[number];

export const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_TYPES = [
	'kitchen',
	'bedroom',
	'bathroom',
	'whole_house',
	'commercial',
	'other'
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const IMPORT_KINDS = ['customer', 'property', 'project'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const IMPORT_STATUSES = ['staged', 'committed', 'cancelled'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/** Final per-row outcome, written when a batch is committed. */
export const IMPORT_OUTCOMES = ['imported', 'needs_review', 'rejected'] as const;
export type ImportOutcome = (typeof IMPORT_OUTCOMES)[number];

/** Validation result computed while the batch is staged. */
export const IMPORT_VALIDATIONS = ['ready', 'needs_review', 'rejected'] as const;
export type ImportValidation = (typeof IMPORT_VALIDATIONS)[number];

export const PROJECT_TYPE_LABELS: Readonly<Record<ProjectType, string>> = Object.freeze({
	kitchen: 'Kitchen',
	bedroom: 'Bedroom',
	bathroom: 'Bathroom',
	whole_house: 'Whole house',
	commercial: 'Commercial',
	other: 'Other'
});

export const PREFERRED_CHANNEL_LABELS: Readonly<Record<PreferredChannel, string>> = Object.freeze({
	email: 'Email',
	phone: 'Phone',
	sms: 'SMS',
	none: 'No preference'
});

export const CUSTOMER_SOURCE_LABELS: Readonly<Record<CustomerSource, string>> = Object.freeze({
	survey: 'Survey',
	referral: 'Referral',
	walk_in: 'Walk-in',
	other: 'Other',
	crm_lead: 'CRM lead'
});

/* ------------------------------------------------------------------ */
/* Phase 2 — survey, asset upload and sync states.                     */
/* Part 4 §2 (survey machine), Part 9 §12 (upload state), §13 (queue). */
/* ------------------------------------------------------------------ */

export const SURVEY_STATES = [
	'draft',
	'in_progress',
	'submitted',
	'verified',
	'rejected',
	'cancelled'
] as const;
export type SurveyState = (typeof SURVEY_STATES)[number];

export const ASSET_UPLOAD_STATES = ['pending', 'uploading', 'complete', 'failed'] as const;
export type AssetUploadState = (typeof ASSET_UPLOAD_STATES)[number];

/** Outbox rows survive a reload, so `sending` must be recoverable too. */
export const SYNC_OP_STATES = ['queued', 'sending', 'sent', 'failed', 'conflict'] as const;
export type SyncOpState = (typeof SYNC_OP_STATES)[number];

/* ------------------------------------------------------------------ */
/* Phase 3 — catalogue and materials (Part 5 §4.30–§4.31, Part 8).     */
/* These are the only values the mock backend and import mapper accept. */
/* ------------------------------------------------------------------ */

export const CABINET_FAMILIES = [
	'base',
	'wall',
	'tall',
	'sink',
	'drawer',
	'corner',
	'appliance',
	'wardrobe',
	'drawer_chest',
	'shelving',
	'custom'
] as const;
export type CabinetFamily = (typeof CABINET_FAMILIES)[number];

export const CONSTRUCTION_METHODS = ['cam_lock', 'dowel', 'confirmat', 'custom'] as const;
export type ConstructionMethod = (typeof CONSTRUCTION_METHODS)[number];

/** `enum`, `bool` and `text` carry no numeric bounds (Part 5 §4.30). */
export const CABINET_PARAMETER_UNITS = ['mm', 'count', 'enum', 'bool', 'text'] as const;
export type CabinetParameterUnit = (typeof CABINET_PARAMETER_UNITS)[number];

export const DECOR_COLOUR_FAMILIES = [
	'white',
	'grey',
	'black',
	'beige',
	'brown',
	'wood_tone',
	'blue',
	'green',
	'red',
	'other'
] as const;
export type DecorColourFamily = (typeof DECOR_COLOUR_FAMILIES)[number];

export const DECOR_MATERIAL_TYPES = [
	'melamine_board',
	'mdf',
	'plywood',
	'veneer',
	'lacquer',
	'acrylic',
	'glass',
	'metal',
	'stone',
	'other'
] as const;
export type DecorMaterialType = (typeof DECOR_MATERIAL_TYPES)[number];

export const DECOR_CORES = ['chipboard', 'mdf', 'plywood', 'other'] as const;
export type DecorCore = (typeof DECOR_CORES)[number];

export const GRAIN_DIRECTIONS = ['along_length', 'along_width', 'none'] as const;
export type GrainDirection = (typeof GRAIN_DIRECTIONS)[number];

export const PREMIUM_TIERS = ['standard', 'premium', 'luxury'] as const;
export type PremiumTier = (typeof PREMIUM_TIERS)[number];

export const MATERIAL_STATUSES = ['active', 'discontinued'] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const EDGING_MATCH_TYPES = ['exact', 'complementary', 'alt'] as const;
export type EdgingMatchType = (typeof EDGING_MATCH_TYPES)[number];
