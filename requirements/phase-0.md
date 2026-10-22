# Phase 0 — Foundation, shell, tenancy

> **Status:** not started · created 2026-10-22
> **Depends on:** — (first phase) · **Unlocks:** 1–8
> **Spec map:** `spec.md` Part 12 §1 "Phase 0 — Tenancy foundation" (frontend slice); Part 11 §1–§3 and §4.14 (login/invite); Part 2 §2.3–§2.5, §2.9; Part 6 §1–§3, §6; Part 10 §1–§3, §25 (contract only); Part 13 §4 (TEN), §7 (UI contract), C-06/C-07.
> **Read with:** `spec.md` Part 2 §2.1–§2.12, Part 6 §1–§3 and §6, Part 10 §1–§3 and §25, Part 11 §1–§3 + §4.14 + §6, Part 13 §2/§4/§7; `web-design-engineer/ui-ux.md` in full; `DESIGN.md` in full (§2, §3, §4, §5, §6, §7, §9, §10.1, §11, §12, §14, §15, Appendix A/B); `standards/architecture.md` §0–§14 and §15 (Mode A), §19–§22; `testing/ui-ux-tester.md`; `testing/standards/basic-rules.md`.
> **DESIGN.md blocker:** Draft V1.0 · awaiting approval (AGENTS.md Rule 1.5). This plan may be planned now; UI implementation starts only after approval or the explicit instruction "proceed on draft".
> **Branch:** RULE 0 — `main` only, commit and push there, no PR. `architecture.md` §14.8 branch/PR/worktree-branch lines are superseded on branching only.
> **Frontend only:** no backend, no database, no server migrations. Every page consumes Part 10 endpoints through its feature `data/api.ts`; the mock adapter is the default implementation and API mode fails loudly with `API_DATA_SOURCE_NOT_AVAILABLE`.
> **Current repository state (re-check before starting):** no `package.json`; an **untracked partial scaffold** exists in `src/` (14 files: `modules/auth/*`, `modules/platform-tenants/domain/types.ts`, `routes/+layout.*`, `routes/+page.ts`, `shared/presentation/ui/shell/shell-preferences.*`). It is user work: reconcile/complete it, never discard it blindly; anything shipped must still satisfy every rule below.

---

## 1. Scope

### Ships

