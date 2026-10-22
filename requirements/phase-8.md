# Phase 8 — Admin, governance, platform console

> **Status:** not started · created 2026-10-22
> **Depends on:** phase-0 … phase-7 · **Unlocks:** release
> **Spec map:** `spec.md` Part 12 §1 "Phase 0 — Tenancy foundation" (platform console slice) + M14/M15; Part 11 §4.1 (dashboard, activity), §4.12 (admin and account), §4.13 (export centre already shipped), §4.14 (onboarding, platform console); Part 10 §3, §4, §22–§23, §25; Part 6 in full (RBAC, audit, deletion, retention); Part 2 §2.4–§2.5; Part 13 TEN-01…TEN-12, FT-M14-01…04, FT-M15-01…03, FT-M13-01…02, E2E-01…08, C-01/C-04/C-06/C-08.
> **Read with:** `spec.md` Part 2 §2.3–§2.6 + §2.9, Part 6 in full, Part 10 §3–§4 + §22–§23 + §25, Part 11 §4.1 + §4.12 + §4.14, Part 4 §1 (user/deletion states), Part 12 §4 (Q11–Q13, Q20–Q21), Part 13 §4–§8; `DESIGN.md` §2.2 (platform console), §3.7 + Appendix B, §9.2 (`PlatformShell`, `PermissionGate`, `AuditTrailTab`, `ScanInput`-style validation), §10.2 (Dashboard, Settings, Audit, Platform console), §10.3, §12, §13.2/§13.4, §15; `ui-ux.md` §9, §13, §15, §17; `standards/architecture.md` §3–§4, §8–§11, §16, §20–§22; `testing/ui-ux-tester.md`.
> **DESIGN.md blocker:** Draft V1.0 · awaiting approval (Rule 1.5).
> **Branch:** RULE 0 — `main` only, no PR.
> **Frontend only:** mock-first. Governance rules (two-approver deletion, append-only audit, masked logs, grant TTL) are enforced in the mock exactly as the spec defines, so the UI can prove them.
> **Prerequisite:** all prior phases `Status: completed` and gate green.

---

## 1. Scope

### Ships

1. **`admin` module**
   - `/admin/users`, `/admin/users/[id]`: list, create/invite, state transitions (`active | suspended | disabled`) with a session-revoke notice, roles multi-select, MFA status.
   - `/admin/roles`, `/admin/roles/[id]`: role list; permission matrix editor (grid from Part 6 §3; system role rows locked).
   - `/admin/permissions`: read-only catalogue grouped by object.
   - `/admin/settings`: key cards — VAT default, mark-up default, manufacturing-critical measurement list (editable array), label template version, retention keys; changes audited per card.
   - `/admin/deletion-requests`, `/admin/deletion-requests/[id]`: queue, two-approver state (Owner/Management **and** System Admin), execute (System Admin, anonymise by default), audited at every step.
2. **`audit` module**
   - `/activity`: personal/tenant audit stream (actor, action, object chips, expandable before/after).
   - `/admin/audit`: filterable log (object type/id, actor, action, date), detail drawer, CSV export where permitted.
   - Retention report view (review-due classes, no automatic deletion — FT-M14-03).
3. **`dashboard` module** — `/dashboard` becomes the role widget grid: my surveys due, quotes awaiting approval, jobs by stage, workshop queue, payments due, open snags; StageIndicator where a project/job context exists; global search entry. Widgets read `/reports/pipeline` + scoped lists, permission-filtered.
4. **`account` module**
   - `/account/profile`: name, email, password change.
   - `/account/security`: session/device list + revoke, MFA enrolment (provider per Q11).
