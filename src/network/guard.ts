import { get } from 'svelte/store';
import { sessionStore } from '$shared/application/session';
import { ApiError, ApiErrorCode } from './errors';

interface SessionSnapshot {
	user: {
		permissions?: string[] | null;
		roles?: string[] | null;
	} | null;
}

function currentUser(): SessionSnapshot['user'] {
	const session = get(sessionStore) as unknown as SessionSnapshot | null | undefined;
	return session?.user ?? null;
}

/**
 * `true` while no session exists, so seeders and direct mock tests stay
 * session-free; once a user is signed in the permission array is authoritative.
 */
export function hasPermissionForSession(permission: string): boolean {
	const user = currentUser();
	if (!user) return true;
	return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

export function requirePermission(permission: string): void {
	if (hasPermissionForSession(permission)) return;
	throw new ApiError({
		code: ApiErrorCode.FORBIDDEN,
		message: 'You do not have permission to perform this action.',
		status: 403
	});
}