1. **Scaffold and toolchain.** SvelteKit 2 + Svelte 5 runes + TypeScript strict, Vite, `@sveltejs/adapter-node`, Tailwind CSS 4 via `@tailwindcss/vite`, `zod`, `@lucide/svelte`, `mode-watcher`, `svelte-sonner`, `clsx` + `tailwind-merge`, Vitest (`client` browser project + `server` node project, `@vitest/browser-playwright`, `vitest-browser-svelte`), Playwright, ESLint flat config + `eslint-plugin-svelte` + `typescript-eslint` + `eslint-config-prettier`, Prettier + `prettier-plugin-svelte` + `prettier-plugin-tailwindcss` (tabs), `svelte-check`. Package manager is **pnpm** wherever the standards say `npm`.
2. **Aliases** `$modules`, `$shared`, `$network` in `svelte.config.js`; no tsconfig `paths`; no new alias conventions.
3. **Design foundation.** `src/lib/styles/tokens.css` containing Appendix A verbatim; `src/app.css` with `@import "tailwindcss"` + token import + the `@theme` / `@theme inline` mapping; dark overrides; reduced-motion, reduced-transparency and `prefers-contrast: more` adaptations; `src/lib/utils.ts` with `cn()`.
4. **Network layer** (`src/network/`): `errors.ts`, `types.ts`, `client.ts`, `api.ts`, `token-storage.ts`, `api-config.ts`, `http-client.ts`, `auth-refresh.ts`, `guard.ts`, `mock-backend.ts`, `mock-bootstrap.ts`, `index.ts` — as specified by `architecture.md` §6–§7.
5. **Shared layer** (`src/shared/`): `application/{session,env,navigation,branding}.ts`, `domain/{permissions,routePermissions,uuid,user}.ts`, `data/{repository-mode,repository-errors,collections,demo-clock}.ts`, `lib/{deterministic,uuid,format,status}.ts`.
6. **Shared UI primitives** in `src/shared/presentation/ui/` (one owner file + barrel): see §4.
7. **Four shell surfaces that exist in this phase:** root layout (skip link, `ModeWatcher`, `Toaster`, `session.init()` in `onMount`), `(auth)` layout (centered, redirects authenticated users), `(dashboard)` layout (route guard + `SidebarNav` + `TopBar` + breadcrumb + `main`), `403` page, `+error.svelte` (404 / unexpected / offline). Public viewer and platform console shells are **not** built here.
8. **Auth module** (`src/modules/auth/`): domain types + zod schemas, repository port, provider, `authApi`, mock, deterministic seed, mock adapter, API adapter that fails with 501 until the backend exists; login/MFA/workspace resolution/session refresh/logout; `/auth/me` shape validator including `tenant`, `branding`, `roles`, `permissions[]`.
9. **Tenancy foundation (frontend contract):** tenant derived from the session only (never URL/body); one workspace per session; no tenant switcher; branding applied after `/auth/me` and before the shell paints (no brass flash); tenant accent guard per DESIGN §3.8; tenant identity caption in the top bar.
10. **Permission vocabulary** complete from Part 6 §3 in `PERMISSIONS`, `ROLES`, role→permission matrix, `hasPermission`, `hasAnyPermission`; **route table** seeded with the routes that exist today and extended by later phases.
11. **Mock backend baseline:** versioned envelope `{ schemaVersion, seededAt, data }` under `interio_mock_db_v1`, `MOCK_DB_SCHEMA_VERSION = 1`, empty `MIGRATIONS`, `registerSeeder`, `getCollection`/`setCollection`/`updateCollection`/`resetMockDb`, cache-never-mutate rule; demo reset gated by `PUBLIC_ENABLE_DEMO_TOOLS`.
12. **Tooling and docs:** `scripts/check-architecture.mjs`, ESLint `no-restricted-imports` rules, `src/shared/data/__tests__/repository-import-boundaries.test.ts`, `src/shared/data/__tests__/repository-mode.test.ts`, `.github/workflows/ci.yml` (pnpm gate, exact order), `.env.example`, `docs/CONTRIBUTING.md` (generated automatically, §14.6 content), `docs/architecture.md`, `docs/tracker.md` skeleton, `.gitignore` (`node_modules`, `.svelte-kit`, `build`, `.env`, test output, `.playwright-cli`).
13. **`/dashboard` orientation page only:** greeting, tenant identity, permitted section shortcuts derived from `NAV_SECTIONS`. No invented metrics, no placeholder charts. The role widget grid is Phase 8 (§4.1 of the spec).
14. **Demo tenancy fixtures for isolation testing:** tenant 1 **Opulent Interiors Group** (branding pending, brass fallback) and a second demo tenant with different branding; users for every role in Part 6 §3. Credentials are mock-only fixtures documented in `.env.example` + `docs/`, never committed as secrets.

### Not in this phase

- Any business module (customers, properties, projects, surveys, designs, catalogue, materials, quotes, jobs, parts, installations, aftercare, payments, reports, admin, audit, platform console), `imports`/`exports` pages, `/m/*` mobile shell, `/s/:token` public viewer, three.js, `StageIndicator` page usage, `DataTable` page usage.
- `/activity`, `/admin/*`, `/account/*`, `/onboarding`, `/platform/*` → Phase 8.
- Dashboard widget grid and any report endpoint → Phase 8 (data exists only after Phase 7).
- Real backend, real auth provider, email delivery, SSO, passkeys, device management. API mode returns 501.
- Billing, tenant switcher, project QR, CRM pages, Detel screens — permanent exclusions (Part 11 §7).

---

## 2. Requirements

