import { COLLECTIONS } from '$shared/data/collections';
import { demoDays } from '$shared/data/demo-clock';
import { DEMO_TENANTS, DEMO_USERS } from '$shared/data/demo-seed';
import { DEMO_PROPERTY_PLAN, demoCustomerId, demoPropertyId } from '$shared/data/demo-record-plan';
import type { PropertyRecord } from '$shared/data/records';

/**
 * Property seed (phase-1 §5.2).
 *
 * Exactly 40 rows from the shared plan so customers and projects keep the same
 * foreign keys. Dates come from the demo clock and ids from `demoPropertyId`,
 * so two resets produce byte-identical data (architecture §4.9).
 */

const TENANT_ID = DEMO_TENANTS[0].id;
const SALES_USER_ID =
	DEMO_USERS.find((user) => user.email === 'sales@opulentinteriors.co.uk')?.id ?? null;

/** Deliberately long (400+ chars) so the detail page and 200% zoom are tested. */
const LONG_ACCESS_NOTES =
	'Access through the side gate on the left of the property. The key safe code is 4821; please return the key to the safe and scramble the dial before leaving. Park on the driveway and keep the gate closed at all times so the dog does not get out. The kitchen is at the rear of the house, and the utility room is through the door beside the pantry. There is no step-free access at the front, so use the side entrance for tools and materials. The client works from home on Tuesdays and Thursdays, so keep noise to a minimum between 9am and 11am. Floor protection is stored in the garage; please lay it before moving any units inside.';

function accessNotesFor(n: number): string | null {
	if (n === 1) return LONG_ACCESS_NOTES;
	if (n === 2) return null;
	if (n % 4 === 0) return 'Key safe beside the side gate. Alarm code on file.';
	if (n % 7 === 0) return 'Dog in the garden on weekdays. Call ahead before arrival.';
	return null;
}

function addressLine2For(n: number): string | null {
	if (n % 6 !== 0) return null;
	return `Flat ${(n % 9) + 1}`;
}

export function seedProperties(): Record<string, unknown[]> {
	const rows: PropertyRecord[] = DEMO_PROPERTY_PLAN.map((plan) => {
		const archived = plan.n === 40;
		return {
			id: demoPropertyId(plan.n),
			tenantId: TENANT_ID,
			customerId: demoCustomerId(plan.customerN),
			addressLine1: plan.addressLine1,
			addressLine2: addressLine2For(plan.n),
			town: plan.town,
			postcode: plan.postcode,
			accessNotes: accessNotesFor(plan.n),
			state: archived ? 'archived' : 'active',
			dedupOfId: null,
			reviewNote: null,
			createdAt: demoDays(100 + plan.n),
			updatedAt: demoDays(40 - plan.n),
			createdBy: SALES_USER_ID,
			archivedAt: archived ? demoDays(5) : null
		};
	});

	return { [COLLECTIONS.properties]: rows };
}
