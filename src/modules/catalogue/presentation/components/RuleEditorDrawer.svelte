<script lang="ts">
	import { isApiError } from '$network/errors';
	import {
		Checkbox,
		ExpressionEditor,
		Input,
		TableEditorDrawer,
		Textarea
	} from '$shared/presentation/ui';
	import { catalogueApi } from '../../data/api';
	import type { CabinetComponentRule } from '../../domain/types';
	import {
		formatRuleExpression,
		parseRuleExpressionText,
		validateRuleExpression
	} from '../../domain/rule-expression';
	import { ruleSchema } from '../../domain/validations';

	/**
	 * Component-rule editor (phase-3 §1, §9.1).
	 *
	 * The expression is stored as structured JSON and never executed here.
	 * A functional change creates a new `rule_version`; flipping the active
	 * flag does not (the mock applies the same rule). The condition stays
	 * verbatim JSON until Phase 6 defines its executor.
	 */
	interface Props {
		open?: boolean;
		cabinetId: string;
		parameterNames: string[];
		onClose: () => void;
		onSaved: (rule: CabinetComponentRule) => void;
	}

	let { open = $bindable(false), cabinetId, parameterNames, onClose, onSaved }: Props = $props();

	let partType = $state('');
	let exprText = $state('{\n  "length": "width - 6"\n}');
	let conditionText = $state('');
	let active = $state(true);

	let exprError = $state<string | null>(null);
	let exprErrorLine = $state<number | null>(null);
	let conditionError = $state<string | null>(null);
	let partTypeError = $state<string | null>(null);
	let serverError = $state<string | null>(null);
	let submitting = $state(false);

	let wasOpen = false;
	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (wasOpen) return;
		wasOpen = true;

		partType = '';
		exprText = '{\n  "length": "width - 6"\n}';
		conditionText = '';
		active = true;
		exprError = null;
		exprErrorLine = null;
		conditionError = null;
		partTypeError = null;
		serverError = null;
		submitting = false;
	});

	function formatExpression(): void {
		const parsed = parseRuleExpressionText(exprText);
		if (!parsed.ok) {
			exprError = parsed.issue.message;
			exprErrorLine = parsed.issue.line;
			return;
		}
		exprText = formatRuleExpression(parsed.value);
		exprError = null;
		exprErrorLine = null;
	}

	async function save(): Promise<void> {
		serverError = null;
		partTypeError = null;
		exprError = null;
		exprErrorLine = null;
		conditionError = null;

		const parsed = parseRuleExpressionText(exprText);
		if (!parsed.ok) {
			exprError = parsed.issue.message;
			exprErrorLine = parsed.issue.line;
			return;
		}
		const validated = validateRuleExpression(parsed.value, parameterNames);
		if (!validated.ok) {
			const issue = validated.issues[0];
			exprError = issue?.message ?? 'Check the rule expression.';
			exprErrorLine = issue?.line ?? null;
			return;
		}

		let condition: Record<string, unknown> | null = null;
		if (conditionText.trim().length > 0) {
			try {
				const parsedCondition: unknown = JSON.parse(conditionText);
				if (
					typeof parsedCondition !== 'object' ||
					parsedCondition === null ||
					Array.isArray(parsedCondition)
				) {
					conditionError = 'Enter a JSON object or leave the condition empty.';
					return;
				}
				condition = parsedCondition as Record<string, unknown>;
			} catch {
				conditionError = 'That condition is not valid JSON.';
				return;
			}
		}

		const values = ruleSchema.safeParse({
			partType,
			expr: validated.value,
			condition
		});
		if (!values.success) {
			const issue = values.error.issues[0];
			if (issue?.path[0] === 'partType') partTypeError = issue.message;
			else serverError = issue?.message ?? 'Check the rule.';
			return;
		}

		submitting = true;
		try {
			const saved = await catalogueApi.saveRule(cabinetId, {
				...values.data,
				active
			});
			open = false;
			onSaved(saved);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) {
					partTypeError = caught.fieldErrors.partType ?? partTypeError;
				}
				serverError = caught.message;
			} else {
				serverError = 'We could not save this rule. Try again.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<TableEditorDrawer
	bind:open
	title="New component rule"
	description="Define what the cabinet is made of. Saving a functional change creates the next rule version."
	submitLabel="Save rule"
	saving={submitting}
	error={serverError}
	onsave={save}
	onclose={onClose}
>
	<Input
		label="Part type"
		required
		bind:value={partType}
		placeholder="side_panel"
		hint="The component this rule produces, for example side_panel or shelf."
		error={partTypeError ?? undefined}
		disabled={submitting}
	/>

	<ExpressionEditor
		label="Expression"
		value={exprText}
		onchange={(value) => (exprText = value)}
		rows={8}
		hint="JSON object. Arithmetic strings are allowed only under length, width, height, depth, qty, quantity and thickness."
		error={exprError}
		errorLine={exprErrorLine}
		disabled={submitting}
		onformat={formatExpression}
		formatLabel="Format JSON"
	/>

	<Textarea
		label="Condition"
		rows={3}
		bind:value={conditionText}
		placeholder={'{\n  "door_count": ">= 2"\n}'}
		hint="Optional JSON object. Stored verbatim until the engineering engine lands."
		error={conditionError ?? undefined}
		disabled={submitting}
	/>

	<Checkbox label="Active" bind:checked={active} disabled={submitting} />
</TableEditorDrawer>
