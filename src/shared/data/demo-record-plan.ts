import { deterministicUuid } from '$shared/lib/deterministic';

/**
 * Shared, orchestrator-owned seed plan for the records spine.
 *
 * Every module seeds from these identities so foreign keys never drift:
 * customer → property → project → assignment. Values are literal (no
 * `Math.random`, no wall clock); dates come from `demoDays` in each seeder.
 * This file holds identities and relationships, not storage records.
 */

export function demoCustomerId(n: number): string {
	return deterministicUuid(`customer:${n}`);
}
export function demoPropertyId(n: number): string {
	return deterministicUuid(`property:${n}`);
}
export function demoProjectId(n: number): string {
	return deterministicUuid(`project:${n}`);
}
export function demoImportBatchId(key: string): string {
	return deterministicUuid(`import-batch:${key}`);
}
export function demoImportRowId(batchKey: string, rowNo: number): string {
	return deterministicUuid(`import-row:${batchKey}:${rowNo}`);
}
export function demoSurveyorId(key: string): string {
	return deterministicUuid(`user:opulent:${key}`);
}

export interface DemoCustomerPlan {
	n: number;
	caption: string;
	contactName: string | null;
	email: string | null;
	phone: string | null;
	town: string | null;
	postcode: string | null;
	preferredChannel: 'email' | 'phone' | 'sms' | 'none';
	/** Held duplicate of an earlier customer (R5 pair). */
	duplicateOf: number | null;
}

