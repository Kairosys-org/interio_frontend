import { COLLECTIONS } from '$shared/data/collections';
import { DEMO_PLATFORM_AUDIT } from '$shared/data/demo-seed';
import type { AuditEventRecord } from '$shared/data/records';

/**
 * Platform-module seed: `platform_audit_events` only.
 *
 * `tenants`, `app_users` and `user_invitations` are seeded by the auth module.
 * Seeding them here too would duplicate the demo world. Dates and ids come from
 * the shared demo clock and `DEMO_PLATFORM_AUDIT`, so the rows are identical on
 * every run (architecture §4.9).
 */
export function seedPlatformAudit(): Record<string, unknown[]> {
	const rows: AuditEventRecord[] = DEMO_PLATFORM_AUDIT.map((event) => ({
		...event,
		payload: event.payload ? { ...event.payload } : null
	}));
	return { [COLLECTIONS.platformAuditEvents]: rows };
}