| Requirement / rule | Where it is enforced in this phase |
|---|---|
| S39 / R8 — tenant comes from the session, never a parameter | `auth` domain `Session.tenant` + `session.init()`; every mock query filters by active tenant; no tenant key in any URL or request body |
| S34 / N5 — MFA before the session completes; lockout after 10 failed attempts in 15 min | `auth` mock (`mockLogin`, `mockVerifyMfa`), login page states, `login_failure` audit |
| R4 — deny by default, UI is convenience only | `ROUTE_PERMISSIONS` + `permissionForRoute` + `(dashboard)/+layout.svelte`; `PermissionGate` for actions; `authApi` re-checks |
| R1 — identity is UUID, captions are display-only | `Uuid`, `isUuid`, `newUuid()`, `deterministicUuid()`; tenant/user/role ids are UUIDs; captions never used as keys |
| R3 — immutable history | audit event written for login success/failure, denied requests, role changes (mock), invitation acceptance |
| N11 / S39 — cross-tenant isolation | two seeded tenants; mock tests prove no read/write crosses tenants; UI never exposes another tenant's data |
| S40 / S41 — tenant lifecycle and support access | **contract only** in Phase 0 (`/platform/*` endpoints mapped in `platform-tenants/domain/types.ts` if kept, no UI); full surface in Phase 8 |
| Part 6 §3 permission matrix | complete `PERMISSIONS` + `ROLES` + matrix + `hasAnyPermission(perms, userPermissions, role)` |
| Part 13 C-06 / C-07 | permission codes and state vocabulary used verbatim; state chip map covers Appendix B from day one |
| Part 13 FT-M1-01…04 | mock + e2e coverage at frontend level (login, MFA, multi-role union, suspension revokes the next request) |
| AGENTS Rule 1 / DESIGN §14.1 | tokens only, Tailwind 4 + `cn()`, no shadcn, no component library, no hardcoded visual values |
| AGENTS Rule 2.2 / architecture §19 | framework lock: no Svelte 4 syntax anywhere |

---

## 3. Routes and pages

| Route | Page component | Access | Endpoints (Part 10) | Required states |
|---|---|---|---|---|
| `/` | `+page.ts` → `redirect(307, '/dashboard')` | public | — | — |
| `/login` | `modules/auth/presentation/pages/LoginPage.svelte` | public (authenticated → `/dashboard`) | `POST /auth/login`, `POST /auth/mfa/verify`, `GET /auth/me` | default, invalid credentials, MFA step, locked out, rate-limited, workspace chooser (0 or 2+ tenants), tenant branding preview, loading |
| `/invite/[token]` | `modules/auth/presentation/pages/InviteAcceptPage.svelte` | public | `POST /users` (invitation flow) + auth endpoints | valid, expired, already used, invalid token, success → login |
| `/dashboard` | `modules/auth/presentation/pages/DashboardHomePage.svelte` (orientation only) | all authenticated | `GET /auth/me` | greeting, permitted shortcuts, empty state when no sections are permitted |
| `/403` | `routes/403/+page.svelte` → `ForbiddenPage` | authenticated | — | forbidden message + back + request id |
| `+error.svelte` | root error boundary | any | — | 404, unexpected error, offline, retry |
| `+layout.svelte` (root) | shell root | any | `GET /auth/me` via `session.init()` | skip link first, theme, toaster |
| `(auth)/+layout.svelte` | centered auth shell | public | — | — |
| `(dashboard)/+layout.svelte` | authenticated shell | authenticated | — | redirect to `/login` when no session; toast on `sessionExpired`; `/403` on missing permission/flag |

Route-param rule: any `[id]`/`[token]` is validated (`isUuid`, token shape) before use; invalid → not-found state, never a crash.

---

## 4. Modules and shared components

### 4.1 Modules

`src/modules/auth/`

