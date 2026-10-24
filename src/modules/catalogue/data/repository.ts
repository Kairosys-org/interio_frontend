import type { Uuid } from '$shared/domain/uuid';
import type {
	Cabinet,
	CabinetComponentRule,
	CabinetDetail,
	CabinetListParams,
	CabinetPage,
	CabinetParameter,
	CabinetParameterInput,
	CabinetRuleInput,
	CabinetRuleListParams,
	CabinetRulePage,
	CreateCabinetInput,
	UpdateCabinetInput
} from '../domain/types';

/**
 * Catalogue repository contract (architecture §4.3).
 *
 * Presentation sees only `data/api.ts`; the provider picks the mock or API
 * adapter. Mutations are audited by the adapter, never by the page.
 */
export interface CatalogueRepository {
	list(params: CabinetListParams): Promise<CabinetPage>;
	get(id: Uuid): Promise<CabinetDetail>;
	create(input: CreateCabinetInput): Promise<Cabinet>;
	update(id: Uuid, input: UpdateCabinetInput): Promise<Cabinet>;

	/** Upsert one parameter row; bounds are validated before it is stored. */
	saveParameter(cabinetId: Uuid, input: CabinetParameterInput): Promise<CabinetParameter>;

	/** Functional change creates a new version; toggle-only does not. */
	saveRule(cabinetId: Uuid, input: CabinetRuleInput): Promise<CabinetComponentRule>;
	setRuleActive(ruleId: Uuid, active: boolean): Promise<CabinetComponentRule>;

	listRules(params: CabinetRuleListParams): Promise<CabinetRulePage>;
	/** Distinct versions newest first, for the rules page filter. */
	listRuleVersions(): Promise<string[]>;
}
