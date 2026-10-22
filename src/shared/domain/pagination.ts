/**
 * Page shape returned by every list repository. The UI renders "Load more"
 * (DESIGN §9.3) while the URL keeps the page number, so reload restores the
 * view without a cursor becoming part of the address.
 */
export interface Page<T> {
	items: T[];
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
	hasMore: boolean;
}

export interface PageParams {
	page?: number;
	pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function normalisePageParams(params: PageParams = {}): { page: number; pageSize: number } {
	const page = Number.isInteger(params.page) && (params.page ?? 0) > 0 ? (params.page as number) : 1;
	const requested = Number.isInteger(params.pageSize) ? (params.pageSize as number) : DEFAULT_PAGE_SIZE;
	const pageSize = Math.min(Math.max(requested, 1), MAX_PAGE_SIZE);
	return { page, pageSize };
}

export function toPage<T>(all: readonly T[], params: PageParams = {}): Page<T> {
	const { page, pageSize } = normalisePageParams(params);
	const total = all.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const safePage = Math.min(page, totalPages);
	const start = (safePage - 1) * pageSize;
	const items = all.slice(start, start + pageSize);
	return {
		items,
		page: safePage,
		pageSize,
		total,
		totalPages,
		hasMore: safePage < totalPages
	};
}