```text
domain/types.ts              Tenant, Branding, AppUser, RoleName, PermissionCode, Session, LoginInput, MfaInput
domain/validations.ts        loginFormSchema, mfaFormSchema, inviteFormSchema (+ tests)
data/repository.ts           AuthRepository (login, verifyMfa, me, refresh, logout, acceptInvite)
data/repository-provider.ts  getAuthRepository()
data/api.ts                  authApi (apiCall + requirePermission where applicable)
data/mock.ts                 mockLogin, mockVerifyMfa, mockMe, mockRefresh, mockLogout, mockAcceptInvite
data/seed.ts                 deterministic tenants/users/roles/permissions/invitations
data/adapters/mock.repository.ts
data/adapters/api.repository.ts   mapper-based; throws API_DATA_SOURCE_NOT_AVAILABLE centrally until backend
data/mappers/auth.mapper.ts  DTOs + toSession / toTenant / toAppUser
data/__tests__/auth.mock.repository.test.ts
presentation/pages/LoginPage.svelte
presentation/pages/InviteAcceptPage.svelte
presentation/pages/DashboardHomePage.svelte
presentation/components/LoginForm.svelte, MfaForm.svelte, WorkspaceChooser.svelte, TenantBrandPreview.svelte, InviteForm.svelte
```

### 4.2 Shared UI created in this phase (one owner file + barrel each)

| Component | Contract | Notes |
|---|---|---|
| `StateChip` + `state-chip.ts` | DESIGN §9.2, Appendix B | **one** state→category map for every current and future entity; `StatusBadge` from architecture §5 is not created separately (naming conflict, see §9) |
| `PageHeader` | DESIGN §10.1 | breadcrumb, `h1`, supporting line, one primary action + overflow |
| `AppShell`, `SidebarNav`, `TopBar`, `ThemeToggle` | DESIGN §9.2 | permission-filtered nav, collapse persistence, `aria-current`, skip link precedes sidebar |
| `PermissionGate` | DESIGN §9.2 | hidden vs disabled-with-reason |
| `EmptyState`, `AsyncState` | DESIGN §9.3 | loading/empty/error/offline as first-class |
| `FormField`, `ValidationSummary` | DESIGN §12.5 | labels above, `aria-describedby`, inline errors, preserved values |
| `ConfirmDialog` | DESIGN §9.3 | focus trap, Escape, return focus |
| `ErrorBoundary`, `ForbiddenPage` | DESIGN §9.2 | 403/404/offline/unexpected, request id |
| Primitives | DESIGN §9.3 | Button, IconButton, Link, Input, Textarea, Select, Checkbox/Radio/Switch, Tabs, Dialog, Sheet/Menu, Tooltip, Toast wrapper (Sonner), Badge, Progress, Skeleton, Pagination shell |
| `TenantIdentityCaption`, `BrandMark` | DESIGN §2.3/§2.4 | text wordmark until assets exist; tenant logo via `<img>` only |

Everything else (DataTable, MoneyField, DimensionField, StageIndicator, GateBanner, VersionTimeline, EvidenceUploader, ValidationList, ChecklistDrawer, DedupReviewModal, ScanInput, SyncStatusChip, QrPanel, AssignmentPanel, AuditTrailTab, charts, PlatformShell) is allocated to the phase that first needs it (see the ledger in §4.3) and must not be pre-built here.

### 4.3 Shared-UI ledger (ownership across phases — for reference, do not build ahead)

| Phase | Adds |
|---|---|
| 0 | StateChip, PageHeader, shell chrome, PermissionGate, EmptyState/AsyncState, FormField/ValidationSummary, ConfirmDialog, ErrorBoundary/ForbiddenPage, primitives |
| 1 | DataTable, SearchInput, DetailSection, KeyValueGrid, EntityLink, ActivityTimeline, AuditTrailTab, AssignmentPanel, DedupReviewModal, StageIndicator, GateBanner, Stepper |
| 2 | DimensionField, ChecklistDrawer, EvidenceUploader, SyncStatusChip, MediaGrid/Lightbox, OfflineBanner, MobileTabBar |
| 4 | VersionTimeline |
| 5 | MoneyField, PricingChainWidget |
| 6 | QrPanel, ScanInput, ValidationList, KanbanBoard |
| 7 | chart primitives, ReportFilters |
| 8 | PlatformShell, PermissionMatrix, DashboardWidget, GrantCountdown, MaskedLogViewer |