5. **`onboarding` module** — `/onboarding`: tenant-admin first-run wizard (branding → VAT/currency/reference pattern → invite users → role bundles → import centre → readiness checklist); re-entrant from Admin → Settings; completion state persisted and audited.
6. **`platform` module** (separate shell, Interio-only branding, no tenant navigation)
   - `/platform/tenants`, `/platform/tenants/[id]`: tenant table (status, row counts, storage), CreateTenantModal with defaults (name, slug, branding, currency, VAT, reference pattern, admin email), suspend/activate with reason, full export button, invite re-send.
   - `/platform/support`: grant manager (scope chips, reason, TTL ≤ 72 h), live expiry countdown, immediate revoke, per-tenant grant history.
   - `/platform/audit`: platform event stream (tenant created/suspended/exported, grants issued/used/expired) with detail drawer.
   - `/platform/logs`: log browser filtered by level/tenant/request id; payloads masked unless an active support grant covers the tenant, with a banner explaining why (S41).
   - Platform routes deny tenant sessions; a platform claim is required (from `/auth/me`); every platform action writes `platform_audit_event` **only**.
7. **Governance enforcement (frontend contract)** — append-only audit (no edit/delete affordance anywhere), no destructive delete path except the governed request, masked logs, grant TTL countdown, permission matrix locked rows, session revoke on suspension.
8. **Shared UI** additions in §4.2.
9. **Release verification for the frontend** — every route in Part 11 §3 exists, is permission-gated and tested; all exclusions (Part 11 §7) hold.

### Not in this phase

- Billing/plans/invoices (permanent exclusion), tenant switcher (permanent exclusion), CRM/lead pages, stock, maps, second renderer.
- Automatic retention deletion (OPS drill, not UI), backup/restore tooling (Q20), breach procedure (Q13 legal text).
- Any new business module.

---

## 2. Requirements

| Requirement | Where it is enforced |
|---|---|
| S34/N5 — user states, MFA, session revoke | `admin` mock transitions; suspension notice; account security page |
| S35/N6/R3 — append-only audit, governed deletion | `audit` read-only; deletion request machine with two distinct approvals; no delete/edit affordance; execute anonymises |
| R4 — permission matrix is the contract | `/admin/roles/[id]` grid from Part 6 §3; system rows locked; matrix change audited |
| R8/S39 — tenant isolation | platform routes deny tenant sessions; no tenant switcher; platform actions audited separately |
| S40 — tenant lifecycle | create with defaults + first-admin invite, suspend/activate with reason, full export, invite re-send |
| S41 — support access | grant scope/reason/TTL ≤72 h, countdown, revoke, history; logs masked unless a grant is active |
| FT-M13-01/02 — dashboard and reports match aggregates; CSV permission-filtered + audited | dashboard widgets read the same report endpoints; export action reused from Phase 7 |
| FT-M14-01…04 | audit sweep, two-approver deletion, retention view, export limits (shipped Phase 7) |
| FT-M15-01…03 | tenant create idempotency surface, full export, platform-only audit |
| TEN-01…TEN-12 (frontend scope) | isolation, tenant context, platform separation, branding, denied cross-tenant access |
| Part 11 §7 exclusions | no billing, no project QR, no CRM pages, no Detel screens, no tenant switcher |
| A11y + design gates | DESIGN §12.6, §15.1–§15.4, ui-ux §19 |

---

## 3. Routes and pages

