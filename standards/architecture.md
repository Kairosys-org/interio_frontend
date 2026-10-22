# Frontend Architecture Instructions

These instructions make every frontend project follow ONE architecture, and that architecture is **SvelteKit 2 + Svelte 5 (runes) + TypeScript ONLY**. It was extracted from a production SvelteKit SaaS (repository/adapter pattern, mock-first with a swappable API adapter, RBAC, automated boundary gates). These instructions define structure only. Business logic (entities, fields, rules, workflows, permissions, copy) is always provided by the user in the request; never invent it.

Enforce the layered, feature-first repository/adapter architecture for SvelteKit 2 + Svelte 5 projects: new project, new feature, refactor into it, or audit. Svelte-only. Work is ALWAYS fanned out to parallel subagents (OpenCode Task tool / Claude Agent tool) in waves; doing multi-module work in a single agent is a violation (Section 22).

The architecture is the law. Do not invent alternatives, do not "simplify" layers away, do not skip enforcement. When a request conflicts with a rule, follow the rule and say so in one line.

## 0. Framework gate and mode selection

**Framework gate (always first).** These instructions apply only to SvelteKit + Svelte 5 + TypeScript.
- New project: always scaffold SvelteKit. Never React, Next, Vue, Nuxt, Angular, Solid, plain Vite SPA, or Svelte 4.
- Existing SvelteKit project: proceed.
- Existing Svelte 4 / non-runes code: upgrade-to-runes is part of the refactor (Section 17, Phase 1b).
- Existing non-Svelte project (React, Vue, etc.): do NOT apply these instructions. Tell the user in one line that this architecture is Svelte-only and that a framework migration would be a separate, explicit decision; ask before doing anything.

Then pick the mode and follow ONLY that section plus Sections 1-14 (the rules) and **Section 22 (mandatory multi-agent orchestration)**. Section 22 applies in EVERY mode: the main agent is an orchestrator that plans, spawns parallel subagents, and runs gates; it does not grind through modules or files itself.

| Mode | Trigger | Go to |
|---|---|---|
| A. Bootstrap | New project / empty repo | Section 15 |
| B. Add feature | New module in a conforming project | Section 16 |
| C. Refactor | Existing SvelteKit project that must adopt this architecture | Section 17 |
| D. Audit | "Check / review / does this follow the architecture" | Section 18 |

Before any mode: inspect the repo (package.json, svelte.config.js, folder tree, aliases, existing tests). Never assume.

## 1. The core invariant (memorize)

```text
Route -> Page component -> Feature API facade (data/api.ts) -> Repository interface
      -> Repository provider -> Adapter (mock OR api) -> Mock logic / HTTP client + mappers
```

