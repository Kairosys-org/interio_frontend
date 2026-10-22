export const COLLECTIONS = {
	appUsers: 'app_users',
	tenants: 'tenants',
	permissions: 'permissions',
	userInvitations: 'user_invitations',
	platformAuditEvents: 'platform_audit_events',
	auditEvents: 'audit_events'
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
export type CollectionKey = keyof typeof COLLECTIONS;