| Route | Page component | Permissions | Endpoints | Notes |
|---|---|---|---|---|
| `/dashboard` | `dashboard/presentation/pages/DashboardPage.svelte` | all authenticated | `/auth/me`, `/reports/pipeline`, scoped lists | role widget grid, replaces Phase 0 shortcuts |
| `/activity` | `audit/presentation/pages/ActivityPage.svelte` | `audit.view` | `GET /audit-events` | stream + before/after |
| `/admin/users` | `admin/presentation/pages/UsersListPage.svelte` | `user.view` | `GET /users` | filters, invite |
| `/admin/users/[id]` | `UserDetailPage.svelte` | `user.view` | `GET/PATCH /users/:id`, `POST /users/:id/roles` | states, roles, MFA |
| `/admin/roles` | `RolesListPage.svelte` | `role.view` | `GET /roles` | list |
| `/admin/roles/[id]` | `RoleDetailPage.svelte` | `role.view` | `GET/PATCH /roles/:id/permissions` | matrix grid, system rows locked |
| `/admin/permissions` | `PermissionsPage.svelte` | `role.view` | `GET /permissions` | read-only, grouped |
| `/admin/audit` | `AdminAuditPage.svelte` | `audit.view` | `GET /audit-events` | filters + drawer + CSV |
| `/admin/settings` | `SettingsPage.svelte` | `setting.view` | `GET /settings`, `GET/PUT /settings/:key` | key cards, per-card save |
| `/admin/deletion-requests` | `DeletionRequestsPage.svelte` | `record.delete_request` | `GET /deletion-requests` | queue + two-approver state |
| `/admin/deletion-requests/[id]` | `DeletionRequestDetailPage.svelte` | `record.delete_request` | `GET /deletion-requests/:id`, approve/execute | two distinct approvers, anonymise |
| `/account/profile` | `account/presentation/pages/ProfilePage.svelte` | authenticated | `GET /auth/me`, `POST /auth/password/change`, `PATCH /users/:id` (self) | name, email, password |
| `/account/security` | `SecurityPage.svelte` | authenticated | `GET /auth/sessions`, revoke, MFA endpoints | sessions + MFA |
| `/onboarding` | `onboarding/presentation/pages/OnboardingPage.svelte` | tenant admin | `/settings`, `/users`, `/imports` | six-step wizard, re-entrant |
| `/platform/tenants` | `platform/presentation/pages/TenantsPage.svelte` | platform claim | `GET/POST /platform/tenants` | table + create modal |
| `/platform/tenants/[id]` | `TenantDetailPage.svelte` | platform claim | `GET /platform/tenants/:id`, transition, export, invite | suspend/activate + reason |
| `/platform/support` | `SupportGrantsPage.svelte` | platform claim | grants endpoints | issue/revoke, countdown |
| `/platform/audit` | `PlatformAuditPage.svelte` | platform claim | `GET /platform/audit` | event stream |
| `/platform/logs` | `PlatformLogsPage.svelte` | platform claim | `GET /platform/logs` | masking + banner |

`/platform/**` uses its own layout (`PlatformShell`), Interio-only branding, no sidebar items from the tenant tree, and denies tenant sessions with the 403 page.

---

## 4. Modules and shared components

### 4.1 Modules

| Module | Domain | Data | Presentation |
|---|---|---|---|
| `admin` | `AppUser`, `UserState`, `Role`, `Permission`, matrix types, `userFormSchema`, `roleMatrixSchema`, `settingsSchemas`, `DeletionRequest` | repository, provider, `adminApi`, mock, seed, adapters, mappers, tests | users list/detail, roles list/detail, permissions, settings, deletion queue/detail |
| `audit` | `AuditEvent`, `AuditFilter`, retention classes | repository, provider, `auditApi`, mock, seed, adapters, mappers, tests | activity, admin audit, filters, diff drawer, retention view |
| `dashboard` | widget registry, role scoping, metric view models | reads `reportsApi` + scoped lists (no new repository) | widget grid, `DashboardWidget` usage, global search entry |
| `account` | password/MFA schemas, session view model | repository, provider, `accountApi`, mock, adapters, tests | profile, security, session list |
| `onboarding` | step schema, completion state, readiness checklist | repository, provider, `onboardingApi`, mock, adapters, tests | wizard with six steps + resume |
| `platform` | `PlatformTenant`, `SupportGrant`, `PlatformAuditEvent`, `LogEntry`, masking rules, `grantSchema`, `createTenantSchema` | repository, provider, `platformApi`, mock, seed, adapters, mappers, tests | tenants, tenant detail, support, audit, logs, `PlatformShell` |

### 4.2 Shared UI added

