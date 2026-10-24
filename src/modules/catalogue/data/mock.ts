import type { ZodError } from 'zod';
import { recordTenantAudit } from '$shared/data/audit';
import { COLLECTIONS } from '$shared/data/collections';
import { demoNow } from '$shared/data/demo-clock';
import { requireTenantSession } from '$shared/data/mock-session';
import type {
	CabinetComponentRuleRecord,
	CabinetParameterRecord,
	CabinetRecord
} from '$shared/data/records';
import { toPage } from '$shared/domain/pagination';
import { PERMISSIONS } from '$shared/domain/permissions';
import {
	CABINET_FAMILIES,
	CONSTRUCTION_METHODS,
	type CabinetFamily,
	type ConstructionMethod
} from '$shared/domain/record-states';
import type { Uuid } from '$shared/domain/uuid';
import { newUuid } from '$shared/lib/uuid';
import { ApiError, ApiErrorCode } from '$network/errors';
import { getCollection, registerSeeder, updateCollection } from '$network/mock-backend';
import type {
	Cabinet,
	CabinetComponentRule,
	CabinetDetail,
	CabinetListParams,
	CabinetListRow,
	CabinetPage,
	CabinetParameter,
	CabinetParameterInput,
	CabinetRuleInput,
	CabinetRuleListParams,
	CabinetRuleListRow,
	CabinetRulePage,
	CabinetSort,
	CreateCabinetInput,
	UpdateCabinetInput
} from '../domain/types';
import {
	cabinetFormSchema,
	fieldErrorsFrom,
	normaliseParameterInput,
	parameterSchema,
	resolveParameterDefaults,
	ruleSchema,
	type ParameterFormValues,
	type RuleFormValues
} from '../domain/validations';
import { ruleExpressionsEqual, validateRuleExpression } from '../domain/rule-expression';
import { seedCatalogue } from './seed';

/** The mock backend behaves like the server: every call is authorised first. */
registerSeeder(seedCatalogue);

const NOT_FOUND_MESSAGE = 'Cabinet not found.';
const PARAMETER_NOT_FOUND_MESSAGE = 'Parameter not found.';
const RULE_NOT_FOUND_MESSAGE = 'Rule not found.';

const CABINET_SORT_FIELDS: readonly CabinetSort[] = [
	'caption',
	'family',
	'constructionMethod',
	'updatedAt'
];

function notFound(message = NOT_FOUND_MESSAGE): ApiError {
	return new ApiError({ code: ApiErrorCode.NOT_FOUND, status: 404, message });
}

function conflict(message: string): ApiError {
	return new ApiError({ code: ApiErrorCode.CONFLICT, status: 409, message });
}

function validation(message: string, fieldErrors?: Record<string, string>): ApiError {
	return new ApiError({
		code: ApiErrorCode.VALIDATION,
		status: 400,
		message,
		fieldErrors
	});
}

function mapZodError(error: ZodError, prefix = ''): ApiError {
	return validation('Check the highlighted fields and try again.', fieldErrorsFrom(error, prefix));
}

function now(): string {
	return demoNow().toISOString();
}

function paramValidationError(name: string, error: ZodError, prefix = ''): ApiError {
	const first = error.issues[0];
	const detail = first?.message ?? 'Check the parameter values.';
	return validation(`Parameter "${name}": ${detail}`, fieldErrorsFrom(error, prefix));
}

function ruleValidationError(partType: string, message: string, fieldKey: string): ApiError {
	return validation(`Rule "${partType}": ${message}`, { [fieldKey]: message });
}

/* ------------------------------------------------------------------ */
/* Mapping                                                            */
/* ------------------------------------------------------------------ */

function toCabinet(record: CabinetRecord): Cabinet {
	return { ...record };
}

function toParameter(record: CabinetParameterRecord): CabinetParameter {
	return {
		id: record.id,
		cabinetId: record.cabinetId,
		paramName: record.paramName,
		unit: record.unit,
		minValue: record.minValue,
		maxValue: record.maxValue,
		defaultValue: record.defaultValue,
		allowedValues: record.allowedValues ? [...record.allowedValues] : null,
		required: record.required,
		sortOrder: record.sortOrder,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt
	};
}

