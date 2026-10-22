/**
 * Normalized transport error. Every failure that crosses the repository or
 * network boundary must be an `ApiError` with a stable code, so presentation
 * can branch on `err.code` and show `err.message`.
 */
export const ApiErrorCode = {
	NETWORK_ERROR: 'network_error',
	NOT_FOUND: 'not_found',
	UNAUTHORIZED: 'unauthorized',
	FORBIDDEN: 'forbidden',
	VALIDATION: 'validation',
	CONFLICT: 'conflict',
	TOKEN_EXPIRED: 'token_expired',
	API_DATA_SOURCE_NOT_AVAILABLE: 'api_data_source_not_available',
	WORKSPACE_REQUIRED: 'workspace_required',
	MFA_REQUIRED: 'mfa_required',
	GATE_BLOCKED: 'gate_blocked',
	STATE_CONFLICT: 'state_conflict'
} as const;

export type ApiErrorCodeValue = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export interface ApiErrorInit {
	code: string;
	message: string;
	status?: number;
	category?: string;
	fieldErrors?: Record<string, string>;
	requestId?: string;
	details?: unknown;
}

export class ApiError extends Error {
	readonly code: string;
	readonly status: number;
	readonly category?: string;
	readonly fieldErrors?: Record<string, string>;
	readonly requestId?: string;
	readonly details?: unknown;

	constructor(init: ApiErrorInit) {
		super(init.message);
		this.name = 'ApiError';
		this.code = init.code;
		this.status = init.status ?? 400;
		this.category = init.category;
		this.fieldErrors = init.fieldErrors;
		this.requestId = init.requestId;
		this.details = init.details;
	}

	isNotFound(): boolean {
		return this.status === 404 || this.code === ApiErrorCode.NOT_FOUND;
	}

	isUnauthorized(): boolean {
		return (
			this.status === 401 ||
			this.code === ApiErrorCode.UNAUTHORIZED ||
			this.code === ApiErrorCode.TOKEN_EXPIRED
		);
	}

	isForbidden(): boolean {
		return this.status === 403 || this.code === ApiErrorCode.FORBIDDEN;
	}

	toJSON(): { code: string; message: string; status: number; details?: unknown } {
		const json: { code: string; message: string; status: number; details?: unknown } = {
			code: this.code,
			message: this.message,
			status: this.status
		};
		if (this.details !== undefined) json.details = this.details;
		return json;
	}
}

export function isApiError(value: unknown): value is ApiError {
	return value instanceof ApiError;
}

let requestCounter = 0;

/** Correlation id shared by logs, toasts and backend traces. */
export function nextRequestId(): string {
	requestCounter += 1;
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `req-${requestCounter.toString().padStart(6, '0')}`;
}