| Component | Contract | Notes |
|---|---|---|
| `PlatformShell` | DESIGN §9.2 / §11 | separate Interio shell, no tenant navigation, visually distinct |
| `PermissionMatrix` | Part 6 §3 grid | rows/columns with sticky headers, locked system rows, keyboard editable, change summary |
| `DashboardWidget` | DESIGN §10.2 | title, metric, trend, link; skeleton/empty/error |
| `GrantCountdown` | DESIGN §9.2 + S41 | live TTL, expiry warning, revoke |
| `MaskedLogViewer` | Part 11 §4.14 | masked payloads by default, banner explaining the active grant, request-id filter |
| `DiffView` (before/after) | DESIGN §9.2 `AuditTrailTab` | labelled "Before"/"After", `<time>` |
| Reuse | `DataTable`, `EvidenceUploader` (tenant export?), `ConfirmDialog`, `StateChip`, `AsyncState` | no duplicates |

### 4.3 Orchestrator wiring

All remaining route permissions; nav Admin/Account/Data sections + platform nav; `ROUTE_PERMISSIONS` completeness audit for every `(dashboard)` route; platform-claim guard; `COLLECTIONS`; `mock-bootstrap`; schema bump + migration; tracker; final docs.

---

## 5. Data

### 5.1 Collections

`app_user` (extended), `role`, `permission`, `role_permission`, `user_role`, `setting`, `audit_event` (read-only), `deletion_request`, `deletion_approval`, `retention_class`, `platform_audit_event`, `support_access_grant`, `log_entry`, `onboarding_state`, `auth_session`.

### 5.2 Seed

- Users for every role plus suspended/disabled/MFA-off cases; one invitation pending.
- Roles: system roles (locked) + one example custom role; a permission matrix with representative grants per role.
- Settings: VAT, mark-up, critical measurements (multi-entry), label template version, retention keys; one invalid value fixture.
- Deletion requests: one awaiting first approval, one awaiting second, one approved-and-executed (anonymised), one rejected.
- Audit events spanning every mandatory Part 6 §7 category the seed exercises; a before/after diff fixture.
- Platform: 3 tenants (active, suspended, offboarded), grants (active with countdown, expired, revoked), platform audit events, log entries with masked and unmasked-under-grant fixtures.
- Onboarding: one tenant mid-wizard, one complete.
- Deterministic ids/dates; no wall-clock values in seeds.

### 5.3 Mock behaviour

- User suspension revokes sessions immediately (next request `unauthorized`); state changes and role changes audited; a user cannot remove their own last admin capability if the spec forbids it (report if undefined).
- Permission matrix: system role rows locked; changes audited with before/after; unknown permission codes rejected.
- Settings: per-key validation (VAT 0–100, mark-up ≥ 0, critical list keys unique, retention positive), audited per card.
- Deletion: request requires a reason; two **distinct** approvers (Owner/Mgmt + System Admin) in order; executing without both → `gate_blocked`; execute anonymises the record and keeps non-touchable rows (jobs, parts, payments, approvals, issued versions, audit) impossible to delete; every step audited.
- Audit: append-only; no endpoint to edit/delete; filters return deterministic order.
- Platform: tenant create honours `Idempotency-Key` (same key → same tenant); suspend/activate requires a reason; full export returns the tenant dataset mock; all platform actions only write `platform_audit_event`.
- Support grants: TTL ≤72 h enforced, reason required, scope required, revoke immediate; expired grant cannot be used; log masking lifts only while an active grant covers that tenant, and the banner names it.
- Logs: masked payloads by default; request-id/level/tenant filters; no cross-tenant rows without a grant.
- Onboarding: steps can be revisited, completion is persisted, each step audited; skipping is allowed unless the spec marks the step required.

### 5.4 Tests

