/** Canonical id type. Every entity id and foreign key is a UUID. */
export type Uuid = string;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Pure runtime guard. Accepts any RFC-4122 UUID version, lowercase. */
export function isUuid(value: unknown): value is Uuid {
	return typeof value === 'string' && UUID_PATTERN.test(value);
}