function toRule(record: CabinetComponentRuleRecord): CabinetComponentRule {
	return {
		id: record.id,
		cabinetId: record.cabinetId,
		ruleVersion: record.ruleVersion,
		partType: record.partType,
		expr: { ...record.expr },
		condition: record.condition ? { ...record.condition } : null,
		active: record.active,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt
	};
}

function toListRow(
	record: CabinetRecord,
	parameterCount: number,
	ruleCount: number
): CabinetListRow {
	return {
		id: record.id,
		caption: record.caption,
		family: record.family,
		constructionMethod: record.constructionMethod,
		parameterCount,
		ruleCount,
		active: record.active,
		updatedAt: record.updatedAt
	};
}

function matches(value: string | null | undefined, needle: string): boolean {
	return typeof value === 'string' && value.toLowerCase().includes(needle);
}

function familyRank(family: CabinetFamily): number {
	const index = CABINET_FAMILIES.indexOf(family);
	return index === -1 ? CABINET_FAMILIES.length : index;
}

function constructionRank(method: ConstructionMethod): number {
	const index = CONSTRUCTION_METHODS.indexOf(method);
	return index === -1 ? CONSTRUCTION_METHODS.length : index;
}

function compareCabinets(
	first: CabinetRecord,
	second: CabinetRecord,
	sort: CabinetSort,
	sortDir: 'asc' | 'desc'
): number {
	let primary = 0;

	switch (sort) {
		case 'family':
			primary = familyRank(first.family) - familyRank(second.family);
			break;
		case 'constructionMethod':
			primary =
				constructionRank(first.constructionMethod) - constructionRank(second.constructionMethod);
			break;
		case 'updatedAt':
			primary = first.updatedAt.localeCompare(second.updatedAt);
			break;
		case 'caption':
		default:
			primary = first.caption.localeCompare(second.caption, 'en-GB');
			break;
	}

	if (primary === 0) return first.id.localeCompare(second.id);
	return sortDir === 'asc' ? primary : -primary;
}

function numericVersion(version: string): number {
	const parsed = Number.parseInt(version, 10);
	return Number.isFinite(parsed) ? parsed : 0;
}

/* ------------------------------------------------------------------ */
/* Lookup helpers                                                     */
/* ------------------------------------------------------------------ */

function findCabinet(tenantId: Uuid, id: Uuid): CabinetRecord {
	const cabinet = getCollection<CabinetRecord>(COLLECTIONS.cabinetCatalog).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!cabinet) throw notFound();
	return cabinet;
}

function cabinetParameters(tenantId: Uuid, cabinetId: Uuid): CabinetParameterRecord[] {
	return getCollection<CabinetParameterRecord>(COLLECTIONS.cabinetParameters).filter(
		(row) => row.tenantId === tenantId && row.cabinetId === cabinetId
	);
}

function cabinetRules(tenantId: Uuid, cabinetId: Uuid): CabinetComponentRuleRecord[] {
	return getCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules).filter(
		(row) => row.tenantId === tenantId && row.cabinetId === cabinetId
	);
}

function findParameter(tenantId: Uuid, cabinetId: Uuid, id: Uuid): CabinetParameterRecord {
	const parameter = getCollection<CabinetParameterRecord>(COLLECTIONS.cabinetParameters).find(
		(row) => row.tenantId === tenantId && row.cabinetId === cabinetId && row.id === id
	);
	if (!parameter) throw notFound(PARAMETER_NOT_FOUND_MESSAGE);
	return parameter;
}

function findRule(tenantId: Uuid, id: Uuid): CabinetComponentRuleRecord {
	const rule = getCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules).find(
		(row) => row.tenantId === tenantId && row.id === id
	);
	if (!rule) throw notFound(RULE_NOT_FOUND_MESSAGE);
	return rule;
}

function writeAudit(
	tenantId: Uuid,
	action: string,
	subjectType: string,
	subjectId: Uuid,
	payload: Record<string, unknown>
): void {
	recordTenantAudit({ tenantId, action, subjectType, subjectId, payload });
}

