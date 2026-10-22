# Phase 0 — Foundation, shell and tenancy

> **Status:** not started · **Depends on:** nothing · **Unlocks:** phases 1–8
> **Spec map:** Part 12 Phase 0 + Phase 1a · Part 11 §8 step 1
> **Read with:** `DESIGN.md`, `web-design-engineer/spec.md` (Parts 2, 6, 10, 11), `web-design-engineer/ui-ux.md`, `standards/architecture.md`.
> **Authority:** spec wins over DESIGN; ui-ux wins over DESIGN; architecture wins over DESIGN. This file is an execution plan, not a second source of truth.

## 1. Scope

**Ships**

- SvelteKit 2 + Svelte 5 runes + TypeScript strict; Tailwind CSS 4 (`@tailwindcss/vite`), `tailwind-merge`, `clsx`, `cn()`.
- `src/lib/styles/tokens.css` with DESIGN Appendix A verbatim; `src/app.css` with `@theme` and `@theme inline` mapping; system font stack only.
- `mode-watcher` (light / dark / system), `@lucide/svelte`, `svelte-sonner`.
- `shared/lib`: `uuid` (`Uuid`, `isUuid`, `newUuid`, `deterministicUuid`), `format` (pence → GBP `en-GB`, mm with thin space, dates `22 Oct 2026`, Europe/London, percentages, counts), `status` (DESIGN Appendix B state map), `deterministic` (seeded rng, hash).
- Network layer + browser mock backend + `repository-mode` + `repository-errors`; API adapter scaffold that fails loudly (`API_DATA_SOURCE_NOT_AVAILABLE`) until the backend lands.
- RBAC vocabulary: 10 roles, Part 6 §3 permission codes, route permissions, `hasPermission`, `PermissionGate` (UX only).
- Primitives per DESIGN §9.3: Button, Icon button, Link, Input/Textarea, Select/Combobox, Checkbox/Radio/Switch, Tabs, Dialog, Sheet/Side panel, Menu/Popover, Tooltip, Toast, Badge/Pill, Progress, Skeleton, Empty state, Pagination, Breadcrumb, Avatar, Accordion.
- Shared modules owned here: `AppShell`/`TopBar`, `SidebarNav`, `StateChip`, `PermissionGate`, `ErrorBoundary`/`ForbiddenPage`.
- Shell behaviour: skip link first, one `main`, sidebar expanded/rail/drawer, top bar search + sync/notifications/account shells, density + sidebar persistence, breadcrumb, route transitions (fade only).
- Auth: `/login` one common domain, workspace chooser `/t/<slug>` only when the email is ambiguous, MFA step, `/invite/:token`, `/auth/me` tenant branding applied before authenticated paint.
- Platform console **skeleton** (`/platform/tenants`, `/platform/tenants/:id`: list, create, suspend, platform audit) in its own Interio-only shell.
- `/dashboard` placeholder with a designed empty state (real widgets in phase 1).
- Tooling: `scripts/check-architecture.mjs`, Vitest, Playwright baseline, lint/format.

**Not in this phase:** any business data page; real HTTP calls; full platform support grants/logs/onboarding (phase 8); mobile shell (phase 2); dashboard widgets (phase 1).

## 2. Requirements

| Group | Covered here |
|---|---|
| Rules | R1 (uuid helpers), R4 (client is convenience), R8 |
| Requirements | S34 (UI layer only), S39, S40 (console skeleton), S41 (tenant-session denial) |
| NFRs | N5, N7 |
| Gates | none yet; `GateBanner` is built in phase 1 |
| Tests | FT-M1-01…04, TEN-01, TEN-07 (tenant sessions denied on `/platform/*`), C-02, C-06, C-07 |

## 3. Routes and pages

| Route | Shell | Permission | Primary action |
|---|---|---|---|
| `/login` | auth (centred, high brand) | public | Sign in |
| `/invite/:token` | auth | public | Accept invitation |
| `/403` | shell-less | authenticated | Back to dashboard |
| `+error` / 404 | shell-less | public | Go to dashboard |
| `/dashboard` | web app | authenticated | none until phase 1 |
| `/platform/tenants` | platform shell | `platform.tenant.view` | Create tenant |
| `/platform/tenants/:id` | platform shell | `platform.tenant.view` | Suspend tenant |

## 4. Modules and shared components