- Domain: matrix diff/validation, settings schemas, grant TTL rules, masking rules, deletion state machine, dashboard widget scoping.
- Mock: suspension/revoke, matrix lock, deletion two-approver + anonymise + non-deletable rows, platform idempotency, grant expiry, log masking, onboarding resume.
- Component: permission matrix editing + locks, grant countdown, masked log viewer, dashboard widgets.
- E2E: invite → accept → role change → suspend (session revoked); two-approver deletion; tenant create/suspend/export; grant issue → logs unmasked → expire → masked again; onboarding resume; dashboard widgets per role; `/platform/*` denied to a tenant session.

---

## 6. Design contract

- **Dashboard:** widget grid; each widget card has a title, metric, trend and link; role-scoped; skeletons match layout; no fabricated metrics (values come from report endpoints); empty state explains the next action.
- **Admin surfaces:** form/edit pattern (single column max 68 rem, sections, per-card save on settings); dense tables for users/audit; matrix grid with sticky headers and keyboard editing; system rows visibly locked with a lock icon + text.
- **Audit:** filter bar + timeline/table, `<time>` with ISO value, before/after diff labelled, CSV where permitted; no edit/delete affordance.
- **Governed deletion:** two distinct approval slots shown with the approver name/date; execute button behind confirmation stating "anonymise" and what is kept; blocked state lists the missing approval; no destructive styling on approval, danger only on execute.
- **Account:** password change inline errors; session list with device, last seen, revoke (confirmation); MFA enrolment flow explained in context.
- **Platform console:** Interio-only, neutral/clinical, medium density, clearly distinct from the tenant app; no tenant branding; grant countdown live; masks visible with an explanation banner (never a silent redaction); logs monospace payloads.
- **Onboarding:** six-step stepper, one decision per step, back preserves data, readiness checklist at the end, re-entrant from settings.
- **A11y:** matrix grid keyboard complete with announced cell state, countdown `aria-live`, masked data announced as masked, focus traps, 200 % zoom, dark/high contrast.

---

## 7. Work waves

| Wave | Agent | Exclusive paths | Gate |
|---|---|---|---|
| 0 (serial) | orchestrator | interfaces for six modules, platform guard/claim contract, matrix/grant/deletion contracts, wiring list | `pnpm check` |
| 1 (parallel, 4) | data-agent group 1 | `modules/admin/{domain,data}/**`, `modules/account/**` | mock + domain tests |
| 1 (parallel, 4) | data-agent group 2 | `modules/audit/**`, `modules/dashboard/**`, `modules/onboarding/**`, `modules/platform/**` | mock + domain tests |
| 2 (parallel, 4) | ui-agent group 1 | admin users/roles/permissions/settings/deletion pages + routes | page smoke + component tests |
| 2 (parallel, 3) | ui-agent group 2 | account, audit/activity, dashboard | page smoke + component tests |
| 2 (parallel, 1) | ui-agent group 3 | platform pages + `src/routes/platform/**` + `PlatformShell` layout | platform e2e |
| 2 (parallel, 1) | shared-ui-agent | `PlatformShell`, `PermissionMatrix`, `DashboardWidget`, `GrantCountdown`, `MaskedLogViewer`, `DiffView` | component tests |
| 3 (serial) | orchestrator | wiring (all routes/nav/claim guard/collections/bootstrap/schema+migration/tracker/final docs) | check/lint/arch:check |
| 4 (parallel) | gate-runner + boundary-reviewer | read-only | full gate + boundary + route-coverage report |
| 5 | orchestrator | Rule 3 matrix on 19 routes + governance flows, fixes, commits | post-fix screenshots |
| 6 | orchestrator | final release sweep: every Part 11 §3 route exists + gated; exclusions hold; all phases complete; docs tracker final | full gate + release report |

---

## 8. Done when

