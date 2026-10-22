import type { Uuid } from './uuid';

/**
 * R5 duplicate prevention, shared by customers, properties, projects,
 * duplicates and imports so every create path applies exactly the same keys.
 *
 * The matching rule is the documented default from phase-1 §9.1, narrowed to
 * the spec's dedup keys (Part 5 §4.1–§4.3): a candidate matches when the
 * normalised caption/address key is equal AND at least one contact key is
 * equal. Nothing fuzzy, nothing cross-tenant, never an automatic merge.
 */

export type DedupEntityType = 'customer' | 'property' | 'project';
export type DedupDecision = 'link_to_existing' | 'confirm_distinct';

export interface DedupReviewInput {
	decision: DedupDecision;
	targetId: Uuid | null;
	reviewNote: string;
}

export interface DedupCandidateRef {
	id: Uuid;
	entityType: DedupEntityType;
	caption: string;
	createdAt: string;
	matchReasons: string[];
}

export interface DedupConflictDetails {
	entityType: DedupEntityType;
	heldId: Uuid;
	candidates: DedupCandidateRef[];
}

export function normaliseEmail(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const normalised = value.trim().toLowerCase();
	return normalised.length > 0 ? normalised : null;
}

/** Digits only, exactly as the spec stores it (Part 5 §4.1). */
export function normalisePhone(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const digits = value.replace(/\D+/g, '');
	return digits.length > 0 ? digits : null;
}

/** Uppercase, single spaces, with the standard space before the inward code. */
export function normalisePostcode(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const compact = value.trim().toUpperCase().replace(/\s+/g, '');
	if (compact.length < 5) return compact.length > 0 ? compact : null;
	return `${compact.slice(0, compact.length - 3)} ${compact.slice(-3)}`;
}

/** Case/space-insensitive display caption used for matching only. */
export function normaliseCaption(value: string | null | undefined): string {
	return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Street line normalisation for property matching (postcode + line 1). */
export function normaliseAddressLine(value: string | null | undefined): string {
	return normaliseCaption(value);
}

export interface CustomerMatchFields {
	caption: string;
	email: string | null;
	phone: string | null;
	postcode: string | null;
}

/** `caption` AND (postcode OR phone OR email) — spec Part 5 §4.1. */
export function customerMatchReasons(
	candidate: CustomerMatchFields,
	existing: CustomerMatchFields
): string[] {
	if (normaliseCaption(candidate.caption) !== normaliseCaption(existing.caption)) return [];

	const reasons: string[] = [];
	const pairs: Array<[string, string | null, string | null]> = [
		['Postcode', normalisePostcode(candidate.postcode), normalisePostcode(existing.postcode)],
		['Phone', normalisePhone(candidate.phone), normalisePhone(existing.phone)],
		['Email', normaliseEmail(candidate.email), normaliseEmail(existing.email)]
	];
	for (const [label, left, right] of pairs) {
		if (left !== null && right !== null && left === right) reasons.push(`${label} matches`);
	}
	return reasons;
}

export interface PropertyMatchFields {
	addressLine1: string;
	postcode: string | null;
}

/** `postcode + address_line1` — spec Part 5 §4.2. */
export function propertyMatchReasons(
	candidate: PropertyMatchFields,
	existing: PropertyMatchFields
): string[] {
	const postcode = normalisePostcode(candidate.postcode);
	const otherPostcode = normalisePostcode(existing.postcode);
	const line = normaliseAddressLine(candidate.addressLine1);
	const otherLine = normaliseAddressLine(existing.addressLine1);

	if (postcode === null || otherPostcode === null || line.length === 0) return [];
	const reasons: string[] = [];
	if (postcode === otherPostcode) reasons.push('Postcode matches');
	if (line === otherLine) reasons.push('Address line 1 matches');
	// Both keys must match for a property duplicate.
	return reasons.length === 2 ? reasons : [];
}

export interface ProjectMatchFields {
	propertyId: Uuid;
	projectType: string;
	caption: string;
}

/** `property_id + project_type + lower(caption)` — spec Part 5 §4.3. */
export function projectMatchReasons(
	candidate: ProjectMatchFields,
	existing: ProjectMatchFields
): string[] {
	if (candidate.propertyId !== existing.propertyId) return [];
	if (candidate.projectType !== existing.projectType) return [];
	if (normaliseCaption(candidate.caption) !== normaliseCaption(existing.caption)) return [];
	return ['Same property', 'Same project type', 'Caption matches'];
}

export const DEDUP_NOTE_REQUIRED = 'Add a note explaining why this is a different record.';
export const DEDUP_ALREADY_REVIEWED = 'This record has already been reviewed.';
export const DEDUP_TARGET_NOT_FOUND = 'The record you chose to link to no longer exists.';
export const DEDUP_TARGET_INVALID = 'Choose an existing record to link to.';
