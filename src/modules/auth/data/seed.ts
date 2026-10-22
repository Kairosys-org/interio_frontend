import { DEMO_INVITATION, DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import type { AppUserRecord, TenantRecord, UserInvitationRecord } from '$shared/data/records';

/**
 * Deterministic auth seed (architecture §4.9).
 *
 * Every row comes from the orchestrator-owned `demo-seed.ts`, so ids, names
 * and credentials stay identical across modules. This file owns no values of
 * its own and never generates ids: `data/mock.ts` registers these arrays.
 */

export const seededTenants: readonly TenantRecord[] = DEMO_TENANTS;

export const seededUsers: readonly AppUserRecord[] = DEMO_USERS;

export const seededInvitations: readonly UserInvitationRecord[] = [DEMO_INVITATION];
