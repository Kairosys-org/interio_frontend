/**
 * Project hub tab registry (phase-1 §4.1).
 *
 * Later phases do not edit `ProjectDetailPage.svelte` to add a tab: they flip
 * `available` here and add one render branch in the page's tab panel.
 */
export type ProjectTabId =
	'overview' | 'audit' | 'surveys' | 'designs' | 'quotes' | 'orders' | 'job';

export interface ProjectTabDefinition {
	id: ProjectTabId;
	label: string;
	available: boolean;
}

export const PROJECT_TABS: readonly ProjectTabDefinition[] = Object.freeze([
	{ id: 'overview', label: 'Overview', available: true },
	{ id: 'audit', label: 'Activity', available: true },
	{ id: 'surveys', label: 'Surveys', available: false },
	{ id: 'designs', label: 'Designs', available: false },
	{ id: 'quotes', label: 'Quotes', available: false },
	{ id: 'orders', label: 'Orders', available: false },
	{ id: 'job', label: 'Job', available: false }
]);

export const DEFAULT_PROJECT_TAB: ProjectTabId = 'overview';

export function findProjectTab(value: string | null | undefined): ProjectTabDefinition | undefined {
	return PROJECT_TABS.find((tab) => tab.id === value);
}

/** An unknown or not-yet-available tab falls back to Overview. */
export function resolveProjectTab(value: string | null | undefined): ProjectTabId {
	const tab = findProjectTab(value);
	return tab?.available ? tab.id : DEFAULT_PROJECT_TAB;
}

/**
 * `Tabs` has no per-tab tooltip/title prop, so unavailable tabs carry the
 * suffix in their visible label instead of hiding the reason in a tooltip.
 */
export const PROJECT_TAB_ITEMS = PROJECT_TABS.map((tab) => ({
	id: tab.id,
	label: tab.available ? tab.label : `${tab.label} · Later phase`,
	disabled: !tab.available
}));
