# Phase 1 — Records spine (customers, properties, projects)

> **Status:** not started · created 2026-10-22
> **Depends on:** phase-0 · **Unlocks:** 2–8
> **Spec map:** `spec.md` Part 12 §1 "1b — Records spine"; Part 11 §4.2 (customers, customer detail, properties, projects, project hub, dedup queue) and §4.13 (imports, customer/property/project kinds); Part 10 §5–§6 and §26; Part 5 §4.1–§4.3 and §5 (dedup); Part 4 §1 (customer/property/project states); Part 6 §3; Part 13 FT-M2-01…04, C-02, C-08.
> **Read with:** `spec.md` Part 5 §4.1–§4.3 + §5, Part 6 §3 + §7, Part 10 §5–§6 + §26, Part 11 §4.2 + §4.13 (import sections only), Part 13 §3 (M2); `DESIGN.md` §3.7 + Appendix B (states), §5.5 (density), §9.2 (`DataTable`, `AssignmentPanel`, `DedupReviewModal`, `AuditTrailTab`, `StageIndicator`, `GateBanner`), §10.2 (List, Detail hub, Wizard), §12, §15; `ui-ux.md` §6–§9, §13, §15; `standards/architecture.md` §3–§4, §9–§11, §16 (Mode B), §22; `testing/ui-ux-tester.md`; `testing/standards/basic-rules.md`.
> **DESIGN.md blocker:** Draft V1.0 · awaiting approval (Rule 1.5). Plan now, implement after approval or "proceed on draft".
> **Branch:** RULE 0 — `main` only, no PR.
> **Frontend only:** mock-first; API adapters map Part 10 DTOs and fail with `API_DATA_SOURCE_NOT_AVAILABLE` until the backend exists.
> **Prerequisite:** phase-0 `Status: completed` and gate green. Unknown fields/rules are reported in §9, never invented.

---

## 1. Scope

### Ships

1. **`customers` module** — list (search, state filter, sort, keyset pagination, URL-synced filters), detail hub (header card, tabs Properties / Projects / Quotes / Audit — later tabs arrive with their phases), create/edit modal or page, archive action with confirmation, `prefers` channel, contact normalisation display (lowercase email, digits-only phone), dedup candidates handled inline on create.
2. **`properties` module** — list + detail (address block, access notes, projects list, audit tab later), create/edit with customer link, archive.
3. **`projects` module** — list with type/status/assigned-surveyor filters and stage counts; **New project wizard** (customer → property → project → assign surveyor(s) → review); **project hub** with `StageIndicator` (compact, phase 0 component), summary cards, `AssignmentPanel`, and a tab registry so later phases add Surveys / Designs / Quotes / Orders / Job without two agents editing the hub file; state transitions allowed by Part 4.
4. **`duplicates` module** — `/dedup-queue`: held `pending_review` rows, side-by-side compare, `link_to_existing` / `confirm_distinct` + mandatory note, audited, never auto-merged.
5. **`imports` module** — list of batches (kind, status chips, row counts), wizard (upload → kind → `ColumnMapper` → `PreviewTable` with validation flags → stage), batch detail (`RowOutcomesTable` filtered imported/needs_review/rejected, per-row linked record or verbatim error), commit behind a confirm dialog showing counts, enabled only while `staged`. CSV parsing and validation live in `domain/` (architecture §2 domain parsers).
6. **Imports kinds in this phase:** customers, properties, projects. `suppliers` / `materials` kinds are registered by Phase 3 through the orchestrator wiring patch; export centre is Phase 7.
7. **Shared UI** additions listed in §4.2 and registered in the phase-0 ledger.
8. **Audit trail**: `AuditTrailTab` on customer, property, project and dedup rows via `/audit-events?object_type=&object_id=`.
9. **R5 dedup behaviour** everywhere a customer/property/project is created (manual or import): a candidate match returns `409 dedup_candidates`, the row is held `pending_review`, and the UI routes the user to review — no silent merge, no overwrite.

### Not in this phase

