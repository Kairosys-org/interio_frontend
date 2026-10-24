import type { CatalogueRepository } from '../repository';
import {
	mockCreateCabinet,
	mockGetCabinet,
	mockListCabinets,
	mockListRules,
	mockListRuleVersions,
	mockSaveParameter,
	mockSaveRule,
	mockSetRuleActive,
	mockUpdateCabinet
} from '../mock';

/** Thin, boring adapter: one line per repository method (architecture §4.7). */
export const mockCatalogueRepository: CatalogueRepository = {
	list: async (params) => mockListCabinets(params),
	get: async (id) => mockGetCabinet(id),
	create: async (input) => mockCreateCabinet(input),
	update: async (id, input) => mockUpdateCabinet(id, input),
	saveParameter: async (cabinetId, input) => mockSaveParameter(cabinetId, input),
	saveRule: async (cabinetId, input) => mockSaveRule(cabinetId, input),
	setRuleActive: async (ruleId, active) => mockSetRuleActive(ruleId, active),
	listRules: async (params) => mockListRules(params),
	listRuleVersions: async () => mockListRuleVersions()
};