### 4.4 Orchestrator-only files (never edited by a subagent)

`src/network/mock-bootstrap.ts`, `MOCK_DB_SCHEMA_VERSION` + `MIGRATIONS`, `shared/domain/permissions.ts`, `shared/domain/routePermissions.ts`, `shared/application/navigation.ts`, `shared/data/collections.ts`, `src/network/index.ts`, all `index.ts` barrels, `package.json`/lockfile, `.env.example`, `svelte.config.js` aliases, ESLint/CI config, `docs/` tracker, `requirements/`.

---

## 5. Data

### 5.1 Collections (mock DB v1)

`tenant`, `app_user`, `role`, `permission`, `role_permission`, `user_role`, `user_invitation`, `setting`, `audit_event`, `mock_session`.

- Every row carries `tenantId: Uuid` except `tenant` and `permission` (global catalogue) and `platform_audit_event` (none yet).
- `getCollection` returns data for the **active session tenant** only; a cross-tenant read is a test failure.
- Shared collection names live in `COLLECTIONS` (`shared/data/collections.ts`), never as raw strings.

### 5.2 Deterministic seed rules

- Ids: `deterministicUuid('tenant:opulent')`, `deterministicUuid('user:opulent:owner')`, etc. No `Math.random`, no `Date.now`, no `crypto.randomUUID` in seeds.
- Dates: `demoDays(n)` / `demoMonths(n)` from `shared/data/demo-clock`.
- Tenants: Opulent Interiors Group (tenant 1) + a second tenant with a deliberately different accent/display name.
- Users: one per role in Part 6 §3, state `active`, plus one `suspended` user and one `disabled` user to prove FT-M1-04.
- Settings: branding envelope placeholder (brass, display name), VAT default, currency GBP, reference pattern; unknown keys ignored; invalid accent falls back with a console warning.
- Invitations: one valid, one expired, one already accepted.
- **Demo credentials** are fixtures: password from `PUBLIC_DEMO_PASSWORD` (`.env.example`, mock only); MFA test code from `PUBLIC_DEMO_MFA_CODE`; documented in `docs/CONTRIBUTING.md`. They are not product decisions — see §9.
- Audit: `login_success`, `login_failure`, `denied`, `invite_accept` written by the mock with actor/time/before-after where relevant.

### 5.3 Domain contracts

- `Session = { tenant: Tenant; user: AppUser; roles: RoleName[]; permissions: PermissionCode[]; expiresAt: string }`.
- `Tenant = { id, slug, displayName, state: 'active'|'suspended'|'offboarded', branding: BrandingEnvelope }`.
- `BrandingEnvelope` is **opaque** (DESIGN B3): validate only `accent?`, `logoLight?`, `logoDark?`, `displayName?`; never invent a shape the backend spec does not define; unknown keys ignored.
- Error mapping: `isApiError(err) ? err.message : fallback`; never swallow; stable codes `unauthorized`, `forbidden`, `validation`, `conflict`, `rate_limited`, `network_error`, `api_data_source_not_available`.

### 5.4 Tests

`domain/validations.test.ts`, `data/__tests__/auth.mock.repository.test.ts` (login, MFA, lockout, workspace resolution, suspension), `shared/domain/__tests__/permissions.test.ts`, `routePermissions.test.ts` (exact then longest prefix), `shared/lib/__tests__/deterministic.test.ts` (stable UUID), `uuid.test.ts`, `repository-mode.test.ts`, `repository-import-boundaries.test.ts`, `shared/application/__tests__/branding.test.ts` (accent guard: contrast clamp, fallback). E2E: login → dashboard → logout; deep link while signed out → `/login`; signed-in `/login` → `/dashboard`; `/403`; 404.

---

## 6. Design contract

