import { ApiError, ApiErrorCode, isApiError, nextRequestId } from './errors';

const DEFAULT_MOCK_LATENCY_MS = 350;

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, Math.max(0, ms));
	});
}

export interface MockRequestOptions {
	latencyMs?: number;
	requestId?: string;
}

function configuredLatencyMs(): number | null {
	const configured = import.meta.env.PUBLIC_MOCK_LATENCY_MS;
	if (configured === undefined || configured === '') return null;
	const parsed = Number(configured);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resolveLatency(options?: MockRequestOptions): number {
	if (options?.latencyMs !== undefined) return Math.max(0, options.latencyMs);
	return configuredLatencyMs() ?? DEFAULT_MOCK_LATENCY_MS;
}

/** Turns anything thrown by an operation into a normalized `ApiError`. */
export function normalizeApiError(error: unknown): ApiError {
	if (isApiError(error)) return error;
	return new ApiError({
		code: ApiErrorCode.NETWORK_ERROR,
		status: 500,
		message:
			error instanceof Error && error.message.length > 0
				? error.message
				: 'The request failed unexpectedly. Please try again.',
		requestId: nextRequestId(),
		details:
			error instanceof Error ? { name: error.name, message: error.message } : { value: String(error) }
	});
}

/**
 * Simulates a backend round-trip: artificial latency, then the operation.
 * Any non-`ApiError` failure is normalized so callers only handle one shape.
 */
export async function mockRequest<T>(
	operation: () => T | Promise<T>,
	options?: MockRequestOptions
): Promise<T> {
	const latency = resolveLatency(options);
	if (latency > 0) await delay(latency);

	try {
		return await operation();
	} catch (error) {
		throw normalizeApiError(error);
	}
}
