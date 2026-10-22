/**
 * Single reader for public configuration (architecture §5 `shared/application/env.ts`).
 *
 * Values come from `PUBLIC_*` variables, statically inlined by Vite
 * (`envPrefix` in `vite.config.ts`). The app runs as a client-side SPA, so
 * build-time configuration is the runtime configuration; nothing here touches
 * `$env`, which keeps the module importable from plain Node unit tests.
 */
type PublicEnv = Record<string, string | undefined>;

const publicEnv = import.meta.env as unknown as PublicEnv;

export type RepositoryMode = 'mock' | 'api';

export function readPublicEnv(name: string): string | undefined {
	const value = publicEnv[name];
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readMode(): RepositoryMode {
	return readPublicEnv('PUBLIC_DATA_SOURCE') === 'api' ? 'api' : 'mock';
}

function readNumber(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Demo tools (seed reset, demo account list) are on by default in mock mode so
 * a fresh checkout is demoable without an untracked `.env`. API mode always
 * requires an explicit `PUBLIC_ENABLE_DEMO_TOOLS=true`.
 */
function readDemoTools(): boolean {
	const configured = readPublicEnv('PUBLIC_ENABLE_DEMO_TOOLS');
	if (configured === 'true') return true;
	if (configured === 'false') return false;
	return readMode() === 'mock';
}

export const env = Object.freeze({
	appEnv: readPublicEnv('PUBLIC_APP_ENV') ?? 'local',
	dataSource: readMode(),
	apiBaseUrl: readPublicEnv('PUBLIC_API_BASE_URL') ?? 'http://localhost:8000/api/v1',
	mockLatencyMs: readNumber(readPublicEnv('PUBLIC_MOCK_LATENCY_MS'), 350),
	enableDemoTools: readDemoTools()
});

/**
 * Feature availability is decided here, never in components. Flags default to
 * false so a half-built feature cannot be reached by URL.
 */
export const featureFlags = Object.freeze({
	platformConsole: true,
	mobileSurvey: false,
	designStudio: false,
	reports: false,
	imports: false,
	billing: false
});

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
	return featureFlags[flag] === true;
}