- Surveys, designs, quotes, orders, jobs, payments, catalogue, materials, installations, aftercare, reports, `/dashboard` widgets, `/activity`, `/admin/*`, `/account/*`, `/onboarding`, `/platform/*`, `/m/*`, `/s/:token`, `/exports`.
- StageIndicator **data** from `/projects/:id/summary` is mocked here; real cross-module stage computation arrives as other modules land, without changing the component contract.
- Import kinds other than customer/property/project; export centre.
- Dedup threshold/rules beyond what Part 5 §5 and Part 10 §5 define (see §9).

---

## 2. Requirements

| Requirement | Where it is enforced |
|---|---|
| R5 — duplicate prevention, never auto-merge | mock create paths return `ApiError` `conflict` + `dedup_candidates`; `duplicates` module review actions; imports create new rows only |
| S1 — surveyor assignment on the project hub | `projects` `AssignmentPanel`; only users holding the Surveyor role can be selected; each add/remove is audited; removal copy states existing surveys are kept and new ones blocked |
| S2 — project context | project hub is the entry point later phases hang off |
| S38 — governed imports | `imports` wizard + staged/committed/cancelled machine (Part 4 §1); commit is atomic and audited with counts |
| R1 — UUID identity | all ids/foreign keys `Uuid`; route `[id]` validated with `isUuid`; captions used in UI |
| R3 — no destructive loss | archive instead of delete; no delete path exists (governed deletion is Phase 8) |
| Part 11 §1 — every list is server-side filtered, URL-reflected | `DataTable` URL-synced params + mock list params |
| Part 11 §1 — detail pages show state chip + gate banner + audit tab | header contract on each hub |
| Part 6 §3 permissions | `customer.*`, `property.*`, `project.*`, `import.*` constants from phase 0's full matrix; `PermissionGate` on create/edit/archive/assign/review/commit |
| A11y + design gates | DESIGN §12.6, §15.1–§15.4, ui-ux §19 |

---

## 3. Routes and pages

| Route | Page component | Permissions | Endpoints (Part 10) | Notes |
|---|---|---|---|---|
| `/customers` | `customers/presentation/pages/CustomersListPage.svelte` | `customer.view` | `GET /customers`, `GET /dedup-queue` | DataTable compact, search, state filter, archive action, New customer |
| `/customers/[id]` | `CustomerDetailPage.svelte` | `customer.view` | `GET /customers/:id`, `PATCH /customers/:id`, children lists | tabs Properties / Projects / Quotes (registered later) / Audit |
| `/properties` | `properties/presentation/pages/PropertiesListPage.svelte` | `property.view` | `GET /properties` | search + customer filter |
| `/properties/[id]` | `PropertyDetailPage.svelte` | `property.view` | `GET/PATCH /properties/:id` | address, access notes, projects |
| `/projects` | `projects/presentation/pages/ProjectsListPage.svelte` | `project.view` | `GET /projects` | type/status/surveyor filters |
| `/projects/[id]` | `ProjectDetailPage.svelte` | `project.view` | `GET /projects/:id/summary`, `GET /projects/:id/assignments`, `POST/DELETE /projects/:id/assignments` | hub + StageIndicator + AssignmentPanel + tab registry |
| `/dedup-queue` | `duplicates/presentation/pages/DedupQueuePage.svelte` | `customer.view` | `GET /dedup-queue`, `POST /customers/:id/dedup/review` (and property/project variants) | compare + note + audited decision |
| `/imports` | `imports/presentation/pages/ImportsListPage.svelte` | `import.view` | `GET /imports` | status chips, row counts |
| `/imports/new` | `NewImportPage.svelte` | `import.create` | `POST /imports` | wizard, one decision per step, back preserves data |
| `/imports/[id]` | `ImportDetailPage.svelte` | `import.view` | `GET /imports/:id`, `GET /imports/:id/rows`, `POST /imports/:id/commit` | per-row outcomes + commit confirm with counts |

Route files are thin: read `page.params.id`, validate, render one page component (architecture §9). New-project wizard is a full page (`/projects/new`), not a modal, because it is long (ui-ux §8.7); customer/property create are dialogs (short task).

---

