import { ApiError, ApiErrorCode } from '$network/errors';

export function createDataSourceUnavailableError(moduleName: string): ApiError {
	return new ApiError({
		code: ApiErrorCode.API_DATA_SOURCE_NOT_AVAILABLE,
		status: 501,
		message: `The API data source for "${moduleName}" is not available yet. Set PUBLIC_DATA_SOURCE=mock or connect the backend.`
	});
}
