import { describe, expect, it } from 'vitest';
import {
	STATE_CATEGORIES,
	isStateCategory,
	stateCategory,
	stateLabel,
	type StateCategory
} from '$shared/lib/status';

const ALL_CATEGORIES: readonly StateCategory[] = [
	'neutral',
	'info',
	'warning',
	'success',
	'danger',
	'muted'
];

describe('STATE_CATEGORIES', () => {
	it('covers every Appendix B row exactly once', () => {
		expect(Object.keys(STATE_CATEGORIES)).toHaveLength(112);
	});

	it('makes every category reachable', () => {
		const used = new Set(Object.values(STATE_CATEGORIES));
		expect(used.size).toBe(ALL_CATEGORIES.length);
		for (const category of ALL_CATEGORIES) {
			expect(used.has(category)).toBe(true);
		}
	});

	it('maps every key to a valid category with the entity.state convention', () => {
		for (const [key, category] of Object.entries(STATE_CATEGORIES)) {
			expect(key).toContain('.');
			expect(isStateCategory(category)).toBe(true);
		}
	});
});

describe('stateCategory', () => {
	it('resolves representative states across entities', () => {
		expect(stateCategory('survey', 'submitted')).toBe('warning');
		expect(stateCategory('survey', 'verified')).toBe('success');
		expect(stateCategory('project', 'active')).toBe('success');
		expect(stateCategory('job', 'ready_for_install')).toBe('warning');
		expect(stateCategory('snag_item', 'open')).toBe('danger');
		expect(stateCategory('payment', 'refunded')).toBe('muted');
		expect(stateCategory('aftercare_request', 'closed')).toBe('neutral');
		expect(stateCategory('import_batch', 'staged')).toBe('info');
	});

	it('resolves column-qualified entities from the appendix', () => {
		expect(stateCategory('unit.engineering_status', 'engineered')).toBe('success');
		expect(stateCategory('part.status', 'held')).toBe('danger');
		expect(stateCategory('part.status', 'quality_control')).toBe('warning');
		expect(stateCategory('part.remake_status', 'complete')).toBe('success');
		expect(stateCategory('asset', 'failed')).toBe('danger');
		expect(stateCategory('app_user', 'active')).toBe('success');
	});

	it('falls back to neutral for unknown entities or states', () => {
		expect(stateCategory('unknown_entity', 'active')).toBe('neutral');
		expect(stateCategory('survey', 'teleported')).toBe('neutral');
		expect(stateCategory('', '')).toBe('neutral');
		expect(stateCategory('constructor', 'name')).toBe('neutral');
	});
});

describe('stateLabel', () => {
	it('renders sentence case labels, never ALL CAPS', () => {
		expect(stateLabel('pending_validation')).toBe('Pending validation');
		expect(stateLabel('in_progress')).toBe('In progress');
		expect(stateLabel('ready_for_install')).toBe('Ready for install');
		expect(stateLabel('ACTIVE')).toBe('Active');
		expect(stateLabel('customer-sign-off')).toBe('Customer sign off');
	});

	it('maps known abbreviations', () => {
		expect(stateLabel('qc')).toBe('Quality control');
	});

	it('does not shout for any canonical state', () => {
		const states = new Set(Object.keys(STATE_CATEGORIES).map((key) => key.split('.').pop() ?? ''));
		for (const state of states) {
			const label = stateLabel(state);
			expect(label.length).toBeGreaterThan(0);
			expect(label).toBe(label.charAt(0).toUpperCase() + label.slice(1));
			expect(label).not.toBe(label.toUpperCase());
		}
	});
});

describe('isStateCategory', () => {
	it('accepts the six canonical categories', () => {
		for (const category of ALL_CATEGORIES) {
			expect(isStateCategory(category)).toBe(true);
		}
	});

	it('rejects anything else', () => {
		expect(isStateCategory('critical')).toBe(false);
		expect(isStateCategory('Neutral')).toBe(false);
		expect(isStateCategory('')).toBe(false);
	});
});