const CUSTOMER_SEED: ReadonlyArray<Omit<DemoCustomerPlan, 'n'> & { n?: number }> = [
	{ caption: 'A. Smith', contactName: 'Alice Smith', email: 'alice.smith@example.com', phone: '020 7946 0101', town: 'Richmond', postcode: 'TW9 1AA', preferredChannel: 'email', duplicateOf: null },
	{ caption: 'The Hartley Family', contactName: 'James Hartley', email: 'james.hartley@example.com', phone: '020 7946 0102', town: 'Wimbledon', postcode: 'SW19 2BB', preferredChannel: 'phone', duplicateOf: null },
	{ caption: 'Bramble & Co.', contactName: 'Nina Bramble', email: 'nina@brambleco.example', phone: '020 7946 0103', town: 'Islington', postcode: 'N1 3CC', preferredChannel: 'email', duplicateOf: null },
	{ caption: 'Noah Åkesson', contactName: 'Noah Åkesson', email: 'noah.akesson@example.com', phone: '020 7946 0104', town: 'Hackney', postcode: 'E8 4DD', preferredChannel: 'sms', duplicateOf: null },
	{ caption: 'Priya Raman', contactName: 'Priya Raman', email: 'priya.raman@example.com', phone: '020 7946 0105', town: 'Harrow', postcode: 'HA1 5EE', preferredChannel: 'email', duplicateOf: null },
	{ caption: 'The Okonkwo Household', contactName: 'Chidi Okonkwo', email: 'chidi.okonkwo@example.com', phone: '020 7946 0106', town: 'Lewisham', postcode: 'SE13 6FF', preferredChannel: 'phone', duplicateOf: null },
	{ caption: 'Marlow Street Studio', contactName: 'Eve Marlow', email: 'eve@marlowstudio.example', phone: '020 7946 0107', town: 'Bethnal Green', postcode: 'E2 7GG', preferredChannel: 'email', duplicateOf: null },
	{ caption: 'Dr. Yusuf Demir', contactName: 'Yusuf Demir', email: 'yusuf.demir@example.com', phone: '020 7946 0108', town: 'Ealing', postcode: 'W5 8HH', preferredChannel: 'email', duplicateOf: null },
	{ caption: 'The Lindqvist Family', contactName: 'Astrid Lindqvist', email: 'astrid.lindqvist@example.com', phone: '020 7946 0109', town: 'Greenwich', postcode: 'SE10 9JJ', preferredChannel: 'phone', duplicateOf: null },
	{ caption: 'Harbour View Apartments', contactName: 'Marta Silva', email: 'marta@harbourview.example', phone: '020 7946 0110', town: 'Canary Wharf', postcode: 'E14 1KK', preferredChannel: 'email', duplicateOf: null },
	{ caption: 'Oliver & Grace Bennett', contactName: 'Grace Bennett', email: 'grace.bennett@example.com', phone: '020 7946 0111', town: 'Clapham', postcode: 'SW4 2LL', preferredChannel: 'phone', duplicateOf: null },
	{ caption: 'Kenji Watanabe', contactName: 'Kenji Watanabe', email: 'kenji.watanabe@example.com', phone: '020 7946 0112', town: 'Acton', postcode: 'W3 3MM', preferredChannel: 'email', duplicateOf: null },
	{ caption: 'The Ferreira Family', contactName: 'Ines Ferreira', email: 'ines.ferreira@example.com', phone: '020 7946 0113', town: 'Putney', postcode: 'SW15 4NN', preferredChannel: 'sms', duplicateOf: null },
	{ caption: 'Maya Chowdhury', contactName: 'Maya Chowdhury', email: null, phone: '020 7946 0114', town: 'Whitechapel', postcode: 'E1 5PP', preferredChannel: 'phone', duplicateOf: null },
	{ caption: 'The Whitmore Trust', contactName: 'Hugh Whitmore', email: 'hugh@whitmoretrust.example', phone: null, town: 'Kensington', postcode: 'W8 6QQ', preferredChannel: 'email', duplicateOf: null },
	{ caption: 'Elena Petrova', contactName: 'Elena Petrova', email: 'elena.petrova@example.com', phone: '020 7946 0116', town: 'Hampstead', postcode: 'NW3 7RR', preferredChannel: 'email', duplicateOf: null },
	{ caption: 'The Nakamura Family', contactName: 'Sora Nakamura', email: 'sora.nakamura@example.com', phone: '020 7946 0117', town: 'Croydon', postcode: 'CR0 8SS', preferredChannel: 'phone', duplicateOf: null },
	{ caption: 'Oak & Linen Interiors', contactName: 'Rosa Klein', email: 'rosa@oakandlinen.example', phone: '020 7946 0118', town: 'Shoreditch', postcode: 'EC2 9TT', preferredChannel: 'email', duplicateOf: null },
	{ caption: 'Thomas Ashford', contactName: 'Thomas Ashford', email: 'thomas.ashford@example.com', phone: null, town: 'Fulham', postcode: 'SW6 1UU', preferredChannel: 'none', duplicateOf: null },
	{ caption: 'The Mensah Family', contactName: 'Abena Mensah', email: 'abena.mensah@example.com', phone: '020 7946 0120', town: 'Peckham', postcode: 'SE15 2VV', preferredChannel: 'phone', duplicateOf: null },
	{ caption: 'Isabelle Laurent', contactName: 'Isabelle Laurent', email: 'isabelle.laurent@example.com', phone: '020 7946 0121', town: 'Notting Hill', postcode: 'W11 3WW', preferredChannel: 'email', duplicateOf: null },
	{ caption: 'The Rossi Family', contactName: 'Marco Rossi', email: 'marco.rossi@example.com', phone: '020 7946 0122', town: 'Battersea', postcode: 'SW11 4XX', preferredChannel: 'phone', duplicateOf: null },
	{ caption: 'A. Smith', contactName: 'Alice Smith', email: null, phone: '020 7946 0101', town: 'Richmond', postcode: 'TW9 1AA', preferredChannel: 'email', duplicateOf: 1 },
	{ caption: 'The Hartley Family', contactName: 'J. Hartley', email: 'james.hartley@example.com', phone: null, town: 'Wimbledon', postcode: 'SW19 2BB', preferredChannel: 'phone', duplicateOf: 2 }
];

export const DEMO_CUSTOMER_PLAN: readonly DemoCustomerPlan[] = CUSTOMER_SEED.map((entry, index) => ({
	...entry,
	n: index + 1
}));