## 4. Modules and shared components

### 4.1 Modules (each follows the phase-0 anatomy)

| Module | Domain | Data | Presentation |
|---|---|---|---|
| `customers` | `Customer`, `CustomerListParams`, `Create/UpdateCustomerInput`, dedup types, `customerFormSchema` | repository, provider, `customersApi`, mock, seed, adapters, mappers, tests | list, detail, `CustomerForm`, `CustomerHeaderCard`, cells |
| `properties` | `Property`, params, inputs, `propertyFormSchema` | same shape | list, detail, `PropertyForm`, `AccessNotes`, cells |
| `projects` | `Project`, `ProjectAssignment`, wizard values, `projectFormSchema`, `assignmentFormSchema` | same shape | list, detail hub, `NewProjectWizard` (steps), `AssignmentPanel` usage, `ProjectSummaryCards`, `project-tabs.ts` registry |
| `duplicates` | `DedupCandidate`, `DedupDecision`, `dedupReviewSchema` | same shape | queue page, `DedupCompare` |
| `imports` | `ImportBatch`, `ImportRow`, `ImportKind`, `importSchema`, CSV parse + column-map validation in `domain/csv.ts` | same shape | list, wizard, detail, `ColumnMapper`, `PreviewTable`, `RowOutcomesTable` |

### 4.2 Shared UI added (owner files in `src/shared/presentation/ui/`)

| Component | Contract | Used by |
|---|---|---|
| `DataTable` | DESIGN §9.2 (toolbar, sticky header, sort, bulk bar, keyset pagination, stacked cards below `md`, `<caption>`, `aria-sort`) | all five modules |
| `SearchInput` | architecture §5 | lists |
| `DetailSection`, `KeyValueGrid` | architecture §5 / DESIGN §10.2 | detail hubs |
| `EntityLink` | architecture §5 | cross-module captions |
| `ActivityTimeline`, `AuditTrailTab` | DESIGN §9.2 | audit tabs |
| `AssignmentPanel` | DESIGN §9.2 | project hub + wizard |
| `DedupReviewModal` | DESIGN §9.2 | create flows |
| `StageIndicator` | DESIGN §9.2 (+ Part 11 §2, compact mode) | project hub |
| `GateBanner` | DESIGN §9.2 | hub + blocked actions |
| `Stepper` / wizard frame | DESIGN §10.2 | new project, imports |

Not created here: `MoneyField`, `DimensionField`, `VersionTimeline`, `QrPanel`, `ScanInput`, `ValidationList`, `ChecklistDrawer`, `SyncStatusChip`, `EvidenceUploader`, charts, platform shell.

### 4.3 Orchestrator wiring (after the wave)

`PERMISSIONS` additions are already in phase 0; `ROUTE_PERMISSIONS` entries for the ten routes; `NAV_SECTIONS` Sales section items for customers/properties/projects/dedup + Data → Imports; `COLLECTIONS` additions; `mock-bootstrap.ts` imports; `MOCK_DB_SCHEMA_VERSION` bump + migration; tab registries; tracker rows.

---

## 5. Data

### 5.1 Collections (schema version +1)

`customer`, `property`, `project`, `project_user`, `import_batch`, `import_row`, plus audit events (`create`, `update`, `archive`, `assignment_add`, `assignment_remove`, `dedup_review`, `import_commit`).

- `customer`: id, tenantId, caption, contact name, email (normalised lowercase), phone (digits), address/postcode, preferredChannel, state (`active|pending_review|archived|cancelled`), source, `leadUuid: null`, timestamps.
- `property`: id, tenantId, customerId, address lines, postcode, accessNotes, state, timestamps.
- `project`: id, tenantId, customerId, propertyId, reference (display-only), type, status (`active|on_hold|completed|cancelled`), state, timestamps.
- `project_user`: id, tenantId, projectId, userId, assignedAt, assignedBy.
- `import_batch` / `import_row`: kind, status (`staged|committed|cancelled`), counts, column map, row outcome (`imported|needs_review|rejected`), error text, linked record id.

### 5.2 Seed (deterministic)

