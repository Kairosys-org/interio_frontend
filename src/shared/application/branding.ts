import type { TenantBrandingEnvelope, TenantIdentity } from '$shared/domain/user';

/**
 * Tenant branding guard (DESIGN §2.4, §3.8). Only accent, derived accent
 * states, logo URLs and a display name may be overridden — never typography,
 * spacing, radii, shadows, semantics or layout. Tonality never wins over
 * contrast: if the guard fails, Interio brass stays.
 */

interface Rgb {
	r: number;
	g: number;
	b: number;
}

interface Oklch {
	l: number;
	c: number;
	h: number;
}

const MAX_DISPLAY_NAME = 60;
const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

let warned = false;

function warn(message: string): void {
	if (warned || typeof console === 'undefined') return;
	warned = true;
	console.warn(`[Interio] Tenant branding not applied: ${message}`);
}

function parseHex(hex: string): Rgb | null {
	if (!HEX_PATTERN.test(hex)) return null;
	let value = hex.slice(1);
	if (value.length === 3)
		value = value
			.split('')
			.map((character) => character + character)
			.join('');
	const int = Number.parseInt(value, 16);
	return { r: ((int >> 16) & 255) / 255, g: ((int >> 8) & 255) / 255, b: (int & 255) / 255 };
}

function toLinear(channel: number): number {
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function fromLinear(channel: number): number {
	const clamped = Math.min(1, Math.max(0, channel));
	return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function rgbToOklch(rgb: Rgb): Oklch {
	const r = toLinear(rgb.r);
	const g = toLinear(rgb.g);
	const b = toLinear(rgb.b);
	const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
	const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
	const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
	const l_ = Math.cbrt(l);
	const m_ = Math.cbrt(m);
	const s_ = Math.cbrt(s);
	const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
	const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
	const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
	return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

function oklchToRgb(oklch: Oklch): Rgb {
	const a = oklch.c * Math.cos(oklch.h);
	const b = oklch.c * Math.sin(oklch.h);
	const l_ = oklch.l + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = oklch.l - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = oklch.l - 0.0894841775 * a - 1.291485548 * b;
	const l = l_ ** 3;
	const m = m_ ** 3;
	const s = s_ ** 3;
	return {
		r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
	};
}

function relativeLuminance(rgb: Rgb): number {
	return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

function contrast(first: Rgb, second: Rgb): number {
	const a = relativeLuminance(first);
	const b = relativeLuminance(second);
	const lighter = Math.max(a, b);
	const darker = Math.min(a, b);
	return (lighter + 0.05) / (darker + 0.05);
}

function toCss(rgb: Rgb): string {
	const channel = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255);
	return `#${[channel(rgb.r), channel(rgb.g), channel(rgb.b)]
		.map((value) => value.toString(16).padStart(2, '0'))
		.join('')}`;
}

function readCanvas(): Rgb {
	const fallback = '#fbfaf8';
	if (typeof document === 'undefined') return parseHex(fallback) as Rgb;
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue('--color-bg-primary')
		.trim();
	return parseHex(value) ?? (parseHex(fallback) as Rgb);
}

function isDarkMode(): boolean {
	if (typeof document === 'undefined') return false;
	return document.documentElement.classList.contains('dark');
}

/** Clamp lightness until the accent reaches 4.5:1 against the canvas. */
function guardAccent(accent: Rgb, canvas: Rgb): Rgb {
	const oklch = rgbToOklch(accent);
	if (contrast(accent, canvas) >= 4.5) return accent;

	const downwards = relativeLuminance(canvas) > 0.5;
	let low = downwards ? 0 : oklch.l;
	let high = downwards ? oklch.l : 1;
	let candidate = accent;
	for (let step = 0; step < 24; step += 1) {
		const l = (low + high) / 2;
		const next = oklchToRgb({ ...oklch, l });
		if (contrast(next, canvas) >= 4.5) {
			candidate = next;
			if (downwards) low = l;
			else high = l;
		} else if (downwards) {
			high = l;
		} else {
			low = l;
		}
	}

	/*
	 * The CSS colour is rounded to 8-bit hex, which can shave a hundredth off
	 * the ratio. Walk further from the canvas until the *rounded* value passes.
	 */
	const base = rgbToOklch(candidate);
	let lightness = base.l;
	let result = quantise(candidate);
	for (let step = 0; step < 64 && contrast(result, canvas) < 4.5; step += 1) {
		lightness += downwards ? -0.004 : 0.004;
		if (lightness < 0 || lightness > 1) break;
		result = quantise(oklchToRgb({ ...base, l: lightness }));
	}
	return result;
}

function quantise(rgb: Rgb): Rgb {
	return parseHex(toCss(rgb)) as Rgb;
}

function shiftLightness(accent: Rgb, delta: number): Rgb {
	const oklch = rgbToOklch(accent);
	return oklchToRgb({ ...oklch, l: Math.min(1, Math.max(0, oklch.l + delta)) });
}

function softAccent(accent: Rgb, dark: boolean): Rgb {
	const oklch = rgbToOklch(accent);
	return oklchToRgb({
		l: dark ? 0.18 : 0.94,
		c: oklch.c * (dark ? 0.4 : 0.3),
		h: oklch.h
	});
}

function validAssetUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed;
	if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
	return null;
}

function validDisplayName(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.length > MAX_DISPLAY_NAME) return null;
	return trimmed;
}

export interface ResolvedTenantBranding {
	accent: string;
	accentHover: string;
	accentSoft: string;
	onAccent: string;
	displayName: string | null;
	logoLightUrl: string | null;
	logoDarkUrl: string | null;
}

/** Validate the opaque envelope. Returns null when nothing usable is present. */
export function resolveTenantBranding(
	branding: TenantBrandingEnvelope | null | undefined,
	dark = isDarkMode()
): ResolvedTenantBranding | null {
	if (!branding || typeof branding !== 'object') return null;
	const canvas = readCanvas();
	const rawAccent = typeof branding.accent === 'string' ? parseHex(branding.accent) : null;
	if (typeof branding.accent === 'string' && !rawAccent) {
		warn('accent is not a hex colour.');
		return null;
	}
	const accent = rawAccent ? guardAccent(rawAccent, canvas) : null;
	if (!accent) return null;
	const hover = shiftLightness(accent, dark ? 0.08 : -0.08);
	const soft = softAccent(accent, dark);
	const white = { r: 1, g: 1, b: 1 };
	const onAccent = contrast(white, accent) >= 4.5 ? white : parseHex('#1c1b18');
	if (!onAccent) return null;
	return {
		accent: toCss(accent),
		accentHover: toCss(hover),
		accentSoft: toCss(soft),
		onAccent: toCss(onAccent),
		displayName: validDisplayName(branding.displayName),
		logoLightUrl: validAssetUrl(branding.logoLightUrl),
		logoDarkUrl: validAssetUrl(branding.logoDarkUrl)
	};
}

const BRANDING_PROPERTIES = [
	'--color-accent',
	'--color-accent-hover',
	'--color-accent-soft',
	'--color-on-accent',
	'--brand-display-name',
	'--brand-logo-light',
	'--brand-logo-dark'
] as const;

export function resetTenantBranding(): void {
	if (typeof document === 'undefined') return;
	for (const property of BRANDING_PROPERTIES) {
		document.documentElement.style.removeProperty(property);
	}
}

/**
 * Apply tenant branding after `/auth/me` and before the authenticated shell
 * paints. Unknown or invalid values fall back to Interio brass.
 */
export function applyTenantBranding(tenant: TenantIdentity | null | undefined): void {
	resetTenantBranding();
	if (!tenant || typeof document === 'undefined') return;
	let resolved: ResolvedTenantBranding | null = null;
	try {
		resolved = resolveTenantBranding(tenant.branding);
	} catch {
		resolved = null;
	}
	if (!resolved) return;
	const root = document.documentElement;
	root.style.setProperty('--color-accent', resolved.accent);
	root.style.setProperty('--color-accent-hover', resolved.accentHover);
	root.style.setProperty('--color-accent-soft', resolved.accentSoft);
	root.style.setProperty('--color-on-accent', resolved.onAccent);
	if (resolved.displayName) root.style.setProperty('--brand-display-name', resolved.displayName);
	if (resolved.logoLightUrl) root.style.setProperty('--brand-logo-light', resolved.logoLightUrl);
	if (resolved.logoDarkUrl) root.style.setProperty('--brand-logo-dark', resolved.logoDarkUrl);
}

/** Display name for the shell: tenant override, else legal name. */
export function tenantDisplayName(tenant: TenantIdentity | null | undefined): string {
	if (!tenant) return 'Interio';
	const resolved = resolveTenantBranding(tenant.branding);
	return resolved?.displayName ?? tenant.legalName;
}