const STREETS = [
	'Oak Street', 'Elm Road', 'Cedar Avenue', 'Maple Close', 'Willow Lane',
	'Birch Way', 'Ash Grove', 'Linden Gardens', 'Chestnut Rise', 'Hawthorn Walk'
] as const;
const TOWNS = ['Richmond', 'Wimbledon', 'Islington', 'Hackney', 'Harrow', 'Lewisham', 'Ealing', 'Greenwich'] as const;
const POSTCODES = ['TW9 1AA', 'SW19 2BB', 'N1 3CC', 'E8 4DD', 'HA1 5EE', 'SE13 6FF', 'W5 8HH', 'SE10 9JJ'] as const;

export interface DemoPropertyPlan {
	n: number;
	customerN: number;
	addressLine1: string;
	town: string;
	postcode: string;
}

export const DEMO_PROPERTY_PLAN: readonly DemoPropertyPlan[] = Array.from({ length: 40 }, (_, index) => {
	const n = index + 1;
	const customerN = ((index % 22) + 1);
	return {
		n,
		customerN,
		addressLine1: `${n} ${STREETS[index % STREETS.length]}`,
		town: TOWNS[index % TOWNS.length],
		postcode: POSTCODES[index % POSTCODES.length]
	};
});

const PROJECT_CAPTIONS = [
	'Kitchen renovation', 'Principal bedroom', 'Family bathroom', 'Whole-house joinery',
	'Boot room and utility', 'Home office', 'Dining room panelling', 'Guest bedroom',
	'Kitchen and pantry', 'Loft wardrobe', 'Bathroom vanity', 'Commercial reception',
	'Garden room', 'Nursery', 'Media wall', 'Kitchen extension', 'Dressing room', 'Library shelving'
] as const;
const PROJECT_TYPES = ['kitchen', 'bedroom', 'bathroom', 'whole_house', 'other', 'kitchen', 'commercial', 'bedroom', 'kitchen', 'bedroom', 'bathroom', 'commercial', 'other', 'bedroom', 'other', 'kitchen', 'bedroom', 'other'] as const;
const PROJECT_STATUSES = ['active', 'active', 'active', 'on_hold', 'active', 'completed', 'active', 'active', 'active', 'on_hold', 'cancelled', 'active', 'completed', 'active', 'completed', 'on_hold', 'completed', 'cancelled'] as const;

export interface DemoProjectPlan {
	n: number;
	propertyN: number;
	customerN: number;
	caption: string;
	projectType: string;
	status: string;
	reference: string;
}

export const DEMO_PROJECT_PLAN: readonly DemoProjectPlan[] = Array.from({ length: 18 }, (_, index) => {
	const n = index + 1;
	const property = DEMO_PROPERTY_PLAN[index];
	return {
		n,
		propertyN: property.n,
		customerN: property.customerN,
		caption: PROJECT_CAPTIONS[index],
		projectType: PROJECT_TYPES[index],
		status: PROJECT_STATUSES[index],
		reference: `OIG-2026-${String(n).padStart(4, '0')}`
	};
});

export const DEMO_SURVEYOR_KEYS = [
	'surveyor',
	'surveyor-2',
	'surveyor-3',
	'surveyor-4',
	'surveyor-5',
	'surveyor-6'
] as const;

/** Every project has at least one surveyor; the pool rotates so filters differ. */
export const DEMO_PROJECT_ASSIGNMENT_PLAN: ReadonlyArray<{ projectN: number; surveyorKey: string }> =
	DEMO_PROJECT_PLAN.flatMap((project) => {
		const first = DEMO_SURVEYOR_KEYS[(project.n - 1) % DEMO_SURVEYOR_KEYS.length];
		const assignments = [{ projectN: project.n, surveyorKey: first }];
		if (project.n % 5 === 0) {
			assignments.push({
				projectN: project.n,
				surveyorKey: DEMO_SURVEYOR_KEYS[(project.n + 2) % DEMO_SURVEYOR_KEYS.length]
			});
		}
		return assignments;
	});