- 24 customers (2 held `pending_review`, 1 archived), 40 properties, 18 projects across all statuses, 6 surveyors assigned across projects, 2 open dedup pairs, 1 staged import batch for each of the three kinds (one with rejected rows), 1 committed batch, 1 cancelled batch.
- Every id `deterministicUuid('customer:n')`; dates via `demoDays`; values via `seededRng`. No random or wall-clock values.
- Seeds include long names, non-ASCII characters, empty optional fields, and a very long access note to exercise the testing matrix.

### 5.3 Mock behaviour that must exist (server rules mirrored)

- Create customer/property/project → dedup check → `409 conflict` + `dedup_candidates` when a normalised match exists; row held `pending_review`.
- `dedup/review` requires a note for `confirm_distinct`; `link_to_existing` attaches the new row to the existing record and audits both ids; repeat review → `conflict`.
- Assignment: only Surveyor-role users; duplicate assignment → `conflict`; remove keeps existing surveys.
- Project transitions: only those allowed by Part 4 §5 and the caller's permission; illegal → `conflict` with a readable message.
- Import commit: allowed only while `staged`; creates new records only; clashes become `needs_review`; counts audited; repeat commit → `conflict`.
- List endpoints: filter/search/sort/keyset pagination exactly like a server; stable ordering `(createdAt, id)`.

### 5.4 Tests

Per module: `domain/validations.test.ts`, `data/__tests__/mock.repository.test.ts` (CRUD, dedup, transitions, permissions, pagination), mapper tests if an API adapter exists. Cross-module: dedup normalisation, assignment rules, import commit atomicity. E2E journeys: create customer with dedup review → link; create project with wizard + assignment; archive customer; staged import → commit → dedup queue. Tests assert UUID shape and determinism (two resets → identical seed).

---

## 6. Design contract

- **List pages:** Page header (`h1` + one primary "New …") → toolbar (search, filters, density) → DataTable (compact 44 px rows, sticky header, tabular numerals) → pagination. Filters live in the URL. Empty state: explanation + next action. Filtered-empty differs from empty. Table becomes stacked cards below `md`. No horizontal page scroll; wide tables scroll inside.
- **Detail hubs:** header with identity caption, `StateChip`, one primary "next legal action", overflow menu; tabs 2–5 with `aria-selected`, URL tab param; audit tab uses `AuditTrailTab`; `GateBanner` when a transition is blocked.
- **Project hub:** `StageIndicator` compact (current ±1 on narrow screens), summary cards reusing `MetricCard` semantics, `AssignmentPanel` with combobox + removable chips, removal confirmation copy per DESIGN §13.4.
- **Wizard:** stepper, one decision per step, back preserves data, review before commit; mobile sticky action bar above safe area.
- **DedupReviewModal:** side-by-side field diffs, radio decision, mandatory note for "confirm distinct", destructive-style confirmation, focus trap.
- **States:** `customer/property/project` and `import_batch` categories come from the single phase-0 `state-chip.ts` map (Appendix B). No page-local state colours.
- **Copy:** terminology locked (Project ≠ Job; captions, never UUIDs); sentence case; verb-first buttons; errors say what happened and how to fix it.
- **A11y:** table semantics, sort announcements, checkbox labels, 44 px targets, focus visible, one `h1`, 200 % zoom, dark/high-contrast.

---

## 7. Work waves

