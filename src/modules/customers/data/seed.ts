import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import { DEMO_CUSTOMER_PLAN, demoCustomerId } from '$shared/data/demo-record-plan';
import { DEMO_TENANTS } from '$shared/data/demo-seed';
import type { CustomerRecord } from '$shared/data/records';
import { normaliseEmail, normalisePhone, normalisePostcode } from '$shared/domain/dedup';
import { deterministicUuid } from '$shared/lib/deterministic';

/**
 * Customer seed: exactly the 24 identities in the shared demo plan, so
 * properties and projects point at real customers.
 *
 * Deterministic by construction: ids from `demoCustomerId`, dates from
 * `demoDays`, no `Math.random()` and no `Date.now()`. Rows 23 and 24 are the
 * held duplicate pair (R5); row 22 is the archived example.
 */

const TENANT_ID = DEMO_TENANTS[0].id;
const CREATED_BY = deterministicUuid('user:opulent:sales');

/** 360 days old down to 3 days old, oldest to newest. */
function createdDaysFor(n: number): number {
	return 360 - Math.floor(((n - 1) * 357) / 23);
}

function updatedDaysFor(n: number): number {
	return Math.max(0, createdDaysFor(n) - (n % 5));
}

function seedCustomer(plan: (typeof DEMO_CUSTOMER_PLAN)[number]): CustomerRecord {
	const createdAt = demoDays(createdDaysFor(plan.n));
	const archivedAt = plan.n === 22 ? demoDays(10) : null;
	const held = plan.duplicateOf !== null;

	return {
		id: demoCustomerId(plan.n),
		tenantId: TENANT_ID,
		caption: plan.caption,
		contactName: plan.contactName,
		email: normaliseEmail(plan.email),
		phone: normalisePhone(plan.phone),
		addressLine1: null,
		addressLine2: null,
		town: plan.town,
		postcode: normalisePostcode(plan.postcode),
		preferredChannel: plan.preferredChannel,
		source: 'survey',
		leadUuid: null,
		state: held ? 'pending_review' : plan.n === 22 ? 'archived' : 'active',
		dedupOfId: plan.duplicateOf !== null ? demoCustomerId(plan.duplicateOf) : null,
		reviewNote: null,
		createdAt,
		updatedAt: archivedAt ?? demoDays(updatedDaysFor(plan.n)),
		createdBy: CREATED_BY,
		archivedAt
	};
}

export const seededCustomers: readonly CustomerRecord[] = DEMO_CUSTOMER_PLAN.map(seedCustomer);

/** Registered by `data/mock.ts` through `registerSeeder`. */
export function seedCustomers(): Record<string, unknown[]> {
	return { [COLLECTIONS.customers]: seededCustomers.map((customer) => ({ ...customer })) };
}