- **Source of values:** DESIGN.md only. `tokens.css` = Appendix A verbatim; `app.css` = Tailwind 4 mapping verbatim. No new hex, px font size, duration, radius or shadow. No arbitrary Tailwind values. Inline `style` only for data-driven values (progress width, canvas transforms — canvas arrives Phase 4).
- **Identity:** Interio **Joinery Ink**; brass accent `--color-accent`; honest text wordmark while B1/B2 assets are pending; tenant branding overrides accent/logo/display name only, after `/auth/me`, before the shell paints (DESIGN §2.4, §14.4).
- **Shell:** skip link → sidebar → top bar → `main`; sidebar `17rem` expanded / `4.5rem` rail / drawer below `md`; top bar `3.5rem`; content widths by page type (§5.2); page header with breadcrumb, Large Title `h1`, one primary action.
- **Patterns:** login uses the "auth surface" (quiet composition, tenant preview, no marketing copy); dashboard uses "Dashboard" pattern only as a shortcut grid until Phase 8; error/403 use the "ErrorBoundary + ForbiddenPage" contract.
- **States for every component:** default, hover, pressed, focus-visible, disabled, loading, empty, error; offline/success where relevant. Skeletons match final layout.
- **Accessibility:** WCAG 2.2 AA; one `h1`; landmarks; 44×44 targets with 8 px gaps; focus ring 2 px offset 2 px; `prefers-contrast: more`, `prefers-reduced-motion`, `prefers-reduced-transparency` honoured by the token layer; inputs ≥16 px on mobile; 200 % text zoom.
- **Quality gates:** DESIGN §12.6 matrix, §15.1–§15.4, ui-ux §19 pre-ship checklist — all must pass before a screen is "designed".

---

## 7. Work waves

| Wave | Agent | Exclusive paths | Gate |
|---|---|---|---|
| 0 (serial) | orchestrator | scaffold, `package.json`, `svelte.config.js`, `tsconfig`, `app.html`, `app.d.ts`, ESLint/Prettier/CI, `scripts/check-architecture.mjs`, `.env.example`, `.gitignore`, `docs/CONTRIBUTING.md`, `docs/tracker.md` | `pnpm check` + `pnpm lint` + `pnpm arch:check` pass on an empty app |
| 1a (parallel) | network-agent | `src/network/**` | unit tests for client/api/errors/mock-backend |
| 1b (parallel) | shared-core-agent | `src/shared/{data,lib,domain}/**` (except orchestrator-only files) | uuid/deterministic/permissions/repository-mode tests |
| 1c (parallel) | shared-app-ui-agent | `src/shared/application/**` (except `navigation.ts`), `src/shared/presentation/ui/**`, `src/lib/styles/tokens.css`, `src/app.css`, `src/lib/utils.ts` | component tests, token lint (no raw values) |
| 1d (parallel) | auth-agent | `src/modules/auth/**` | auth mock tests, validations tests |
| 2a (parallel) | shell-agent | `src/routes/**` (layouts, guards, 403, error, `/` redirect) | guard behaviour tests + browser smoke |
| 2b (parallel) | auth-ui-agent | `src/modules/auth/presentation/**` (login, invite, dashboard orientation) | login/MFA/workspace e2e |
| 2c (parallel) | docs-agent | `docs/**` (except tracker), `.github/**` CI workflow text | docs review (no code) |
| 3 (serial) | orchestrator | wiring: `permissions.ts`, `routePermissions.ts`, `navigation.ts`, `collections.ts`, `mock-bootstrap.ts`, schema version + migration, barrels, tracker | full pnpm gate |
| 4 (parallel) | gate-runner + boundary-reviewer | read-only | gate report + `file:line -> rule` report |
| 5 | orchestrator | Rule 3 browser matrix (320/390/768/1280/1920, dark, high contrast, 200 % zoom, keyboard, flows), fixes, commits | screenshots post-fix |

Commit cadence (on `main`): scaffold → tooling → tokens/UI primitives → network → shared → auth → shells → wiring → docs. One focused commit per unit; explicit paths only; push after each.

