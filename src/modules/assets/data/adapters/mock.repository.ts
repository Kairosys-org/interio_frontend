import type { AssetsRepository } from '../repository';
import {
	mockAssetSignedUrl,
	mockCompleteAsset,
	mockGetAsset,
	mockInitAsset,
	mockListAssets,
	mockSetAssetState
} from '../mock';

/** Thin, boring adapter: one line per repository method (architecture §4.7). */
export const mockAssetsRepository: AssetsRepository = {
	list: async (params) => mockListAssets(params),
	get: async (id) => mockGetAsset(id),
	init: async (input) => mockInitAsset(input),
	complete: async (id, input) => mockCompleteAsset(id, input),
	setState: async (id, input) => mockSetAssetState(id, input),
	signedUrl: async (id) => mockAssetSignedUrl(id)
};
