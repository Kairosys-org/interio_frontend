export const COLLECTIONS = {
	appUsers: 'app_users',
	tenants: 'tenants',
	permissions: 'permissions',
	userInvitations: 'user_invitations',
	platformAuditEvents: 'platform_audit_events',
	auditEvents: 'audit_events',
	customers: 'customers',
	properties: 'properties',
	projects: 'projects',
	projectUsers: 'project_users',
	importBatches: 'import_batches',
	importRows: 'import_rows',
	// Phase 2 — survey capture, media and the offline outbox.
	surveys: 'survey',
	surveyRooms: 'survey_room',
	surveyWalls: 'survey_wall',
	surveyOpenings: 'survey_opening',
	surveyUtilities: 'survey_utility',
	surveyObstacles: 'survey_obstacle',
	surveyMeasurements: 'survey_measurement',
	surveyNotes: 'survey_note',
	assets: 'asset',
	syncOperations: 'sync_operation'
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
export type CollectionKey = keyof typeof COLLECTIONS;
