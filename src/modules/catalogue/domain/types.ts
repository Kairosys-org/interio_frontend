import type { Page } from '$shared/domain/pagination';
import type {
	CabinetFamily,
	CabinetParameterUnit,
	ConstructionMethod
} from '$shared/domain/record-states';
import type { Uuid } from '$shared/domain/uuid';

export type { CabinetFamily, CabinetParameterUnit, ConstructionMethod };

/**
 * Catalogue domain contracts (spec Part 8 §1–§2, Part 5 §4.30).
 *
 * Storage columns are snake_case; the repository maps them to these camelCase
 * contracts. Parameter values are typed because the editor edits `mm`,
 * `count`, `enum`, `bool` and `text` parameters in one table (Part 5 §4.30).
 */

export type CabinetParameterValue = string | number | boolean | null;

export interface Cabinet {
	id: Uuid;
	tenantId: Uuid;
	caption: string;
	family: CabinetFamily;
	description: string | null;
	constructionMethod: ConstructionMethod;
	/** Defaults resolved from the parameter rows; supplied at placement. */
	defaultConfig: Record<string, unknown>;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export type CabinetStatusFilter = 'active' | 'discontinued' | 'all';
export type CabinetSort = 'caption' | 'family' | 'constructionMethod' | 'updatedAt';

export interface CabinetListParams {
	search?: string;
	family?: CabinetFamily | 'all';
	status?: CabinetStatusFilter;
	constructionMethod?: ConstructionMethod | 'all';
	sort?: CabinetSort;
	sortDir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

export interface CabinetListRow {
	id: Uuid;
	caption: string;
	family: CabinetFamily;
	constructionMethod: ConstructionMethod;
	parameterCount: number;
	ruleCount: number;
	active: boolean;
	updatedAt: string;
}

export interface CabinetParameter {
	id: Uuid;
	cabinetId: Uuid;
	paramName: string;
	unit: CabinetParameterUnit;
	minValue: number | null;
	maxValue: number | null;
	defaultValue: CabinetParameterValue;
	allowedValues: string[] | null;
	required: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface CabinetComponentRule {
	id: Uuid;
	cabinetId: Uuid;
	/** Numeric string; increments only when the rule changes functionally. */
	ruleVersion: string;
	partType: string;
	/** Structured declarative expression; never evaluated in the browser. */
	expr: Record<string, unknown>;
	/** Applicability clause; stored verbatim until Phase 6 defines execution. */
	condition: Record<string, unknown> | null;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CabinetDetail {
	cabinet: Cabinet;
	parameters: CabinetParameter[];
	/** Every version, newest first, including inactive history (R3). */
	rules: CabinetComponentRule[];
}

export interface CabinetParameterInput {
	/** Present when editing an existing parameter; omitted when adding. */
	id?: Uuid;
	paramName: string;
	unit: CabinetParameterUnit;
	minValue?: number | null;
	maxValue?: number | null;
	defaultValue?: CabinetParameterValue;
	allowedValues?: string[] | null;
	required?: boolean;
	sortOrder?: number;
}

export interface CabinetRuleInput {
	partType: string;
	expr: Record<string, unknown>;
	condition?: Record<string, unknown> | null;
	active?: boolean;
}

export interface CreateCabinetInput {
	caption: string;
	family: CabinetFamily;
	description?: string | null;
	constructionMethod: ConstructionMethod;
	parameters?: CabinetParameterInput[];
	rules?: CabinetRuleInput[];
}

export interface UpdateCabinetInput {
	caption?: string;
	description?: string | null;
	constructionMethod?: ConstructionMethod;
	active?: boolean;
}

export interface CabinetRuleListParams {
	ruleVersion?: string | 'all';
	active?: 'active' | 'inactive' | 'all';
	search?: string;
	sort?: 'updatedAt' | 'ruleVersion' | 'cabinetCaption' | 'partType';
	sortDir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

export interface CabinetRuleListRow {
	id: Uuid;
	cabinetId: Uuid;
	cabinetCaption: string;
	partType: string;
	ruleVersion: string;
	condition: Record<string, unknown> | null;
	active: boolean;
	updatedAt: string;
}

export type CabinetPage = Page<CabinetListRow>;
export type CabinetRulePage = Page<CabinetRuleListRow>;
