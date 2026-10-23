import { hasPermission } from '$shared/domain/permissions';
import type { SessionUser } from '$shared/domain/user';
import {
	SURVEY_ACTIONS,
	SURVEY_TRANSITIONS,
	type SurveyAction,
	type SurveyState
} from '../domain/types';

/**
 * Which Part 4 §2 transitions the signed-in user may run from a state.
 *
 * Mirrors the server rule exactly: the transition's permission plus its role
 * gate. The mock backend still re-checks; this only decides what to offer.
 */
export function canRunSurveyAction(
	user: SessionUser | null,
	action: SurveyAction,
	state: SurveyState
): boolean {
	if (!user) return false;

	const rule = SURVEY_TRANSITIONS[action];
	if (!rule.from.includes(state)) return false;
	if (!hasPermission(user.permissions, rule.permission)) return false;
	if (rule.roles && !rule.roles.some((role) => user.roles.includes(role))) return false;

	return true;
}

export function surveyActionsFor(user: SessionUser | null, state: SurveyState): SurveyAction[] {
	return SURVEY_ACTIONS.filter((action) => canRunSurveyAction(user, action, state));
}