---

## 8. Done when

- [ ] `package.json` exists and every gate script is real: `check`, `lint`, `arch:check`, `test:unit`, `test:e2e`, `build`.
- [ ] Full gate green in order: `pnpm check` → `pnpm lint` → `pnpm arch:check` → `pnpm test:unit -- --run` → `pnpm test:e2e` → `pnpm run build`.
- [ ] `arch:check` reports `arch:check OK` with **0** violations; the boundary test and ESLint restriction fail on a deliberately bad import (proved once, reverted).
- [ ] Login: email → password → MFA succeeds; wrong password shows an inline error; 10 failures in 15 min shows lockout; `login_success` / `login_failure` audit rows exist.
- [ ] Workspace chooser appears only for an email that resolves to 0 or 2+ tenants; after login the tenant is fixed for the session; no tenant switcher exists.
- [ ] Tenant branding (accent, logo, display name) applies after `/auth/me`; an unreadable accent falls back to brass; no brass flash on reload.
- [ ] Route guard: signed out → `/login`; authenticated on `/login` → `/dashboard`; missing permission or disabled feature flag → `/403`; expired session → toast + login.
- [ ] `/dashboard` shows only permitted section shortcuts from `NAV_SECTIONS`; no invented data, no dead links (items are added by later phases).
- [ ] Two seeded tenants: no read or write crosses tenants in mock tests or browser flows.
- [ ] Tokens: no raw hex/rgb/px font/arbitrary Tailwind value outside `tokens.css`; dark mode, `prefers-contrast: more`, reduced motion/transparency all work.
- [ ] Every page checked at `320×720`, `390×844`, `768×1024`, `1280×720`, `1920×1080`, light + dark, 200 % text zoom: no horizontal overflow, targets ≥44×44, AA contrast, heading order, keyboard-only pass with visible focus, no console errors or failed own-asset requests.
- [ ] Unit + e2e suites named in §5.4 pass; `docs/CONTRIBUTING.md` and the tracker exist and describe the real gate.
- [ ] Everything committed and pushed to `main`; `requirements/phase-0.md` status flipped with the `docs(phase-0): mark phase complete` commit only after the gate is green.

---

## 9. Open questions (report, never guess)

1. **DESIGN.md approval** — Draft V1.0 is unapproved; Phase 0 UI work is blocked until the user approves or says "proceed on draft".
2. **B1/B2 brand assets** — Interio logotype/mark and Opulent logo + exact accent are pending. Default: text wordmark + brass.
3. **B3 `tenant.branding` envelope** — backend shape undefined; treated as opaque and validated; raise when Part 5/Part 10 defines it.
4. **B4 mobile shell** — `/m/*` in the same SvelteKit app (default) vs native wrapper. Phase 2 depends on this answer.
5. **Q11 auth/MFA provider and SSO need** — mock implements password + 6-digit MFA only; provider choice may change token/session handling.
6. **Demo credentials** — no spec-defined demo accounts. Defaults: fixtures from `PUBLIC_DEMO_PASSWORD` / `PUBLIC_DEMO_MFA_CODE`, mock only. Confirm or supply.
7. **Second demo tenant identity** — required for isolation tests; name/slug/branding unspecified. Default: neutral second tenant, Interio branding.
8. **Workspace-chooser URL shape** — Part 11 §4.14 says the path becomes `/t/<slug>`; this adds a route not present in the canonical sidebar. Confirm whether `/t/[slug]` is a real route or only a post-login redirect target.
9. **`StatusBadge` vs `StateChip`** — architecture §5 lists `StatusBadge`, DESIGN §9.2 mandates `StateChip` for workflow state. Default: one component (`StateChip`); no alias created.
10. **Onboarding timing** — Part 11 §4.14 lists `/onboarding` as tenant-admin first run, but it needs settings/users/imports. Default: Phase 8; confirm.
11. **Untracked partial scaffold in `src/`** — confirm it is disposable draft or must be kept/continued. Nothing will be deleted without confirmation.