function replaceCabinet(record: CabinetRecord): void {
	updateCollection<CabinetRecord>(COLLECTIONS.cabinetCatalog, (rows) =>
		rows.map((row) => (row.id === record.id ? record : row))
	);
}

/** Recomputes the cabinet's placement defaults from its parameter rows. */
function refreshDefaultConfig(tenantId: Uuid, cabinet: CabinetRecord): CabinetRecord {
	const parameters = cabinetParameters(tenantId, cabinet.id).sort(
		(first, second) =>
			first.sortOrder - second.sortOrder || first.paramName.localeCompare(second.paramName)
	);
	const updated: CabinetRecord = {
		...cabinet,
		defaultConfig: resolveParameterDefaults(parameters),
		updatedAt: now()
	};
	replaceCabinet(updated);
	return updated;
}

/* ------------------------------------------------------------------ */
/* Read methods                                                       */
/* ------------------------------------------------------------------ */

export async function mockListCabinets(params: CabinetListParams = {}): Promise<CabinetPage> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CABINET_VIEW);

	const search = params.search?.trim().toLowerCase() ?? '';
	const family = params.family ?? 'all';
	const status = params.status ?? 'all';
	const constructionMethod = params.constructionMethod ?? 'all';
	const sort: CabinetSort = CABINET_SORT_FIELDS.includes(params.sort ?? 'caption')
		? (params.sort ?? 'caption')
		: 'caption';
	const sortDir = params.sortDir ?? (sort === 'updatedAt' ? 'desc' : 'asc');

	const allParameters = getCollection<CabinetParameterRecord>(COLLECTIONS.cabinetParameters);
	const allRules = getCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules);

	const rows = getCollection<CabinetRecord>(COLLECTIONS.cabinetCatalog)
		.filter((cabinet) => cabinet.tenantId === tenantId)
		.filter((cabinet) => family === 'all' || cabinet.family === family)
		.filter(
			(cabinet) => constructionMethod === 'all' || cabinet.constructionMethod === constructionMethod
		)
		.filter((cabinet) => {
			if (status === 'active') return cabinet.active;
			if (status === 'discontinued') return !cabinet.active;
			return true;
		})
		.filter(
			(cabinet) =>
				search.length === 0 ||
				matches(cabinet.caption, search) ||
				matches(cabinet.description, search)
		)
		.sort((first, second) => compareCabinets(first, second, sort, sortDir))
		.map((cabinet) =>
			toListRow(
				cabinet,
				allParameters.filter(
					(parameter) => parameter.tenantId === tenantId && parameter.cabinetId === cabinet.id
				).length,
				allRules.filter((rule) => rule.tenantId === tenantId && rule.cabinetId === cabinet.id)
					.length
			)
		);

	return toPage(rows, { page: params.page, pageSize: params.pageSize });
}

export async function mockGetCabinet(id: Uuid): Promise<CabinetDetail> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CABINET_VIEW);
	const cabinet = findCabinet(tenantId, id);

	const parameters = cabinetParameters(tenantId, cabinet.id)
		.sort(
			(first, second) =>
				first.sortOrder - second.sortOrder || first.paramName.localeCompare(second.paramName)
		)
		.map(toParameter);

	const rules = cabinetRules(tenantId, cabinet.id)
		.sort(
			(first, second) =>
				numericVersion(second.ruleVersion) - numericVersion(first.ruleVersion) ||
				first.partType.localeCompare(second.partType) ||
				second.createdAt.localeCompare(first.createdAt)
		)
		.map(toRule);

	return { cabinet: toCabinet(cabinet), parameters, rules };
}