```text
src/modules/auth/                 domain (session, tenant branding envelope), data/public-api, presentation/pages/{LoginPage,InvitePage}.svelte
src/modules/platform-tenants/     domain, data, presentation/pages/{TenantListPage,TenantDetailPage}.svelte
src/shared/application/           session.ts, navigation.ts, env.ts
src/shared/domain/                roles.ts, permissions.ts, routePermissions.ts, uuid.ts
src/shared/presentation/ui/       all primitives + AppShell, TopBar, SidebarNav, StateChip, PermissionGate, ErrorBoundary
src/network/                      api-client, mock-backend, token-storage, errors, guard
```

Sidebar tree is Part 11 §3 exactly; items render only when their route and permission exist, so later phases reveal sections without rework.

## 5. Data

| Endpoint | Use |
|---|---|
| `POST /auth/login`, `POST /auth/mfa/verify`, `POST /auth/refresh`, `POST /auth/logout` | session |
| `GET /auth/me` | user, roles, permissions, tenant identity + branding |
| `POST /users` | invitation flow (invite page) |
| `GET/POST /platform/tenants`, `POST /platform/tenants/:id/transition`, `GET /platform/audit` | console skeleton |

Mock seeds are deterministic: tenant 1 Opulent, one user per role, the permission catalogue, a few platform audit rows. `tenant.branding` is treated as an opaque envelope and validated before applying (open question B3). No component imports `data/mock*` or adapters.

## 6. Design contract

- Page patterns: shell per DESIGN §10.1; login per §2.2 (highest brand, no marketing copy).
- Tokens only. No hex, no arbitrary Tailwind values, no hardcoded duration/shadow/radius.
- Tenant branding may set accent, hover, soft, on-accent, logo URLs, display name only (§2.4); accent guard §3.8 runs before apply; fall back to brass on failure.
- No logo asset yet: set `Interio` as a text wordmark (B1/B2). Never draw a substitute mark.
- Focus ring 2 px + 2 px offset; translucency only on top bar, dialogs, menus, sheets; solid fallbacks for reduced transparency and `prefers-contrast: more`.
- Motion: 100–300 ms, transform/opacity only; `prefers-reduced-motion` removes movement.
- Density comfortable by default; compact opt-in persists per user.
- No shadcn-svelte, no component library, no webfonts, no emoji icons.

## 7. Work waves (architecture §22)

| Wave | Agent | Exclusive files | Gate |
|---|---|---|---|
| 1 | scaffold | `package.json`, `svelte.config.js`, `vite.config.ts`, `src/app.html`, `src/app.css`, `src/lib/styles/tokens.css`, `src/lib/utils.ts` | build + token grep clean |
| 1 | network | `src/network/**`, `src/shared/data/**` | mock round-trip test |
| 1 | rbac | `src/shared/domain/**`, `src/shared/application/**` | permission unit tests |
| 2 | primitives A | form/layout primitives under `shared/presentation/ui` | a11y smoke |
| 2 | primitives B | overlay/feedback primitives under `shared/presentation/ui` | dialog focus trap test |
| 2 | shell | `AppShell`, `TopBar`, `SidebarNav`, route layouts | keyboard + skip-link check |
| 3 | auth | `src/modules/auth/**`, `(auth)` routes | login/chooser/branding flow |
| 3 | platform | `src/modules/platform-tenants/**`, `/platform` routes | tenant-session denial |
| 4 | gates | boundary script, Playwright baseline, screenshots | all gates green |

## 8. Done when

- [ ] App builds and runs; no boundary violations from `check-architecture.mjs`.
- [ ] Tokens only; light, dark and `prefers-contrast: more` all render.
- [ ] 320–1920 px with no horizontal page scroll; 200 % text zoom without clipping.
- [ ] Every target ≥ 44 × 44 px with ≥ 8 px gaps; keyboard-only path through shell and login.
- [ ] One `h1` per page, landmarks correct, skip link first, visible focus everywhere.
- [ ] Exactly one primary action per screen.
- [ ] Login resolves the tenant without a tenant parameter; workspace chooser only when ambiguous; branding paints before the authenticated shell.
- [ ] Tenant session on any `/platform/*` route renders 403 and the server call is denied.
- [ ] Playwright baseline captured at 320 / 768 / 1280 / 1920, light + dark.

## 9. Open questions

B1/B2 (logo assets → text wordmark), B3 (`tenant.branding` envelope shape), Q11 (auth/MFA provider), Q21 (platform staff roster / grant defaults), Q9 (mobile platform baseline, needed by phase 2).
