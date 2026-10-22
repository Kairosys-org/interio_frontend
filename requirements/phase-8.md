# Phase 8 — Admin, governance and the platform console

> **Status:** not started · **Depends on:** phases 0–7 · **Unlocks:** release
> **Spec map:** Part 12 Phase 1a governance + Phase 0 console completion · Part 11 §8 steps 10–11
> **Read with:** `DESIGN.md` §2.2/§10.2/§11, `spec.md` Parts 2, 6, 10 §3–4/§23/§25–26, 11 §4.12–4.14.

## 1. Scope

**Ships**

- Users list/detail: create via invitation, state transitions, role grants, MFA status, session revoke.
- Roles list/detail: permission matrix editor (system roles locked), permissions catalogue (read-only).
- Audit log: filters (object, actor, action, date), detail drawer with before/after, CSV export.
- Settings key cards: VAT default, mark-up default, manufacturing-critical target list, label template, retention keys, per-card save with audit.
- Deletion requests: queue, two-approval state, execute (System Admin, anonymise default) with never-touch list enforced.
- Account: profile, password change; security: session/device list + revoke, MFA enrolment.
- Import centre (all kinds) and export centre (datasets the caller holds X on, status, download).
- Onboarding wizard: branding → VAT/currency/reference pattern → invite users → role bundles → import → readiness; re-entrant from settings.
- Platform console complete: tenants list/detail/export/suspend, support grants (scope, reason, TTL ≤ 72 h, revoke, countdown), platform audit, logs with payload masking banner.
- Shared modules: `PermissionGate`, `AuditTrailTab`, `EvidenceUploader` reused; no new primitives.

**Not in this phase:** billing/subscriptions (decision), tenant switcher (decision), CRM pages (future phase).

## 2. Requirements

| Group | Covered here |
|---|---|
| Rules | R1, R3, R4, R8 |
| Requirements | S34, S35, S38, S39–S41 |
| NFRs | N5, N6, N11 (operator side) |
| Tests | FT-M14-01…04, FT-M15-01…03, TEN-05…07, TEN-12, OPS-04, E2E-01 full, C-02/C-08 |

## 3. Routes and pages

| Route | Permission | Primary action |
|---|---|---|
| `/admin/users`, `/admin/users/:id` | `user.view` | Invite user |
| `/admin/roles`, `/admin/roles/:id` | `role.view` | Save permissions |
| `/admin/permissions` | `role.view` | none (read-only) |
| `/admin/audit` | `audit.view` | Export CSV |
| `/admin/settings` | `setting.view` | Save changes |
| `/admin/deletion-requests` | `record.delete_request` | Request deletion |
| `/account/profile` | authenticated | Save changes |
| `/account/security` | authenticated | Enrol MFA / Revoke session |
| `/imports`, `/imports/new`, `/imports/:id` | `import.view` / `import.create` | Commit import |
| `/exports` | dataset X grant | Request export |
| `/onboarding` | tenant admin | Continue |
| `/platform/tenants`, `/platform/tenants/:id` | `platform.tenant.view` | Create / Suspend |
| `/platform/support` | `platform.support.grant` | Issue grant |
| `/platform/audit` | `platform.audit.view` | Open event |
| `/platform/logs` | `platform.log.view` | Open log |

## 4. Modules and shared components

```text
src/modules/admin-users/     domain, data, presentation UserListPage, UserDetailPage, InviteDialog
src/modules/admin-roles/     domain (permission matrix), data, presentation RoleListPage, RoleDetailPage, PermissionGrid
src/modules/admin-audit/     domain, data, presentation AuditPage, AuditDetailDrawer
src/modules/admin-settings/  domain, data, presentation SettingsPage, SettingCard, CriticalTargetEditor
src/modules/deletion/        domain, data, presentation DeletionQueuePage, TwoApprovalState
src/modules/account/         domain, data, presentation ProfilePage, SecurityPage, SessionList
src/modules/imports/         complete kinds, list polish, commit dialog
src/modules/export-centre/   domain, data, presentation ExportCentrePage, DatasetPicker, ExportHistory
src/modules/onboarding/      domain (step state), data, presentation OnboardingPage, StepRail
src/modules/platform-tenants/ complete detail, export, suspend reasons
src/modules/platform-support/ domain, data, presentation SupportGrantsPage, GrantTimeline
src/modules/platform-audit/  domain, data, presentation PlatformAuditPage
src/modules/platform-logs/   domain, data, presentation PlatformLogsPage, MaskingBanner
```