export async function mockListRules(params: CabinetRuleListParams = {}): Promise<CabinetRulePage> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CABINET_VIEW);

	const version = params.ruleVersion ?? 'all';
	const activeFilter = params.active ?? 'all';
	const search = params.search?.trim().toLowerCase() ?? '';
	const sort = params.sort ?? 'updatedAt';
	const sortDir = params.sortDir ?? (sort === 'updatedAt' ? 'desc' : 'asc');

	const cabinets = new Map(
		getCollection<CabinetRecord>(COLLECTIONS.cabinetCatalog)
			.filter((cabinet) => cabinet.tenantId === tenantId)
			.map((cabinet) => [cabinet.id, cabinet] as const)
	);

	const rows = getCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules)
		.filter((rule) => rule.tenantId === tenantId)
		.filter((rule) => version === 'all' || rule.ruleVersion === version)
		.filter((rule) => {
			if (activeFilter === 'active') return rule.active;
			if (activeFilter === 'inactive') return !rule.active;
			return true;
		})
		.map((rule) => {
			const cabinet = cabinets.get(rule.cabinetId);
			return {
				rule,
				cabinetCaption: cabinet?.caption ?? ''
			};
		})
		.filter(
			(entry) =>
				search.length === 0 ||
				matches(entry.cabinetCaption, search) ||
				matches(entry.rule.partType, search) ||
				matches(entry.rule.ruleVersion, search)
		)
		.sort((first, second) => {
			let primary = 0;
			switch (sort) {
				case 'ruleVersion':
					primary =
						numericVersion(first.rule.ruleVersion) - numericVersion(second.rule.ruleVersion);
					break;
				case 'cabinetCaption':
					primary = first.cabinetCaption.localeCompare(second.cabinetCaption, 'en-GB');
					break;
				case 'partType':
					primary = first.rule.partType.localeCompare(second.rule.partType);
					break;
				case 'updatedAt':
				default:
					primary = first.rule.updatedAt.localeCompare(second.rule.updatedAt);
					break;
			}
			if (primary === 0) return first.rule.id.localeCompare(second.rule.id);
			return sortDir === 'asc' ? primary : -primary;
		})
		.map((entry): CabinetRuleListRow => ({
			id: entry.rule.id,
			cabinetId: entry.rule.cabinetId,
			cabinetCaption: entry.cabinetCaption,
			partType: entry.rule.partType,
			ruleVersion: entry.rule.ruleVersion,
			condition: entry.rule.condition ? { ...entry.rule.condition } : null,
			active: entry.rule.active,
			updatedAt: entry.rule.updatedAt
		}));

	return toPage(rows, { page: params.page, pageSize: params.pageSize });
}

export async function mockListRuleVersions(): Promise<string[]> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CABINET_VIEW);

	const versions = new Set(
		getCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules)
			.filter((rule) => rule.tenantId === tenantId)
			.map((rule) => rule.ruleVersion)
	);

	return [...versions].sort((first, second) => numericVersion(second) - numericVersion(first));
}

/* ------------------------------------------------------------------ */
/* Mutations                                                          */
/* ------------------------------------------------------------------ */

function parseParameterInput(
	input: CabinetParameterInput,
	nameForError: string,
	prefix: string
): ParameterFormValues {
	const normalised = normaliseParameterInput(input);
	const parsed = parameterSchema.safeParse({
		id: normalised.id,
		paramName: normalised.paramName,
		unit: normalised.unit,
		minValue: normalised.minValue ?? null,
		maxValue: normalised.maxValue ?? null,
		defaultValue: normalised.defaultValue ?? null,
		allowedValues: normalised.allowedValues ?? null,
		required: normalised.required ?? true,
		sortOrder: normalised.sortOrder ?? 0
	});
	if (!parsed.success) throw paramValidationError(nameForError, parsed.error, prefix);
	return parsed.data;
}

function parseRuleInput(
	input: CabinetRuleInput,
	parameterNames: readonly string[],
	fieldKey: string
): RuleFormValues {
	const parsed = ruleSchema.safeParse({
		partType: input.partType,
		expr: input.expr,
		condition: input.condition ?? null
	});
	if (!parsed.success) {
		const first = parsed.error.issues[0];
		throw ruleValidationError(
			input.partType || 'rule',
			first?.message ?? 'Check the rule values.',
			fieldKey
		);
	}

	const expression = validateRuleExpression(parsed.data.expr, parameterNames);
	if (!expression.ok) {
		const issue = expression.issues[0];
		throw ruleValidationError(
			parsed.data.partType,
			issue?.message ?? 'Invalid expression.',
			fieldKey
		);
	}

	return parsed.data;
}

