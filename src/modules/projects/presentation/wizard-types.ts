/**
 * Shared types and copy for the new-project wizard (ui-ux §8.7, DESIGN §10.2).
 *
 * The page owns the wizard state; step components only render one decision and
 * report a choice back. Labels live here so the review step and the pickers
 * always describe the same record.
 */

export interface CustomerChoice {
	id: string;
	caption: string;
	email: string | null;
}

export interface PropertyChoice {
	id: string;
	customerId: string;
	label: string;
	postcode: string | null;
}

export interface WizardStepDefinition {
	id: string;
	label: string;
	description: string;
}

export const PROJECT_WIZARD_STEPS: readonly WizardStepDefinition[] = Object.freeze([
	{ id: 'customer', label: 'Customer', description: 'Who the project is for.' },
	{ id: 'property', label: 'Property', description: 'Where the work happens.' },
	{ id: 'details', label: 'Project', description: 'Caption and project type.' },
	{ id: 'surveyors', label: 'Surveyors', description: 'Who can survey the property.' },
	{ id: 'review', label: 'Review', description: 'Check the details, then create.' }
]);

export const REVIEW_STEP = PROJECT_WIZARD_STEPS.length - 1;

interface AddressParts {
	addressLine1: string;
	addressLine2: string | null;
	town: string | null;
	postcode: string | null;
}

/** One display label for an address, used by pickers, review and the hub. */
export function formatAddress(address: AddressParts): string {
	const parts = [address.addressLine1, address.addressLine2, address.town, address.postcode].filter(
		(part): part is string => typeof part === 'string' && part.trim().length > 0
	);
	return parts.join(', ');
}

export function propertyChoiceFrom(
	row: AddressParts & { id: string; customerId: string }
): PropertyChoice {
	return {
		id: row.id,
		customerId: row.customerId,
		label: formatAddress(row),
		postcode: row.postcode
	};
}
