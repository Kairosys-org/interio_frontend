import { get } from 'svelte/store';
import { sessionStore } from '$shared/application/session';
import type { SessionUser } from '$shared/domain/user';
import type { Uuid } from '$shared/domain/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { hasPermissionForSession } from '$network/guard';

/**
 * Server-side session rules for mock repositories (architecture §8).
 *
 * Every records-spine collection is tenant-scoped: a mock call reads the
 * tenant from the session, never from client input, and refuses a platform
 * user. Direct mock tests sign in first, exactly like the app does.
 */

export interface TenantSession {
	user: SessionUser;
	tenantId: Uuid;
}

export function requireTenantSession(permission?: string): TenantSession {
	const user = get(sessionStore).user;
	if (!user) {
		throw new ApiError({
			code: ApiErrorCode.UNAUTHORIZED,
			status: 401,
			message: 'Sign in to continue.'
		});
	}
	if (user.platform === true || !user.tenant) {
		throw new ApiError({
			code: ApiErrorCode.FORBIDDEN,
			status: 403,
			message: 'This area belongs to a tenant workspace.'
		});
	}
	if (permission && !hasPermissionForSession(permission)) {
		throw new ApiError({
			code: ApiErrorCode.FORBIDDEN,
			status: 403,
			message: 'You do not have permission to perform this action.'
		});
	}
	return { user, tenantId: user.tenant.id };
}

export function currentSessionUser(): SessionUser | null {
	return get(sessionStore).user;
}