export async function mockCreateCabinet(input: CreateCabinetInput): Promise<Cabinet> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CABINET_CREATE);

	const parsedCabinet = cabinetFormSchema.safeParse({
		caption: input.caption,
		family: input.family,
		description: input.description ?? null,
		constructionMethod: input.constructionMethod
	});
	if (!parsedCabinet.success) throw mapZodError(parsedCabinet.error);

	const parsedParameters = (input.parameters ?? []).map((parameter, index) =>
		parseParameterInput(parameter, parameter.paramName, `parameters.${index}`)
	);

	const parameterNames = new Set<string>();
	for (const parameter of parsedParameters) {
		if (parameterNames.has(parameter.paramName)) {
			throw conflict(`The parameter "${parameter.paramName}" appears twice.`);
		}
		parameterNames.add(parameter.paramName);
	}

	const parsedRules = (input.rules ?? []).map((rule, index) =>
		parseRuleInput(rule, [...parameterNames], `rules.${index}.expr`)
	);

	const partTypes = new Set<string>();
	for (const rule of parsedRules) {
		if (partTypes.has(rule.partType)) {
			throw conflict(`The part type "${rule.partType}" appears twice.`);
		}
		partTypes.add(rule.partType);
	}

	const timestamp = now();
	const cabinetId = newUuid();

	const cabinet: CabinetRecord = {
		id: cabinetId,
		tenantId,
		caption: parsedCabinet.data.caption,
		family: parsedCabinet.data.family,
		description: parsedCabinet.data.description,
		constructionMethod: parsedCabinet.data.constructionMethod,
		defaultConfig: resolveParameterDefaults(parsedParameters),
		active: true,
		createdAt: timestamp,
		updatedAt: timestamp
	};

	const parameters: CabinetParameterRecord[] = parsedParameters.map((parameter) => ({
		id: newUuid(),
		tenantId,
		cabinetId,
		paramName: parameter.paramName,
		unit: parameter.unit,
		minValue: parameter.minValue,
		maxValue: parameter.maxValue,
		defaultValue: parameter.defaultValue,
		allowedValues: parameter.allowedValues ? [...parameter.allowedValues] : null,
		required: parameter.required,
		sortOrder: parameter.sortOrder,
		createdAt: timestamp,
		updatedAt: timestamp
	}));

	const rules: CabinetComponentRuleRecord[] = parsedRules.map((rule) => ({
		id: newUuid(),
		tenantId,
		cabinetId,
		ruleVersion: '1',
		partType: rule.partType,
		expr: rule.expr,
		condition: rule.condition,
		active: true,
		createdAt: timestamp,
		updatedAt: timestamp
	}));

	// Everything is validated above: the three inserts cannot fail half way.
	updateCollection<CabinetRecord>(COLLECTIONS.cabinetCatalog, (rows) => [...rows, cabinet]);
	if (parameters.length > 0) {
		updateCollection<CabinetParameterRecord>(COLLECTIONS.cabinetParameters, (rows) => [
			...rows,
			...parameters
		]);
	}
	if (rules.length > 0) {
		updateCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules, (rows) => [
			...rows,
			...rules
		]);
	}

	writeAudit(tenantId, 'create', 'cabinet', cabinet.id, {
		caption: cabinet.caption,
		family: cabinet.family,
		parameterCount: parameters.length,
		ruleCount: rules.length
	});

	return toCabinet(cabinet);
}