- Direction is one-way. No reverse dependencies. No layer skipping.
- Presentation calls ONLY its feature `data/api.ts` (and other features' `data/api.ts` or `domain/types`).
- Only the repository provider chooses mock vs API. Components never read env to decide data source.
- Mock and API adapters implement the SAME repository interface and return the SAME domain types.
- API mode must never silently fall back to mock. It fails loudly with a stable error until the real adapter exists.

## 2. Top-level layout (fixed)

```text
src/
  routes/                 thin composition only (SvelteKit file routing)
    (auth)/               unauthenticated pages + centered auth layout
    (dashboard)/          authenticated shell: guards, sidebar, header
    public/               external pages (no session)
    403/                  forbidden page
    +layout.svelte  +page.svelte  +error.svelte
  modules/                one folder per business feature
    <feature>/
      domain/             pure types, zod schemas, pure rules, csv/parsers, domain tests
      data/               repository, provider, api facade, mock, seed, adapters, mappers, tests
      presentation/       pages/ and components/ (feature-owned .svelte)
  shared/                 only what 2+ features use
    application/          session, navigation, env + feature flags
    domain/               roles, permissions, route permissions, uuid (Uuid type, isUuid)
    data/                 repository-mode, repository-errors,
                          collections (shared names), deterministic demo clock
    lib/                  pure helpers: format, status, deterministic (seeded rng, deterministicUuid), uuid (newUuid)
    presentation/ui/      generic app UI shared by 2+ features, built with Tailwind CSS (PageHeader, DataTable, PermissionGate, ...) + index.ts; presentation-only, no feature data imports
  network/                transport + mock backend + errors + token storage + guards
  lib/                    assets, utils (cn)
  app.html  app.d.ts
tests/e2e/                Playwright specs
docs/                     playbook + architecture guide + tracker + CONTRIBUTING.md
scripts/check-architecture.mjs
```

Aliases (`svelte.config.js` `kit.alias`): `$modules` -> `./src/modules`, `$shared` -> `./src/shared`, `$network` -> `./src/network`; `$lib` is the SvelteKit default. Use aliases across feature boundaries; relative imports only inside the same small subfolder. Never add new alias conventions. Do not add a `paths` block to tsconfig; it extends `./.svelte-kit/tsconfig.json`.

Folder names: lowercase-hyphen (`item-groups`, `order-items`).

## 3. Layer responsibilities and dependency rules

| Layer | May import | MUST NOT import |
|---|---|---|
| `routes` | `$shared`, `$lib`, `$modules/*/presentation/pages\|components`, SvelteKit modules | `data/mock*`, `data/adapters/*`, `$network/mock-backend`, `$network/mock-bootstrap`, business rules |
| `presentation` | own `data/api`, own `domain/*`, other modules' `data/api` and `domain/types`, `$shared/presentation\|domain\|lib`, `$lib` | any `data/mock*`, any `data/adapters/*`, `$network/mock-backend`, direct `fetch`/storage |
| `data/api.ts` | repository provider, `$network/api\|errors\|guard\|types`, `$shared/application/session`, `$shared/domain/permissions`, own domain | adapters, mock |
| `data/repository.ts` | domain types, `$network/types` | implementations |
| `data/repository-provider.ts` | repository interface, both adapters, `$shared/data/repository-mode` | anything else; it is the ONLY place that picks an adapter |
| `data/mock.ts` | `$network/mock-backend\|errors\|types`, own domain, own seed | presentation, HTTP client |
| `data/adapters/mock.repository.ts` | `../mock`, `../repository` | logic (must be thin and boring) |
| `data/adapters/api.repository.ts` | `$network/http-client`, mappers, domain | mock, presentation |
| `domain` | pure TS, zod, `$shared/domain/*` | browser APIs, storage, network, Svelte runtime |
| `shared/presentation` | `$lib/utils`, `$shared/*` | feature repositories / feature `data/*` (presentation-only, small explicit props) |
| `network/mock-backend` | nothing feature-specific | server-side code (browser only; never import from SSR-safe code) |

Golden rules:
1. Business rules live in `domain` and `data`, never in `.svelte` pages.
2. UI is a convenience layer for permissions; `api.ts` still enforces them.
3. Shared code is shared only when 2+ features need it. Otherwise it stays in the module.
4. Domain types are defined once per module and used by mock AND api adapters. Never duplicate models.
5. Format values (dates, currency, status labels) in presentation using `$shared/lib/format` and `$shared/lib/status`, never in repositories.
6. ALL ids are UUIDs (`Uuid` from `$shared/domain/uuid`): entity ids, foreign keys, route params, DTO ids. Runtime-created records get `newUuid()` (`crypto.randomUUID()`); seed data gets `deterministicUuid(name)`. Never auto-increment numbers, slugs or prefixed ids like `item_001`.

## 4. Module anatomy (the template)

Every feature module has this shape. Use only the pieces the feature needs, keep the names exact.

```text
src/modules/<feature>/
  domain/types.ts
  domain/validations.ts             zod schemas + FormValues types
  domain/validations.test.ts
  data/repository.ts                interface (port)
  data/repository-provider.ts       getXRepository()
  data/api.ts                       xApi facade (UI boundary)
  data/mock.ts                      mock logic on mock-backend collections
  data/seed.ts                      deterministic demo data
  data/mock.test.ts                 (optional) mock-specific tests
  data/adapters/mock.repository.ts  thin wrapper over mock.ts
  data/adapters/api.repository.ts   httpClient + mappers
  data/mappers/<feature>.mapper.ts  DTO types + toDomain / toRequest / query builders
  data/__tests__/mock.repository.test.ts  tests the mock adapter
  presentation/pages/<Feature>ListPage.svelte  Detail / New / Edit pages
  presentation/components/<Feature>Cell.svelte  ActionsCell, tabs, form fragments
```

Public (no-session) flows add `data/public-repository.ts`, `data/public-api.ts`, `adapters/mock.public.repository.ts` and `adapters/public-api.repository.ts`.

All names below use a neutral example entity, `Item`. The real entities, fields, rules and workflows always come from the user.

### 4.1 domain/types.ts

- Entities carry `id` (`Uuid`), `createdAt`, `updatedAt` (ISO strings), plus the fields the user specifies.
- Separate types for `<X>ListParams` (search, sort, sortDir, page, pageSize, plus any filters the user specifies), `Create<X>Input` and `Update<X>Input` (nullable fields use `T | null` to clear).
- Every id or foreign-key field is typed `Uuid`; zod schemas validate them with `z.string().uuid()`.
- Camel-case domain; snake_case lives only in mapper DTOs.
- View-model types needed by pages (list rows, detail shapes) live in `domain/types.ts`, never in `data/mock.ts`.

### 4.2 domain/validations.ts

```ts
import { z } from 'zod';
export const itemFormSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.')
});
export type ItemFormValues = z.infer<typeof itemFormSchema>;
```

Schema name `<thing>FormSchema` / `<thing>Schema`; values type `<Thing>FormValues`. Messages are user-readable sentences. Fields and rules are the ones the user specifies.

### 4.3 data/repository.ts (port, interface not base class)

```ts
import type { Paginated } from '$network/types';
import type { Uuid } from '$shared/domain/uuid';
export interface ItemsRepository {
  list(params: ItemListParams): Promise<Paginated<Item>>;
  get(id: Uuid): Promise<Item>;
  create(input: CreateItemInput): Promise<Item>;
  update(id: Uuid, input: UpdateItemInput): Promise<Item>;
  remove(id: Uuid): Promise<void>;
}
```

- ALL methods return `Promise`. No implementation details, no Svelte imports.
- List endpoints return `Paginated<T>` = `{ items, page, pageSize, total, totalPages }`.
- The methods a module exposes are the ones the user's requirements call for.

### 4.4 data/repository-provider.ts

```ts
import { resolveRepository } from '$shared/data/repository-mode';
import { mockItemsRepository } from './adapters/mock.repository';
import { apiItemsRepository } from './adapters/api.repository';
export function getItemsRepository(): ItemsRepository {
  return resolveRepository(mockItemsRepository, apiItemsRepository);
}
```

When no real API adapter exists yet (Strategy B), use `getConfiguredRepository('<module>', mockRepo)` so API mode throws `API_DATA_SOURCE_NOT_AVAILABLE` (501) naming the module. Do not create placeholder adapters per module; fail centrally.

### 4.5 data/api.ts (the only thing presentation calls)

```ts
const repository = getItemsRepository();
export const itemsApi = {
  list(params: ItemListParams = {}) { return apiCall(() => repository.list(params)); },
  create(input: CreateItemInput) {
    return apiCall(() => { requirePermission(PERMISSIONS.ITEMS_CREATE); return repository.create(input); });
  }
};
```

- Reads: `apiCall(() => repo.method(...))`.
- Mutations: call `requirePermission(PERMISSIONS.X_ACTION)` first inside `apiCall`.
- Facade is named `<feature>Api` (public flows: `public<Feature>Api`).

### 4.6 data/mock.ts (mock logic)

```ts
registerSeeder(() => ({ items: demoItems }));
function findItem(id: Uuid): Item {
  const item = getCollection<Item>('items').find((i) => i.id === id);
  if (!item) throw new ApiError({ code: ApiErrorCode.NOT_FOUND, message: 'Item not found.', status: 404 });
  return item;
}
export async function mockListItems(params: ItemListParams): Promise<Paginated<Item>> { /* filter, search, sort, paginate as the user specifies */ }
```

- Register the seeder at module load with `registerSeeder`.
- Write through collection helpers (`updateCollection`) that REPLACE arrays; never mutate seed objects in place.
- Create operations assign ids with `newUuid()` from `$shared/lib/uuid`.
- Mock behaviour (validation, uniqueness, state rules) is implemented only as the user specifies.
- Throw only `ApiError` with stable codes. Name functions `mock<Verb><Entity>`.
- Use shared collection constants from `$shared/data/collections` for names used across modules; no scattered raw string literals for shared collections.

### 4.7 data/adapters/mock.repository.ts (thin and boring)

```ts
export const mockItemsRepository: ItemsRepository = {
  list: async (params) => mockListItems(params),
  get: async (id) => mockGetItem(id)
};
```

No logic. One line per method.

### 4.8 data/adapters/api.repository.ts + mappers

```ts
export const apiItemsRepository: ItemsRepository = {
  async get(id) {
    const dto = await httpClient.request<ItemDto>({ method: 'GET', path: `/items/${id}` });
    return toItem(dto);
  }
};
```

- Transport only via `httpClient`. DTO types, `toDomain(dto)`, `to<Create|Update>Request(input)` (only include defined fields), `build<Entity>ListParams(params)` (query string; `page_size` default 25; sort-field map) all live in `mappers/<feature>.mapper.ts`.
- Ids arrive from the backend as UUIDs; mappers pass them through unchanged and never generate ids.
- No duplicated business rules in the adapter. Backend is authoritative in API mode.
- Mapper tests live in `mappers/__tests__/`.

### 4.9 data/seed.ts

Deterministic. Use `$shared/data/demo-clock` (`demoDays(n)`, `demoMonths(n)`) for dates and `$shared/lib/deterministic` (`seededRng`, `hashString`) for pseudo-random values. Every seed id is `deterministicUuid('<entity>:<n>')` (same input, same UUID on every run). No `Math.random()`, no `Date.now()` and no `crypto.randomUUID()` in seeds (random values break determinism).

### 4.10 Mock tests

`mock.repository.test.ts` installs an in-memory `Storage` on `globalThis`, calls `resetMockDb()` in `beforeEach`, and tests the mock adapter's behaviour as the user specifies.

## 5. shared layer

- `shared/application/session.ts`: a `svelte/store` `writable` `{ user, initializing, sessionExpired? }` (`sessionStore`), `session.init/login/logout`, `getSession()` via `get(sessionStore)`, `clearSession(expired)` that clears tokens. Use `browser` from `$app/environment` to guard browser-only work. Root layout calls `session.init()` in `onMount`.
- `shared/application/navigation.ts`: `NAV_SECTIONS` data-driven sidebar (title, href, `@lucide/svelte` icon, permission, feature flag filtering).
- `shared/application/env.ts`: `env` + `featureFlags` from `$env/static/public` `PUBLIC_*` vars. Feature availability is decided here, not in components.
- `shared/domain/permissions.ts`: `ROLES`, `PERMISSIONS` (dot-notation `resource.action`), role-to-permission matrix, `hasPermission`, `hasAnyPermission(perms, userPermissions, role)`. In API mode backend `permissions[]` is authoritative; the matrix is the mock-mode fallback.
- `shared/domain/routePermissions.ts`: `ROUTE_PERMISSIONS` map + `permissionForRoute(pathname)` (exact then longest-prefix).
- `shared/data/repository-mode.ts`: `getRepositoryMode()` (`PUBLIC_DATA_SOURCE` = `mock` | `api`, default mock), `isMockMode()`, `getConfiguredRepository()`, `resolveRepository()`.
- `shared/data/repository-errors.ts`: `createDataSourceUnavailableError(moduleName)` (501, `API_DATA_SOURCE_NOT_AVAILABLE`).
- `shared/data/collections.ts`, `demo-clock.ts`, `shared/lib/{format,status,deterministic,uuid}.ts`. `shared/domain/uuid.ts`: `type Uuid = string`, `isUuid(value)` (pure). `shared/lib/uuid.ts`: `newUuid()` (`crypto.randomUUID()`). `shared/lib/deterministic.ts` also exports `deterministicUuid(name)` (name-based UUID v5 with a fixed namespace) for seeds.
- `shared/presentation/ui/*` + `index.ts`: PageHeader, DataTable, SearchInput, StatusBadge, EmptyState, AsyncState, ConfirmDialog, FormField, ValidationSummary, DetailSection, KeyValueGrid, MetricCard, ActivityTimeline, EntityLink, PermissionGate, Sidebar, ThemeToggle, Toast, PublicBrandHeader. Presentation-only, small explicit props, snippets for optional areas, no feature repository imports.

## 6. network layer

```text
network/index.ts          barrel (types, errors, client, token-storage, api, httpClient, refresh, mock-backend helpers)
network/api.ts            apiCall(operation, options) -> mockRequest wrapper (latency + ApiError normalization)
network/client.ts         mockRequest, delay, MockRequestOptions
network/http-client.ts    httpClient.request<T>({method,path,body,headers,signal,timeoutMs,auth,retryOnUnauthorized})
                          Bearer token, X-Request-ID, envelope parsing, 401 -> refresh -> retry once
network/auth-refresh.ts   single-flight refresh, onAuthRefreshed listener
network/token-storage.ts  mode-aware: mock = fake tokens in localStorage; api = access token in memory, refresh token HttpOnly cookie (never read by JS)
network/api-config.ts     getBaseUrl() from PUBLIC_API_BASE_URL
network/errors.ts         ApiError, ApiErrorCode, isApiError, nextRequestId
network/guard.ts          requirePermission(permission)
network/types.ts          Paginated<T>, ApiResponse<T>, ApiErrorBody
network/mock-backend.ts   browser-only versioned localStorage DB
network/mock-bootstrap.ts imports every module's data/mock so all seeders register before the app is usable; idempotent
```

`ApiError`: `{ code: string, message, status (default 400), category, fieldErrors?, requestId?, details? }` with helpers like `isNotFound()`, `isUnauthorized()`. Stable codes include: `network_error`, `not_found`, `unauthorized`, `forbidden`, `validation`, `conflict`, `token_expired`, `api_data_source_not_available`, plus any codes the user's business logic needs. Presentation shows `err.message`; use `isApiError(err)` to branch; never swallow errors.

`requirePermission` runs only when a session exists, so seeding and direct mock unit tests stay session-free.

## 7. Mock backend rules

It behaves like a small server, not a stub:
- Key `<app>_mock_db_v1`, envelope `{ schemaVersion, seededAt, data }`, persisted in localStorage so demos survive reloads.
- `MOCK_DB_SCHEMA_VERSION` integer + `MIGRATIONS[fromVersion]` map. Bump the version and add a migration (usually `mergeMissingFromSeed`) EVERY time a collection or data shape changes.
- Public helpers: `getCollection<T>(name)`, `setCollection`, `updateCollection(name, fn)`, `registerSeeder(fn)`, `resetMockDb()` (clears DB and mock auth tokens), `readMockDb`.
- Multiple seeders may emit the same collection key; merge arrays, do not overwrite. Cache the built seed; cached collections are never mutated in place.
- Never import it from SSR-safe code (`+page.server.ts`, `+layout.server.ts`, `hooks.server.ts`, `$lib/server`). Only `data/mock.ts`, mock adapters, tests and `mock-bootstrap` touch it.
- Demo reset is gated by `PUBLIC_ENABLE_DEMO_TOOLS`.

## 8. Auth, session, RBAC (three layers)

1. Route: `(dashboard)/+layout.svelte` `$effect`: if `!initializing && !user` -> `goto('/login')` (toast on `sessionExpired`); if feature flag off for the path -> `/403`; `permissionForRoute(pathname)` + `hasAnyPermission` else -> `/403`.
2. UI: `<PermissionGate permission={PERMISSIONS.X}>` hides/disables actions.
3. API facade: `requirePermission(...)` on every mutation.

Logout or refresh failure clears the session so no previous user data stays visible. `(auth)/+layout.svelte` redirects authenticated users to `/dashboard`. Public routes under `routes/public/**` use the `public*Api` facades, have no session, and render explicit loading, error and empty states.

## 9. Routes (thin composition)

A `+page.svelte` renders one page component and passes route params, nothing else:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import EditItemPage from '$modules/items/presentation/pages/EditItemPage.svelte';
  const id = $derived(page.params.id ?? '');
</script>
<EditItemPage {id} />
```

Standard CRUD route set per feature under `(dashboard)/<feature>/`: `+page.svelte` (list), `new/`, `[id]/` (detail), `[id]/edit/`. Route `[id]` params are UUIDs: pages check `isUuid(id)` and render a not-found state otherwise. Nested domain scope (e.g. `/parents/[parentId]/children/[id]`) is allowed when the entity cannot exist without its parent. Legacy URLs redirect from a `+page.ts` `load` with `redirect(302, canonical)`. Use `$app/state` (`page`), `$app/navigation` (`goto`), `$app/environment` (`browser`), `$env/static/public`.

New authenticated routes also require: an entry in `ROUTE_PERMISSIONS`, an entry in `NAV_SECTIONS` (only if part of the shell), and a `PERMISSIONS` constant.

## 10. Presentation patterns (Svelte 5 runes only)

- Reactivity: `$state`, `$derived`, `$derived.by`, `$effect`, `$props()`, `$bindable()`. Snippets (`{#snippet}` / `{@render}`) for slots and action areas. Event attributes (`onclick`, `onsubmit`). `onMount` only for browser-only init.
- Forbidden (Svelte 4 legacy): `export let`, `$:` reactive statements, `on:click` directives, `<slot>`, `createEventDispatcher`, `$$props`/`$$restProps`, `beforeUpdate/afterUpdate`. Stores (`svelte/store`) are used only for the app-wide session store; local state uses runes.
- List page: local filter/sort/page/loading/error state; `load()` calls `<feature>Api.list`; `$effect(() => { load(); })`; `PageHeader` + `SearchInput` + filters; render loading, error, empty, table states (`AsyncState` / `DataTable`); `columns` array with `cell` components + `cellProps`, `format` for primitives; final actions column; row actions wrapped by `PermissionGate`; destructive actions through `ConfirmDialog`.
- Detail page: resolve by `id` prop, fetch related data, `PageHeader` with `backHref`, `DetailSection`/`KeyValueGrid`/tabs/`ActivityTimeline`, small child components for mutations.
- New/Edit page: local `$state` fields, validate with the module's zod schema (`safeParse`), `ValidationSummary` for errors, call `<feature>Api` only on submit, map failures with `isApiError(err) ? err.message : fallback`.
- Import/bulk page: parsing rules in `domain` (e.g. `domain/csv.ts`), dedicated form control, show summary + rejection counts.
- Components: split by view fragment (cells, badges, tabs, form sections). No API calls in generic UI primitives. No workflow logic hidden in generic components. Components dependent on one page stay under that module's `presentation/components`.
- Always show loading, empty and error states. Never silently swallow errors.
- Styling: Tailwind CSS 4 with `tailwind-merge`, `clsx` and `cn()` in `$lib/utils`. Generic UI shared by 2+ features lives in `src/shared/presentation/ui`; otherwise components stay in the module's `presentation/components`. Icons from `@lucide/svelte`; toasts via `svelte-sonner`; theme via `mode-watcher`.

## 11. Naming conventions

| Thing | Convention |
|---|---|
| Page component | `<Feature>ListPage.svelte`, `<Feature>DetailPage.svelte`, `New<Feature>Page.svelte`, `Edit<Feature>Page.svelte` |
| Presentation component | `PascalCase.svelte` (`ItemCell`, `ItemActionsCell`) |
| Repository interface | `<Feature>Repository` |
| Provider | `get<Feature>Repository()` |
| API facade | `<feature>Api` / `public<Feature>Api` |
| Mock functions | `mock<Verb><Entity>` |
| Mock adapter const | `mock<Feature>Repository`; api: `api<Feature>Repository` |
| Schemas / values | `<thing>FormSchema`, `<Thing>FormValues` |
| Mapper fns | `to<Entity>`, `to<Entity>ListResponse`, `toCreate<Entity>Request`, `toUpdate<Entity>Request`, `build<Entity>ListParams` |
| DTO types | `<Entity>Dto`, `<Entity>ListResponseDto`, `Create<Entity>RequestDto` |
| Collections | `COLLECTIONS.someCollection` (snake_case values) |
| Tests | `*.test.ts` beside code or in `__tests__/`; component tests `*.svelte.test.ts` |
| IDs | UUIDs (`Uuid`); seeds use `deterministicUuid('<entity>:<n>')`, runtime uses `newUuid()` |

Prefer nouns for files/components; verbs only for operations.

## 12. Environment and flags

`.env.example` (copy to `.env`; never commit secrets):

```text
PUBLIC_APP_ENV=local
PUBLIC_DATA_SOURCE=mock          # mock | api; missing => mock
PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
PUBLIC_MOCK_LATENCY_MS=350
PUBLIC_ENABLE_<FEATURE>=false     # one PUBLIC_ENABLE_* per optional feature
PUBLIC_ENABLE_DEMO_TOOLS=true    # reset demo data
```

No environment-specific business rules in UI. No separate mock/api/demo branches in git; one codebase, runtime-selected.

## 13. Testing strategy (layered like the code)

- Domain: zod schema + rule unit tests; uuid helper tests (`isUuid`, stable `deterministicUuid`).
- Repository: mock-specific tests, mapper tests, and api adapter tests.
- Cross-module regression suites in `src/network/*.test.ts`: RBAC, mock backend, lazy seeders.
- Component tests as `*.svelte.test.ts` (browser mode via `@vitest/browser-playwright` + `vitest-browser-svelte`, Chromium).
- E2E (Playwright, `tests/e2e/*.e2e.ts`): the user journeys the user specifies. Run against `npm run build && npm run preview` with low mock latency.
- Vitest projects: `client` (browser, `*.svelte.test.ts`) and `server` (node, everything else), `expect: { requireAssertions: true }`.
- Change-type mapping: domain rule -> domain tests; repository behaviour -> mock tests; seed/collection change -> mock data tests + schema version bump; route/permission change -> route/auth/RBAC tests; user-journey change -> Playwright.

## 14. Enforcement tooling (non-optional; install in every project)

**14.1 `scripts/check-architecture.mjs`**: scans `src/routes`, `src/lib`, and every `src/modules/*/presentation` (non-test `.ts|.svelte`), parses `from '...'` and `import('...')`, fails (exit 1) on specifiers matching:

```js
const FORBIDDEN_IMPORT = [
  /data\/mock(?:\/[^"']*)?$/, /data\/adapters\//, /^\.\/mock$/,
  /\$network\/mock-backend/, /\$network\/mock-bootstrap/
];
```

Prints violations as `relative/path -> specifier` and `Expected: 0 violations`; on success `arch:check OK`.

**14.2 ESLint** (flat config, `typescript-eslint` + `eslint-plugin-svelte` + `eslint-config-prettier`) on `src/modules/**/presentation/**`, `src/routes/**`, `src/lib/**`:

```js
'no-restricted-imports': ['error', { patterns: ['**/data/mock*', '**/data/adapters/mock.repository*', '**/data/adapters/api.repository*', '**/network/mock-backend*'] }]
```

Also: `@typescript-eslint/no-unused-vars` with `^_` ignore patterns; `no-undef` off; svelte parser with `projectService`; prettier + prettier-plugin-svelte + prettier-plugin-tailwindcss (tabs).

**14.3 Boundary test** `src/shared/data/__tests__/repository-import-boundaries.test.ts`: same source scan inside vitest so the rule fails in unit runs too. Also keep tests `repository-mode.test.ts` and provider-selection tests.

**14.4 package.json scripts**: `dev`, `build`, `preview`, `prepare` (`svelte-kit sync`), `check` (`svelte-kit sync && svelte-check --tsconfig ./tsconfig.json`), `lint` (`prettier --check . && eslint .`), `arch:check` (`node scripts/check-architecture.mjs`), `test:unit` (vitest), `test:e2e` (playwright), `test`.

**14.5 CI gate on every merge to main** (`.github/workflows/ci.yml`), in order: `npm run check`, `npm run lint`, `npm run arch:check`, `npm run test:unit -- --run`, `npm run test:e2e`, `npm run build`.

**14.6 `docs/CONTRIBUTING.md`** (never at the repo root) is generated AUTOMATICALLY, without being asked: in Mode A as the first `docs` commit right after the scaffold and tooling, and in Modes B, C and D whenever the file is missing. If it already exists, never overwrite it: append only the missing rules and say so. It is written for clarity, in plain language, with short sections in this order:

1. **Purpose**: one paragraph on the architecture and how to run the gate (`npm run check`, `lint`, `arch:check`, `test:unit -- --run`, `test:e2e`, `build`).
2. **The rules**, numbered: (1) never import mock implementations from presentation; (2) never import API adapter from presentation; (3) UI uses only feature `data/api.ts`; (4) `api.ts` uses the repository interface; (5) provider selects adapter; (6) mock and API adapters use the same domain models; (7) no duplicate mock/API domain models; (8) no environment-specific business rules in UI; (9) stable normalized errors; (10) model change requires seed data and tests to pass; (11) no repository-bypassing quick fixes; (12) deterministic seed data; (13) versioned mock DB schema; (14) all ids are UUIDs; (15) every finished unit of work is committed and pushed (Section 14.8).
3. **IDs**: the UUID rule with the `newUuid()` / `deterministicUuid()` / `isUuid()` helpers.
4. **Git workflow**: branch names, commit format, push cadence, what never to do (copy of Section 14.8).
5. **Pull request checklist**: gate green, tracker updated, no mock/adapter imports in presentation, ids are UUIDs, docs updated.
6. **Do and don't**: a short quick-reference list.

**14.7 Docs kept in `docs/`**: `CONTRIBUTING.md`, architecture guide, migration playbook, migration tracker table (Module | Interface | Mock Adapter | API Facade Updated | Tests | Status), QA results. Update the tracker whenever a module changes status, in the same commit as that change.

**14.8 Git workflow (always commit and push, like a real developer)**: work is saved to git continuously, never left uncommitted at the end. These rules come from `docs/CONTRIBUTING.md`.

- **Setup:** inspect `git status`, the current branch and `git remote -v` first. A new project gets `git init` (Mode A only) and a proper `.gitignore` (`node_modules`, `.svelte-kit`, `build`, `.env`, test output) in the first commit. Never commit secrets or `.env`.
- **Branches:** never work directly on `main`/`master`. Use a short-lived branch per task: `feature/<name>`, `refactor/<name>`, `fix/<name>` or `chore/<name>`. Never create permanent `mock`/`api`/`demo` branches.
- **Commit cadence:** one small, focused commit per finished logical unit, in build order, so history reads like a developer's work. Never one giant commit and never a vague "wip" commit. Never mix refactor, new features and bug fixes in one commit. For a refactor, one reversible commit per module. Examples of a unit: scaffold, tooling, `docs/CONTRIBUTING.md`, one foundation folder, one module's domain layer, its data layer, its UI, the wiring, the tracker update.
- **Message format:** conventional commits, `<type>(<scope>): <imperative summary>`, where type is `feat`, `fix`, `refactor`, `test`, `docs`, `chore` or `build`, for example `feat(items): add domain types and validation` or `refactor(items): introduce repository adapter boundary`. Add a short body only when the why is not obvious.
- **Before each commit:** the checks that cover the unit pass (`check`, `lint`, `arch:check`, and the unit tests for what changed). Never commit on red. Stage only the files of that unit by explicit path; never blindly `git add -A`.
- **Push right after every commit:** `git push -u origin <branch>` the first time, then `git push`. Never force push, never rewrite pushed history, never push straight to `main`. When the task is done and a remote and forge CLI exist, open a pull request into `main` so the CI gate (14.5) runs.
- **No remote or push fails:** keep committing locally in the same cadence, say so once in one line (what failed, what is needed), and carry on. Do not stall the work.
- **Multi-agent:** the orchestrator owns git on the working branch. Subagents do not commit or push, except a subagent in its own worktree (Mode C), which commits on its worktree branch; the orchestrator merges that branch, re-runs the gate and pushes. See Section 22.8.

## 15. MODE A: Bootstrap a new project

**Execute via Section 22.5 (Mode A waves): foundation folders and feature modules are built by parallel subagents, not sequentially. The numbered steps below define WHAT; Section 22 defines WHO and WHEN. Commit and push after each step or wave (Section 14.8).**

1. Scaffold with `sv create` (minimal template, TypeScript) and add: Tailwind CSS 4 (`@tailwindcss/vite`), `@sveltejs/adapter-node`, `zod`, `@lucide/svelte`, `mode-watcher`, `svelte-sonner`, vitest (+ `@vitest/browser-playwright`, `vitest-browser-svelte`), Playwright, ESLint (`eslint-plugin-svelte`, `typescript-eslint`), Prettier (`prettier-plugin-svelte`, `prettier-plugin-tailwindcss`), `svelte-check`. Baseline majors: Svelte 5, SvelteKit 2, Vite current, TypeScript current.
2. Add aliases `$modules`, `$shared`, `$network` in `svelte.config.js`.
3. Create the foundation in this order (all from Sections 5-7): `network/{errors,types,client,api,token-storage,api-config,http-client,auth-refresh,guard,mock-backend,mock-bootstrap,index}`, `shared/data/{repository-mode,repository-errors,collections,demo-clock}`, `shared/lib/{deterministic,format,status,uuid}`, `shared/domain/{permissions,routePermissions,user,uuid}`, `shared/application/{session,env,navigation}`, `shared/presentation/ui/*`.
4. Add `.env.example`, `scripts/check-architecture.mjs`, the ESLint restriction, boundary test, CI workflow, `docs/` guide + tracker, and `docs/CONTRIBUTING.md` (generated automatically, Section 14.6; commit and push it first, before the foundation work).
5. Build route shells: root layout (`session.init()` in `onMount`, ModeWatcher, Toaster), `(auth)`, `(dashboard)` (guards + Sidebar + header), `public`, `403`, `+error.svelte`.
6. Build the modules the user asks for, dependencies first. Do not add modules the user did not ask for.
7. Then add features one at a time with MODE B.
8. Run the full gate (Section 14.5). A bootstrap is done only when it is green with zero architecture violations.

## 16. MODE B: Add a feature module (follow in order)

**Execute via Section 22.5 (Mode B): fix the interfaces (types, repository, api signatures) first, then data, UI and validation agents run in parallel; multiple features run as parallel pipelines. The order below is the dependency logic, not a reason to work serially. Commit and push per step group: domain, data, UI, wiring (Section 14.8).**

1. `domain/types.ts`
2. `domain/validations.ts` (+ test)
3. `data/repository.ts`
4. `data/repository-provider.ts`
5. `data/api.ts`
6. `data/mock.ts`
7. `data/adapters/mock.repository.ts`
8. `data/seed.ts` (deterministic; register in `mock.ts`)
9. `data/mappers` + `adapters/api.repository.ts` when a backend API exists
10. mock + mapper tests
11. thin pages/components (runes), composed from the shared UI in `src/shared/presentation/ui` where it fits
12. routes (`list`, `new`, `[id]`, `[id]/edit`)
13. `PERMISSIONS`, `ROUTE_PERMISSIONS`, `NAV_SECTIONS`
14. add `import '$modules/<feature>/data/mock'` to `mock-bootstrap.ts`
15. bump `MOCK_DB_SCHEMA_VERSION` and add a migration if new collections/shape changes
16. update tracker
17. run gate.

Think in this order: domain model -> validation -> repository interface -> feature API -> mock behaviour -> page -> permission/route guard -> tests.

Feature-complete checklist: domain defined; validation explicit; repository interface exists; provider exists; api facade exists; mock exists; adapter thin; seed deterministic; tests cover behaviour; route points to a page; permissions + nav wired; no presentation imports mock internals; no browser-only code in SSR-safe files; no Svelte 4 syntax.

## 17. MODE C: Refactor an existing SvelteKit project into this architecture

Goal: identical behaviour and look, new structure. Never mix refactor with redesign, new features, or bug fixes in one commit.

**Execute via Section 22.5 (Mode C): Phase 0 assessment and Phase 1 foundation are parallel agents; Phase 2 runs one subagent per module in dependency-tier waves (worktree isolation when files overlap). "One module at a time" means one commit per module, NOT one agent working through modules serially.**

**Phase 0: Assess (read-only)**
1. Confirm the framework gate (Section 0). Map current structure, data-access style (inline fetch, stores, services, load functions), auth/session, routing, test setup.
2. List features -> candidate modules. Draw a dependency table: which pages call which data code.
3. Produce a migration tracker (one row per module) and propose the order. Show it to the user before editing.
4. Baseline: run existing check/lint/tests/build and record results so regressions are attributable.

**Phase 1: Foundation (no feature touched yet)**
Create the aliases, `network/`, `shared/` pieces from Sections 5-7, env flags, `repository-mode`, error types, then the enforcement tooling in WARN mode (arch-check lists violations without failing). Commit and push: `refactor(data): add repository foundation`.

**Phase 1b: Svelte 5 conformance (only if legacy syntax exists)**
Migrate Svelte 4 syntax to runes per module as it is touched (`export let` -> `$props()`, `$:` -> `$derived`/`$effect`, `on:click` -> `onclick`, `<slot>` -> snippets). Never batch this across the whole app in one commit.

**Phase 2: Migrate per module (smallest blast radius first)**
Suggested order: dependencies first (for example auth/session before the modules that use it). High-risk modules get an extra regression gate.

Per-module template:
1. Record the existing public API surface (functions pages already call). Keep it stable; this becomes `<feature>Api`.
2. Extract `domain/types.ts` (+ validations) out of pages/old data files; move view-model types out of mock files.
3. Write `repository.ts` interface with `Promise` returns.
4. Move existing data logic into `data/mock.ts` WITHOUT rewriting it; add `adapters/mock.repository.ts` as a thin wrapper.
5. Add `repository-provider.ts`; rewrite `data/api.ts` to call the repository (`apiCall` + `requirePermission`).
6. Replace every direct import of old data/mock code in pages/routes with `<feature>Api`.
7. Add tests capturing CURRENT behaviour first, then keep them green.
8. Run module tests, permission tests, `arch:check`, and a manual/visual smoke of list, detail, new, edit and related tabs. Verify no visible difference and no console errors.
9. Commit independently and push: `refactor(<feature>): introduce repository adapter boundary`. Update the tracker in the same commit. Each module must be independently revertible.

If the existing project already has a real backend: build `api.repository.ts` + mappers directly and keep a mock adapter for tests/demo; the provider selects at runtime.

**Phase 3: Tighten and freeze**
1. Switch arch-check and ESLint restriction to FAIL mode once presentation/routes import zero mock/adapter internals.
2. Add boundary test, CI gate, `docs/CONTRIBUTING.md` (if missing), docs; commit and push each.
3. Add cross-module regression suites (RBAC, mock backend) and Playwright journeys.
4. Final gate: full CI sequence green; direct `Presentation -> Mock` dependencies equal zero. Freeze: any later change follows MODE B or the per-module template.

Refactor guardrails: never rename user-facing behaviour, never change URLs without redirects, keep seeds deterministic, keep the mock DB schema versioned, never merge a module with failing gates, never batch many modules in one commit.

## 18. MODE D: Audit

Produce a pass/fail table and a prioritized fix list. **Execute via Section 22.5 (Mode D): one read-only subagent per checklist area (shard by module groups on large repos), all spawned in one response; the orchestrator merges results.** Check:

- Framework: SvelteKit 2 + Svelte 5 + TypeScript; any Svelte 4 syntax (`export let`, `$:`, `on:`, `<slot>`, `createEventDispatcher`); any non-Svelte UI code.
- Structure: top-level folders, aliases, per-module `domain/data/presentation`, missing files vs Section 4 template, naming vs Section 11.
- Boundaries (run `grep`/script): presentation or routes importing `data/mock*`, `data/adapters/*`, `$network/mock-backend`, `$network/mock-bootstrap`; business rules in `.svelte`; `fetch`/`localStorage` in presentation; modules importing another module's `data/mock` or adapters from non-test, non-mock code.
- Provider: exactly one provider per module; no component reads `PUBLIC_DATA_SOURCE`; API mode does not fall back to mock.
- Facade: every mutation calls `requirePermission`; all calls via `apiCall`.
- Tests: every module has mock tests; adapters share domain types; mappers hold all snake_case.
- Mock: schema version + migrations present; seeds use demo-clock/seeded rng; no `Math.random`/`Date.now` in seeds; collection constants for shared names; mock backend never imported from server-only files.
- IDs: every entity id and foreign key is a UUID (`Uuid`); no numeric, slug or prefixed ids; seeds use `deterministicUuid`; no `crypto.randomUUID()` or `Math.random()` in seeds; route params validated with `isUuid`.
- Security surface: route guards, `ROUTE_PERMISSIONS` coverage for every `(dashboard)` route, tokens handled per mode.
- Tooling: arch-check, ESLint restriction, boundary test, CI gate, `docs/CONTRIBUTING.md`, tracker, git history (small conventional commits, all pushed).
- UX states: loading/empty/error handled in list/detail/form pages.

Report violations as `file:line -> rule`, then offer to fix via MODE C steps per module.

## 19. Framework lock

The stack is fixed: **SvelteKit 2, Svelte 5 with runes, TypeScript (strict), Vite, Tailwind CSS 4, zod, Vitest, Playwright, ESLint + Prettier, adapter-node.** Do not propose, scaffold, or translate this architecture into React, Next.js, Vue, Nuxt, Angular, Solid, Astro, or Svelte 4. If a user asks for that, state in one line that this architecture is Svelte-only and ask whether they want to proceed outside these instructions. The layer names, folder names, aliases, and enforcement gates above are expressed in SvelteKit terms and must be reproduced exactly.

## 20. Hard prohibitions

- No mock imports in routes or presentation. No adapter imports in presentation.
- No business rules, permission matrices, or data-source branching in Svelte pages.
- No duplicate domain models between mock and API paths.
- No non-UUID ids. No non-deterministic seed/demo data. No unversioned mock DB changes.
- No bypassing the repository for "quick fixes". No raw collection-name literals for shared collections.
- No browser-only code (localStorage, window, mock-backend) in SSR-safe layers.
- No Svelte 4 syntax in new or touched code.
- No separate mock/api/demo branches or per-environment forks.
- No shared-layer code used by only one feature. No generic UI primitive that calls an API.
- No merging without the full gate green and the tracker updated.
- No finished work left uncommitted or unpushed; no giant or vague commits; no commits on a red gate; no direct commits to `main`; no force pushes (Section 14.8).
- No single-agent serial execution of multi-module work; no independent subagents launched across separate turns; no two agents on the same file (Section 22).

## 21. Output etiquette

When applying these instructions (and after loading Section 22): state the mode, the module list and the wave plan (which subagents run in parallel) first; make structural changes in small reversible steps; after each module run the gate and report pass/fail; commit and push after each unit (Section 14.8); finish with what changed, the commits pushed, what is enforced now, and one next module. Do not lecture; cite rule sections when refusing a shortcut.

## 22. MANDATORY multi-agent orchestration (all modes)

Speed comes from parallel subagents. This section is as binding as the architecture rules.

### 22.1 The law

1. The main agent is the **orchestrator**: it inspects, plans waves, spawns subagents, applies shared wiring, runs gates, and reports. It does NOT implement modules, pages, adapters, or tests itself when the work splits into independent units.
2. Whenever work covers 2+ independent units (modules, layers of one module, audit areas, foundation folders), it MUST be fanned out to subagents. Looping over modules one by one in a single agent is a violation.
3. **Spawn all independent subagents of a wave in ONE response** (multiple Task/Agent tool calls in the same message). Never launch independent agents across separate turns.
4. Default to MAXIMUM useful parallelism: one subagent per independent unit, up to the cap in 22.6. Never use fewer than 3 agents when 3 or more independent units exist.
5. Only exempt: a trivial change to a single file, or an explicit user instruction not to use agents. State the exemption in one line.

### 22.2 How to spawn (by runtime)

**OpenCode** (verified against opencode.ai docs):
- Subagents are specialized assistants a primary agent invokes through the **Task tool**; users can also call them with `@name`. Built-in subagents: `general` (full tools, intended for running multiple units of work in parallel), `explore` (read-only codebase search), `scout` (read-only external docs/dependency research). Built-in primaries: `build`, `plan`.
- Define project subagents as markdown in `.opencode/agents/<name>.md` (or `~/.config/opencode/agents/`) or in `opencode.json` under `agent`. The file name is the agent name. `description` is REQUIRED and is what the model sees in the Task tool, so write it as a clear "use this when..." sentence. Set `mode: subagent`. Use `permission` (`edit`, `bash`, `task`, `skill`, `webfetch`, glob-pattern objects; last matching rule wins), `steps` to cap iterations, `hidden: true` to keep internal agents out of `@` autocomplete (the model can still call them via Task).
- Without `model`, a subagent uses the model of the primary agent that invoked it.
- The orchestrator is a `mode: primary` agent whose `permission.task` is an explicit allowlist (`"*": "deny"` first, then the roster names `allow`). A denied subagent is removed from the Task tool description.
- Parallelism: the model can issue several Task calls in a single response and they run concurrently. A reported bug (anomalyco/opencode#14195) claimed sequential execution in some setups and maintainers disputed it, so: always batch the calls in one response, keep units independent, and if you observe serial execution anyway, continue the waves (correctness is unaffected, only speed).
- Treat subagents as unable to spawn further subagents: the orchestrator is the ONLY spawner. Subagents do not inherit these instructions; paste the rules they need (22.7).
- Optional community plugins can add swarm/fan-out helpers; never depend on them. The Task tool is the baseline.

**Claude Code / Claude agent harness**: use the Agent tool, several calls in one message; use `isolation: "worktree"` when subagents might touch overlapping files; use read-only agent types (Explore, Plan) for assessment and audit.

**No subagent tool available**: say so in one line, then execute the same wave plan sequentially in the same order and with the same ownership boundaries.

### 22.3 Ownership: no two agents touch the same file

- Each subagent owns a disjoint path set (usually one `src/modules/<feature>/` folder, or one named foundation folder). Give the exact owned paths in its prompt and forbid everything else.
- **Orchestrator-only (serialized) files**: `src/network/mock-bootstrap.ts`, `MOCK_DB_SCHEMA_VERSION` and `MIGRATIONS`, `shared/domain/permissions.ts`, `shared/domain/routePermissions.ts`, `shared/application/navigation.ts`, `shared/data/collections.ts`, `src/network/index.ts`, `package.json`/lockfile, `.env.example`, `docs/` tracker, CI/ESLint config. Subagents do not edit these; they return a **wiring patch** (exact lines to add) and the orchestrator applies all patches once per wave, then bumps the schema version once.
- If two units genuinely must change the same file, run them in separate waves or in separate worktrees and merge.
- Shared UI files in `src/shared/presentation/ui/` are shared across features: at most one agent per wave owns a given file, and feature agents that need a new or changed shared component return a request in their wiring patch instead of editing it.

### 22.4 Roster (create in `.opencode/agents/` when the project lacks them)

File `arch-explorer.md` (or use built-in `explore`):

```markdown
---
description: Read-only assessor. Maps repo structure, data-access style, auth, routing, tests; returns findings, never edits.
mode: subagent
permission:
  edit: deny
  bash: deny
---
```

File `domain-agent.md`:

```markdown
---
description: Builds domain layer for one module (types.ts, validations.ts, tests) following frontend-architecture Sections 3, 4.1, 4.2, 11, 20.
mode: subagent
permission:
  edit: allow
  bash: allow
---
```

File `data-agent.md`:

```markdown
---
description: Builds data layer for one module (repository, provider, api facade, mock, seed, adapters, mappers, tests) following Sections 4.3-4.10.
mode: subagent
permission:
  edit: allow
  bash: allow
---
```

File `ui-agent.md`:

```markdown
---
description: Builds presentation for one module (runes-only pages, components, thin routes) using only the feature data/api.ts, following Sections 9, 10 and 11.
mode: subagent
permission:
  edit: allow
  bash: allow
---
```

File `boundary-reviewer.md`:

```markdown
---
description: Read-only reviewer. Checks a module or diff against Sections 1-14 and 20, reports file:line -> rule. Never edits.
mode: subagent
permission:
  edit: deny
  bash:
    "*": deny
    "grep *": allow
    "git diff*": allow
    "git status*": allow
    "npm run arch:check": allow
---
```

File `gate-runner.md`:

```markdown
---
description: Runs the gate (check, lint, arch:check, unit tests, build) and reports pass/fail with the failing output. Does not fix.
mode: subagent
permission:
  edit: deny
  bash: allow
---
```

Orchestrator (primary) permission, in `opencode.json`:

```json
{
  "agent": {
    "orchestrator": {
      "mode": "primary",
      "description": "Plans waves and fans out frontend-architecture work to parallel subagents.",
      "permission": {
        "edit": "allow",
        "bash": "allow",
        "task": {
          "*": "deny",
          "arch-explorer": "allow", "domain-agent": "allow", "data-agent": "allow",
          "ui-agent": "allow", "boundary-reviewer": "allow", "gate-runner": "allow",
          "general": "allow", "explore": "allow"
        }
      }
    }
  }
}
```

If the project has no roster, use built-in `general` (work) and `explore` (read-only) with the same prompt format.

### 22.5 Wave plans per mode

**Mode A (Bootstrap)**
- Wave 0 (parallel read-only): scaffold facts, tooling versions.
- Wave 1 (parallel, 4 agents): (a) `network/*`; (b) `shared/data` + `shared/lib` + `shared/domain`; (c) `shared/application` + `shared/presentation/ui/*`; (d) tooling: `check-architecture.mjs`, ESLint restriction, boundary test, CI, `docs/CONTRIBUTING.md`, `docs/`. Orchestrator then applies barrels/wiring and runs the gate.
- Wave 2 (parallel): route shells agent + `auth` module split (domain, data, ui) + `profile`/`users`/`roles`/`settings` modules, one agent each.
- Wave 3 (parallel batches, one agent or domain/data/ui trio per feature): all business features via the Mode B pipeline.
- Final wave: `gate-runner` + `boundary-reviewer` in parallel.

**Mode B (Add feature)**
- Orchestrator (or `domain-agent`) first fixes the INTERFACES: `domain/types.ts`, `data/repository.ts`, `data/api.ts` signatures. This is the only serial step.
- Then in parallel: `data-agent` (provider, api, mock, seed, adapters, mappers, mock + mapper tests), `ui-agent` (pages, components, routes against the api signatures), and `domain-agent` (validations + tests).
- Several features requested: one such pipeline per feature, all features in parallel.
- Orchestrator applies wiring (PERMISSIONS, ROUTE_PERMISSIONS, NAV_SECTIONS, mock-bootstrap, schema bump, tracker), then `gate-runner` + `boundary-reviewer` in parallel.

**Mode C (Refactor)**
- Phase 0: parallel read-only `explore` agents, one per concern (structure map, data-access map per area, auth/session, tests baseline run). Orchestrator merges into the tracker and shows it to the user.
- Phase 1: foundation split like Mode A Wave 1 (parallel), tooling in WARN mode.
- Phase 2: each module is an independent unit -> one subagent per module (use worktree isolation when modules share files), a wave per dependency tier (dependencies first, e.g. auth/session/users/roles before dependents). Each subagent follows the Section 17 per-module template and returns one reversible commit plus a wiring patch. High-risk modules get a separate `boundary-reviewer` agent plus an extra regression run.
- Phase 1b (Svelte 5 conformance) runs per module inside the module's own agent; never as one app-wide batch.
- Phase 3: tighten to FAIL mode, regression suites, Playwright journeys as parallel agents; final gate.

**Mode D (Audit)**
- Fan out read-only agents by checklist area: (1) framework/Svelte 4 syntax, (2) structure/naming, (3) boundaries, (4) provider/facade, (5) tests, (6) mock/seeds, (7) security surface, (8) tooling/CI, (9) UX states. For repos with more than ~10 modules, also shard areas 3-6 by module groups.
- Orchestrator merges into one pass/fail table and the prioritized fix list. Fixes then follow Mode C per module, again in parallel.

### 22.6 Concurrency limits

- Default: one agent per independent unit, capped at 8 per wave (drop to 4-6 if rate limits or errors appear). Split larger sets into consecutive waves of up to 8.
- Order waves by dependency; units inside a wave must not depend on each other.

### 22.7 Subagent prompt format (every spawn)

Each prompt MUST contain:
1. Goal and the mode.
2. Owned paths and forbidden paths (22.3).
3. The exact rule sections to obey (paste or summarize the relevant text of Sections 1, 3, 4, 10, 11, 20; subagents do not inherit these instructions).
4. The interfaces it builds against (types, repository interface, api signatures).
5. Do NOT run `git commit` or `git push` (the orchestrator owns git, Section 14.8), unless the subagent works in its own worktree branch.
6. Required output: files changed, wiring patch for orchestrator-only files, gate commands it ran with results, open issues.

Prompts are self-contained, specific, and never say "do the rest".

### 22.8 Merge and gate between waves

After every wave: orchestrator applies wiring patches once, bumps `MOCK_DB_SCHEMA_VERSION` once if needed, updates the tracker, then runs the gate (or spawns `gate-runner`). When the gate is green, the orchestrator commits the wave in small conventional commits (staging explicit paths) and pushes (Section 14.8). Failures go back to a targeted fix subagent with the exact failing output; do not start the next wave on red. The final review is done by a `boundary-reviewer` that did not author the code.

### 22.9 Violations (stop and correct)

- Implementing several modules sequentially in the orchestrator or one agent.
- Launching independent subagents one per turn instead of together in one response.
- Two agents editing the same file, or a subagent editing orchestrator-only files.
- Vague subagent prompts without owned paths, rules, or return format.
- Skipping the wave-plan announcement (Section 21) or the between-wave gate.
- Letting an authoring agent also be the only reviewer of its own work.
- Finishing a wave without committing and pushing it, or committing on a red gate (Section 14.8).

