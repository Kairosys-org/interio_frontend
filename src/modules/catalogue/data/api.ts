import { apiCall } from '$network/api';
import { requirePermission } from '$network/guard';
import { PERMISSIONS } from '$shared/domain/permissions';
import type {
	CabinetListParams,
	CabinetParameterInput,
	CabinetRuleInput,
	CabinetRuleListParams,
	CreateCabinetInput,
	UpdateCabinetInput
} from '../domain/types';
import { getCatalogueRepository } from './repository-provider';

const READ = { latencyMs: 180 } as const;
const WRITE = { latencyMs: 300 } as const;

/** The only surface presentation may call (architecture §3, §4.5). */
export const catalogueApi = {
	list(params: CabinetListParams = {}) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CABINET_VIEW);
			return getCatalogueRepository().list(params);
		}, READ);
	},

	get(id: string) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CABINET_VIEW);
			return getCatalogueRepository().get(id);
		}, READ);
	},

	create(input: CreateCabinetInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CABINET_CREATE);
			return getCatalogueRepository().create(input);
		}, WRITE);
	},

	update(id: string, input: UpdateCabinetInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CABINET_UPDATE);
			return getCatalogueRepository().update(id, input);
		}, WRITE);
	},

	saveParameter(cabinetId: string, input: CabinetParameterInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CABINET_UPDATE);
			return getCatalogueRepository().saveParameter(cabinetId, input);
		}, WRITE);
	},

	saveRule(cabinetId: string, input: CabinetRuleInput) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CABINET_UPDATE);
			return getCatalogueRepository().saveRule(cabinetId, input);
		}, WRITE);
	},

	setRuleActive(ruleId: string, active: boolean) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CABINET_UPDATE);
			return getCatalogueRepository().setRuleActive(ruleId, active);
		}, WRITE);
	},

	listRules(params: CabinetRuleListParams = {}) {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CABINET_VIEW);
			return getCatalogueRepository().listRules(params);
		}, READ);
	},

	listRuleVersions() {
		return apiCall(() => {
			requirePermission(PERMISSIONS.CABINET_VIEW);
			return getCatalogueRepository().listRuleVersions();
		}, READ);
	}
};