export async function mockUpdateCabinet(id: Uuid, input: UpdateCabinetInput): Promise<Cabinet> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CABINET_UPDATE);
	const cabinet = findCabinet(tenantId, id);

	const candidate: CabinetRecord = {
		...cabinet,
		caption: input.caption !== undefined ? input.caption : cabinet.caption,
		description: input.description !== undefined ? input.description : cabinet.description,
		constructionMethod:
			input.constructionMethod !== undefined
				? input.constructionMethod
				: cabinet.constructionMethod,
		active: input.active !== undefined ? input.active : cabinet.active
	};

	const parsed = cabinetFormSchema.safeParse({
		caption: candidate.caption,
		family: candidate.family,
		description: candidate.description,
		constructionMethod: candidate.constructionMethod
	});
	if (!parsed.success) throw mapZodError(parsed.error);

	const updated: CabinetRecord = {
		...candidate,
		caption: parsed.data.caption,
		description: parsed.data.description,
		constructionMethod: parsed.data.constructionMethod
	};

	const changedFields: string[] = [];
	if (updated.caption !== cabinet.caption) changedFields.push('caption');
	if (updated.description !== cabinet.description) changedFields.push('description');
	if (updated.constructionMethod !== cabinet.constructionMethod) {
		changedFields.push('constructionMethod');
	}

	const activeFlipped = updated.active !== cabinet.active;
	if (activeFlipped) changedFields.push('active');
	if (changedFields.length === 0) return toCabinet(cabinet);

	updated.updatedAt = now();
	replaceCabinet(updated);

	const action = activeFlipped ? (updated.active ? 'activate' : 'deactivate') : 'update';
	writeAudit(tenantId, action, 'cabinet', updated.id, { changedFields });

	return toCabinet(updated);
}

export async function mockSaveParameter(
	cabinetId: Uuid,
	input: CabinetParameterInput
): Promise<CabinetParameter> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CABINET_UPDATE);
	const cabinet = findCabinet(tenantId, cabinetId);

	const existing = input.id ? findParameter(tenantId, cabinetId, input.id) : null;
	const normalised = normaliseParameterInput(input);

	const duplicate = getCollection<CabinetParameterRecord>(COLLECTIONS.cabinetParameters).find(
		(row) =>
			row.tenantId === tenantId &&
			row.cabinetId === cabinetId &&
			row.id !== existing?.id &&
			row.paramName.toLowerCase() === normalised.paramName.toLowerCase()
	);
	if (duplicate) {
		throw conflict(`The parameter "${normalised.paramName}" already exists on this cabinet.`);
	}

	const parsed = parseParameterInput(
		{
			...normalised,
			id: existing?.id,
			minValue:
				normalised.minValue !== undefined ? normalised.minValue : (existing?.minValue ?? null),
			maxValue:
				normalised.maxValue !== undefined ? normalised.maxValue : (existing?.maxValue ?? null),
			defaultValue:
				normalised.defaultValue !== undefined
					? normalised.defaultValue
					: (existing?.defaultValue ?? null),
			allowedValues:
				normalised.allowedValues !== undefined
					? normalised.allowedValues
					: (existing?.allowedValues ?? null),
			required: normalised.required ?? existing?.required ?? true,
			sortOrder: normalised.sortOrder ?? existing?.sortOrder ?? 0
		},
		normalised.paramName,
		''
	);

	const timestamp = now();
	const record: CabinetParameterRecord = existing
		? {
				...existing,
				paramName: parsed.paramName,
				unit: parsed.unit,
				minValue: parsed.minValue,
				maxValue: parsed.maxValue,
				defaultValue: parsed.defaultValue,
				allowedValues: parsed.allowedValues ? [...parsed.allowedValues] : null,
				required: parsed.required,
				sortOrder: parsed.sortOrder,
				updatedAt: timestamp
			}
		: {
				id: newUuid(),
				tenantId,
				cabinetId,
				paramName: parsed.paramName,
				unit: parsed.unit,
				minValue: parsed.minValue,
				maxValue: parsed.maxValue,
				defaultValue: parsed.defaultValue,
				allowedValues: parsed.allowedValues ? [...parsed.allowedValues] : null,
				required: parsed.required,
				sortOrder: parsed.sortOrder,
				createdAt: timestamp,
				updatedAt: timestamp
			};

	if (existing) {
		updateCollection<CabinetParameterRecord>(COLLECTIONS.cabinetParameters, (rows) =>
			rows.map((row) => (row.id === record.id ? record : row))
		);
	} else {
		updateCollection<CabinetParameterRecord>(COLLECTIONS.cabinetParameters, (rows) => [
			...rows,
			record
		]);
	}

	refreshDefaultConfig(tenantId, cabinet);

	writeAudit(tenantId, 'update', 'cabinet_parameter', record.id, {
		cabinetId,
		paramName: record.paramName,
		created: existing === null
	});

	return toParameter(record);
}