- [ ] Every route in Part 11 §3 exists, is permission-gated, and denies direct access without permission with the 403 page; `ROUTE_PERMISSIONS` covers every `(dashboard)` and platform route.
- [ ] Users: invite/create, role multi-select, suspend (session revoked on next request), disable; MFA status visible; every change audited.
- [ ] Roles: permission matrix from Part 6 §3, system rows locked, changes audited with before/after; `/admin/permissions` catalogue grouped by object.
- [ ] Settings: VAT, mark-up, critical-measurement array, label template version, retention keys each save per card with validation and audit.
- [ ] Deletion: request → two distinct approvals (Owner/Mgmt + System Admin) → execute anonymises; missing approval blocks; protected rows can never be deleted; every step audited.
- [ ] Audit: `/activity` and `/admin/audit` filter correctly with before/after diffs and CSV; no edit/delete affordance exists; retention classes are view-only (no silent deletion).
- [ ] Account: profile update and password change work with inline errors; sessions list + revoke; MFA enrolment flow completes.
- [ ] Onboarding: six-step wizard completes, persists, is re-entrant, and each step is audited.
- [ ] Platform: tenants list/create (idempotent)/suspend/activate with reason/full export/invite re-send; support grants with ≤72 h TTL, live countdown and immediate revoke; platform audit stream; logs masked unless an active grant covers the tenant, with an explanatory banner; **tenant sessions are denied** and no tenant navigation leaks into the platform shell; only `platform_audit_event` rows are written.
- [ ] Dashboard: role widget grid reads real report/scoped endpoints, permission-filtered, with skeletons/empty/error; the Phase 0 shortcut page is replaced.
- [ ] Exclusions hold: no billing, no project QR, no CRM pages, no Detel screens, no tenant switcher.
- [ ] `arch:check` 0; no mock/adapter imports in presentation; no business rules in `.svelte`; no Svelte 4 syntax; UUIDs + deterministic seeds; schema version final with migrations.
- [ ] Unit + e2e suites pass (all phase suites together); browser matrix on every remaining route, dark, high contrast, 200 %, keyboard, zero console errors.
- [ ] Full pnpm gate green; all phases marked complete; committed and pushed to `main`; release report lists what is enforced, the open questions still blocking product decisions, and the next action.

---

## 9. Open questions (report, never guess)

1. **Q11 auth/MFA provider and SSO** — account security/MFA enrolment depends on the chosen provider; mock implements TOTP-like codes only.
2. **Q12 hosting/object storage/backup RPO-RTO** — platform full export and storage counts are mock values; real quotas depend on Q20.
3. **Q13 breach procedure + privacy notice text** — no UI copy is invented; the account/privacy surface stays minimal until supplied.
4. **Q20 per-tenant quotas and restore drill** — tenant table storage/counts are seeded; no quota enforcement UI until defined.
5. **Q21 platform roster and support policy** — who may issue grants, default TTL, notification rules. Default: TTL options ≤72 h, reason required, no notifications.
6. **Custom roles** — Part 6 §3 defines system roles; whether tenants can create roles is unclear. Default: system roles locked, one example custom role seeded; confirm.
7. **Deletion approver identities** — "Owner/Mgmt and System Admin" must be two distinct users; what happens when one is unavailable is unspecified. Default: blocked with an explanation.
8. **Anonymisation fields** — which columns are anonymised per entity is defined by Part 6 §5; any missing entity is reported, not invented.
9. **Log masking rules** — which fields are sensitive is not enumerated. Default: emails, phone numbers, tokens, passwords and free-text payloads masked; confirm with the security owner.
10. **Email delivery for invitations/re-sends** — out of scope for the frontend; the mock shows a queued/sent state. Confirm no SMTP UI is expected.
11. **Onboarding step order** — Part 11 §4.14 lists branding → VAT/currency/reference → invite users → role bundles → import centre → readiness. Confirm the order and which steps are mandatory.
12. **Dashboard widget set per role** — Part 11 §4.1 lists example widgets; the exact per-role composition is not enumerated. Default: widgets follow the role → section matrix and the report endpoints available; any widget without a defined endpoint is omitted and reported.
13. **Platform claim shape in `/auth/me`** — Part 2 §2.5 says a platform claim, not a tenant role; the JSON shape is undefined. Default: validated envelope with `platform: { operatorId, scopes[] }`; raise when the backend defines it.