| Wave | Agent | Exclusive paths | Gate |
|---|---|---|---|
| 0 (serial) | orchestrator | interfaces: each module's `domain/types.ts`, `data/repository.ts`, `data/api.ts` signatures; tab-registry shapes; wiring patch list | `pnpm check` on interfaces |
| 1 (parallel, 5) | data-agent per module (`customers`, `properties`, `projects`, `duplicates`, `imports`) | that module's `domain/` (except types), `data/` | module mock tests + validations |
| 2 (parallel, 6) | ui-agent per module (5) + shared-ui owner (`DataTable`, `SearchInput`, `DetailSection`, `KeyValueGrid`, `EntityLink`, `AuditTrailTab`, `ActivityTimeline`, `AssignmentPanel`, `DedupReviewModal`, `StageIndicator`, `GateBanner`, `Stepper`) | that module's `presentation/`, `src/routes/(dashboard)/<area>/**`; shared-ui owner owns `src/shared/presentation/ui/**` | component tests + browser smoke per page |
| 3 (serial) | orchestrator | wiring (permissions/routes/nav/collections/bootstrap/schema/migration/tab registries/tracker) | `pnpm check`, `pnpm lint`, `pnpm arch:check` |
| 4 (parallel) | gate-runner + boundary-reviewer | read-only | full gate + `file:line -> rule` report |
| 5 | orchestrator | Rule 3 matrix on 10 routes, flows (create/link/assign/archive/import), fixes, commits | post-fix screenshots at 5 viewports, dark, 200 % |

No two agents share a file; shared-UI changes are requested via wiring patch, not edited by module agents. Commit order: domain/data per module → shared UI → pages → routes → wiring → docs/tracker.

---

## 8. Done when

- [ ] All ten routes render real mock data; lists filter/search/sort/paginate and the URL reflects state (reload restores the view).
- [ ] Create customer with a duplicate → held `pending_review`, appears in `/dedup-queue`; `link_to_existing` and `confirm_distinct` (with note) both work and are audited; no auto-merge anywhere.
- [ ] New project wizard: customer → property → project → assign surveyor(s) → review → created; non-Surveyor cannot be assigned; removal confirmation explains existing surveys are kept; changes are audited.
- [ ] Project hub shows StageIndicator, summary cards, AssignmentPanel and the audit tab; illegal transitions are blocked with a `GateBanner` reason, not a dead button.
- [ ] Imports: staged batch preview shows per-row flags; commit is enabled only while `staged`, shows counts, creates new records only, sends clashes to dedup; committed/cancelled batches are read-only.
- [ ] `arch:check` 0 violations; no presentation import of `data/mock*` / `data/adapters/*` / `$network/mock-backend`; no business rules in `.svelte`; no Svelte 4 syntax.
- [ ] All ids are UUIDs; two consecutive `resetMockDb()` + reseed runs produce byte-identical seed data; mock DB version bumped with a migration.
- [ ] Unit + e2e suites in §5.4 pass; Playwright journeys cover the five flows above.
- [ ] Browser matrix on every route and every state: 320/390/768/1280/1920, light + dark, high contrast, 200 % zoom, keyboard-only, zero console errors, targets ≥44×44, AA contrast, no horizontal page scroll.
- [ ] Full pnpm gate green; all units committed and pushed to `main`; phase status flipped only after the gate.

---

## 9. Open questions (report, never guess)

1. **Dedup matching rules** — Part 5 §5/Part 10 §5 define the queue and decisions but not the exact match threshold or which fields participate. Default: normalised email + phone + postcode exact match; any fuzzy rule is a product decision.
2. **Customer create surface** — Part 11 §4.2 names `NewCustomerModal`; this plan uses a modal for customers/properties and a page for the project wizard. Confirm modal vs page where the form is long.
3. **Project reference format** — display-only reference (e.g. `OIG-2026-0001`) comes from tenant settings; the pattern is undefined. Default: mock generates from a settings placeholder and is not used as a key.
4. **Import file formats** — Part 11 §4.13 says "upload file"; Part 12 §1b says CSV. Default: CSV only (UTF-8, comma, header row); Excel/TSV out of scope.
5. **Import kinds for suppliers/materials** — registered in Phase 3; confirm the wizard stays one module (kind registry) rather than three wizards.
6. **Project summary endpoint shape** — `/projects/:id/summary` is only partially specified for Phase 1 (surveys/designs/quotes do not exist). Default: mock returns the project counts it can compute; later phases extend it.
7. **Customer channel list** — "preferred channel" values are not enumerated. Default: `email | phone | whatsapp | post`, reported as an assumption until the spec fixes it.
8. **Assignment panel scope** — Part 11 §4.2 says users with the Surveyor role; whether a Sales user with both roles appears is implied by the role union (FT-M1-03). Default: any user holding the Surveyor role.
