import { describe, expect, it } from 'vitest';
import type { TenantIdentity } from '$shared/domain/user';
import { resolveTenantBranding, tenantDisplayName } from '../branding';

const CANVAS = '#fbfaf8';

function channels(hex: string): [number, number, number] {
	const value = hex.replace('#', '');
	const full =
		value.length === 3
			? value
					.split('')
					.map((character) => character + character)
					.join('')
			: value;
	return [
		Number.parseInt(full.slice(0, 2), 16) / 255,
		Number.parseInt(full.slice(2, 4), 16) / 255,
		Number.parseInt(full.slice(4, 6), 16) / 255
	];
}

function luminance(hex: string): number {
	const linear = channels(hex).map((value) =>
		value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
	);
	return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
	const first = luminance(a);
	const second = luminance(b);
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function tenant(overrides: Partial<TenantIdentity> = {}): TenantIdentity {
	return {
		id: '5f0c1a3e-7b2d-5e4a-8c9d-1a2b3c4d5e6f',
		slug: 'opulent',
		legalName: 'Opulent Interiors Group Ltd',
		status: 'active',
		branding: { accent: '#8A5A2B', displayName: 'Opulent Interiors' },
		...overrides
	};
}

describe('tenant branding guard', () => {
	it('returns null when there is nothing usable to apply', () => {
		expect(resolveTenantBranding(null)).toBeNull();
		expect(resolveTenantBranding({})).toBeNull();
	});

	it('accepts a valid accent and keeps 4.5:1 against the canvas', () => {
		const resolved = resolveTenantBranding({ accent: '#8A5A2B' });
		expect(resolved).not.toBeNull();
		expect(contrast(resolved!.accent, CANVAS)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(resolved!.onAccent, resolved!.accent)).toBeGreaterThanOrEqual(4.5);
	});

	it('lightens or darkens a failing accent instead of applying it', () => {
		const resolved = resolveTenantBranding({ accent: '#FFEE00' });
		expect(resolved).not.toBeNull();
		expect(resolved!.accent.toLowerCase()).not.toBe('#ffee00');
		expect(contrast(resolved!.accent, CANVAS)).toBeGreaterThanOrEqual(4.5);
	});

	it('rejects a non-hex accent', () => {
		expect(resolveTenantBranding({ accent: 'rebeccapurple' })).toBeNull();
		expect(resolveTenantBranding({ accent: '#12345' })).toBeNull();
	});

	it('clamps the overridable display name', () => {
		expect(
			resolveTenantBranding({ accent: '#8A5A2B', displayName: 'A'.repeat(61) })?.displayName
		).toBeNull();
		expect(
			resolveTenantBranding({ accent: '#8A5A2B', displayName: '  Opulent  ' })?.displayName
		).toBe('Opulent');
	});

	it('only accepts https and same-origin absolute asset URLs', () => {
		const branding = resolveTenantBranding({
			accent: '#8A5A2B',
			logoLightUrl: 'https://cdn.example.com/logo.svg',
			logoDarkUrl: '//evil.example.com/logo.svg'
		});
		expect(branding?.logoLightUrl).toBe('https://cdn.example.com/logo.svg');
		expect(branding?.logoDarkUrl).toBeNull();
		expect(
			resolveTenantBranding({ accent: '#8A5A2B', logoLightUrl: 'javascript:alert(1)' })
				?.logoLightUrl
		).toBeNull();
	});
});

describe('tenant display name', () => {
	it('falls back to Interio without a tenant', () => {
		expect(tenantDisplayName(null)).toBe('Interio');
	});

	it('prefers the branding display name', () => {
		expect(tenantDisplayName(tenant())).toBe('Opulent Interiors');
	});

	it('falls back to the legal name when branding is unusable', () => {
		expect(tenantDisplayName(tenant({ branding: null }))).toBe('Opulent Interiors Group Ltd');
	});
});