export async function mockSaveRule(
	cabinetId: Uuid,
	input: CabinetRuleInput
): Promise<CabinetComponentRule> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CABINET_UPDATE);
	findCabinet(tenantId, cabinetId);

	const parameterNames = cabinetParameters(tenantId, cabinetId).map(
		(parameter) => parameter.paramName
	);
	const parsed = parseRuleInput(input, parameterNames, 'expr');

	const existingRows = getCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules)
		.filter(
			(row) =>
				row.tenantId === tenantId && row.cabinetId === cabinetId && row.partType === parsed.partType
		)
		.sort(
			(first, second) =>
				numericVersion(second.ruleVersion) - numericVersion(first.ruleVersion) ||
				second.createdAt.localeCompare(first.createdAt)
		);

	const currentActive = existingRows.find((row) => row.active) ?? null;
	const functionalChange =
		currentActive === null ||
		!ruleExpressionsEqual(currentActive.expr, parsed.expr) ||
		!ruleExpressionsEqual(currentActive.condition, parsed.condition);

	const timestamp = now();

	if (functionalChange) {
		const maxVersion = existingRows.reduce(
			(max, row) => Math.max(max, numericVersion(row.ruleVersion)),
			0
		);
		const nextVersion = String(maxVersion + 1);

		if (existingRows.length > 0) {
			updateCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules, (rows) =>
				rows.map((row) =>
					row.tenantId === tenantId &&
					row.cabinetId === cabinetId &&
					row.partType === parsed.partType &&
					row.active
						? { ...row, active: false, updatedAt: timestamp }
						: row
				)
			);
		}

		const record: CabinetComponentRuleRecord = {
			id: newUuid(),
			tenantId,
			cabinetId,
			ruleVersion: nextVersion,
			partType: parsed.partType,
			expr: parsed.expr,
			condition: parsed.condition,
			active: input.active ?? true,
			createdAt: timestamp,
			updatedAt: timestamp
		};

		updateCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules, (rows) => [
			...rows,
			record
		]);

		updateCollection<CabinetRecord>(COLLECTIONS.cabinetCatalog, (rows) =>
			rows.map((row) =>
				row.tenantId === tenantId && row.id === cabinetId ? { ...row, updatedAt: timestamp } : row
			)
		);

		writeAudit(tenantId, 'rule_version', 'cabinet_rule', record.id, {
			cabinetId,
			partType: record.partType,
			from: currentActive?.ruleVersion ?? null,
			to: record.ruleVersion
		});

		return toRule(record);
	}

	if (!currentActive) throw notFound(RULE_NOT_FOUND_MESSAGE);

	const record: CabinetComponentRuleRecord = {
		...currentActive,
		expr: parsed.expr,
		condition: parsed.condition,
		active: input.active !== undefined ? input.active : currentActive.active,
		updatedAt: timestamp
	};

	updateCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules, (rows) =>
		rows.map((row) => (row.id === record.id ? record : row))
	);

	writeAudit(tenantId, 'update', 'cabinet_rule', record.id, {
		cabinetId,
		partType: record.partType,
		ruleVersion: record.ruleVersion
	});

	return toRule(record);
}

export async function mockSetRuleActive(
	ruleId: Uuid,
	active: boolean
): Promise<CabinetComponentRule> {
	const { tenantId } = requireTenantSession(PERMISSIONS.CABINET_UPDATE);
	const rule = findRule(tenantId, ruleId);

	if (rule.active === active) return toRule(rule);

	const updated: CabinetComponentRuleRecord = {
		...rule,
		active,
		updatedAt: now()
	};

	updateCollection<CabinetComponentRuleRecord>(COLLECTIONS.cabinetComponentRules, (rows) =>
		rows.map((row) => (row.id === updated.id ? updated : row))
	);

	writeAudit(tenantId, active ? 'activate' : 'deactivate', 'cabinet_rule', updated.id, {
		cabinetId: updated.cabinetId,
		partType: updated.partType,
		ruleVersion: updated.ruleVersion
	});

	return toRule(updated);
}
