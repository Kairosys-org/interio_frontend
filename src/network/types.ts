export interface Paginated<T> {
	items: T[];
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}

export interface ApiResponse<T> {
	data: T;
	requestId?: string;
}

export interface ApiErrorBody {
	error: {
		code: string;
		message: string;
		details?: unknown;
	};
}