Platform pages render in the separate shell: Interio brand only, never tenant-branded, visually distinct from the tenant app.

## 5. Data

| Endpoint | Use |
|---|---|
| `/users`, `/users/:id`, `/transition`, `/roles`, `/permissions` | admin identity |
| `/roles/:id/permissions` | matrix save |
| `/audit-events`, `/audit-events/:id`, `?format=csv` | audit |
| `/settings`, `PUT /settings/:key` | settings |
| `/deletion-requests`, `/:id/approve`, `/:id/execute` | governed deletion |
| `/auth/sessions`, `/auth/password/change`, MFA endpoints | account |
| `/imports*`, `/exports`, `/exports/:id` | data in/out |
| `/platform/tenants*`, `/support-grants*`, `/platform/audit`, `/platform/logs` | console |

Mock seeds: 10 role users, a permission matrix, audit events for every mandatory category, a pending deletion request with one approval, import batches in all outcomes, export history, platform tenants/grants/logs including an expired grant.

## 6. Design contract

- Settings pattern: key cards with current value, scope and per-card save; changes audited and stated in the card.
- Permission matrix: grid like Part 6 §3, system role rows locked with a visible lock + text; changes confirm with a diff summary.
- Deletion: destructive styling, two named approvals, anonymise default explained; never-touch rows cannot be selected.
- Platform shell is neutral and clinical (DESIGN §1.4); no tenant accent leaks in.
- Logs page shows metadata; business payloads masked with a banner explaining the active-grant rule (not a tooltip).
- Import wizard and export centre reuse the phase 1/3 patterns; commit and export both confirm counts.
- Onboarding is a wizard: one decision per step, back preserves data, review before finish, re-entrant.
- No billing pages, no tenant switcher, no CRM pages anywhere.

## 7. Work waves

| Wave | Agent | Exclusive files | Gate |
|---|---|---|---|
| 1 | users + roles | `modules/admin-users/**`, `modules/admin-roles/**` | matrix lock + session revoke |
| 1 | audit + settings | `modules/admin-audit/**`, `modules/admin-settings/**` | append-only + audited saves |
| 2 | deletion + account | `modules/deletion/**`, `modules/account/**` | two approvals + never-touch |
| 2 | imports + export centre | `modules/imports/**`, `modules/export-centre/**` | new-rows-only + scoped CSV |
| 3 | onboarding | `modules/onboarding/**` | re-entrant + readiness |
| 3 | platform console | `modules/platform-*/**` | claim-only + grant expiry |
| 4 | full gates | E2E-01, TEN suite, OPS-04, Playwright all shells | release gate |

## 8. Done when

- [ ] System roles cannot be edited; permission changes are audited and reflected after reload.
- [ ] Suspending a user kills sessions immediately; disabled users keep historical audit references.
- [ ] Audit UI cannot mutate or delete rows; CSV carries the filters used.
- [ ] Deletion requires two distinct approvals and refuses every never-touch row.
- [ ] Tenant sessions cannot reach `/platform/*`; grants expire with no grace period and are flagged in both trails.
- [ ] Logs mask business payloads without an active grant and explain why.
- [ ] Import never updates/deletes existing rows; export never returns rows the caller cannot view.
- [ ] No billing, tenant switcher or CRM surface exists.
- [ ] E2E-01 runs end to end; DESIGN §15 passes on every shell.

## 9. Open questions

Q20 (per-tenant quotas and restore drill), Q21 (operator roster and default grant TTL), Q11 (MFA provider), Q12 (storage/backup targets), Q13 (breach procedure and privacy text).
