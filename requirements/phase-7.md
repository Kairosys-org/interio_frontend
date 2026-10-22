# Phase 7 — Site, aftercare, reports

> **Status:** not started · created 2026-10-22
> **Depends on:** phase-5, phase-6 · **Unlocks:** 8
> **Spec map:** `spec.md` Part 12 §1 "Phase 4 — Site & aftercare"; Part 11 §4.9–§4.11 and §4.13 (export centre); Part 10 §19–§22 and §26; Part 5 `installation`, `installation_user`, `snag_item`, `aftercare_request`, `aftercare_visit`; Part 4 §8 (installation), §9 (aftercare); **G7**; Part 13 FT-M11-01…03, FT-M12-02, FT-M13-01…02, FT-M14-04, E2E-05.
> **Read with:** `spec.md` Part 10 §19–§22 + §26, Part 11 §4.9–§4.11 + §4.13, Part 4 §8–§9, Part 5 site/aftercare entities, Part 7 §8 (reporting outputs), Part 12 §4 (Q8, Q17), Part 13 §3 (M11, M12, M13) + §5 (E2E-05) + §7; `DESIGN.md` §3.9 (charts), §3.7 + Appendix B, §4.3, §9.2 (`EvidenceUploader`, `KanbanBoard`, `DataTable`), §10.2 (Board, Report), §10.3 (derived values), §12, §13.4, §15; `ui-ux.md` §9, §13, §15; `standards/architecture.md` §3–§4, §10–§11, §16, §20–§22; `testing/ui-ux-tester.md`.
> **DESIGN.md blocker:** Draft V1.0 · awaiting approval (Rule 1.5).
> **Branch:** RULE 0 — `main` only, no PR.
> **Frontend only:** mock-first. Sign-off evidence, warranty lineage, reports and CSV downloads are simulated; download URLs are short-lived mock URLs.
> **Prerequisite:** phase-5/6 `Status: completed`; **the `/exports` route collision with Phase 6 must be resolved before wiring** (see §9).

---

## 1. Scope

### Ships

1. **`installations` module**
   - `/installations`: list by status/date, book action.
   - `/installations/[id]`: timeline (ready → booked → delivered → install → snag → sign-off), team editor, site notes, **SignOffPanel** (customer name + evidence upload — **G7**), snags list linked to the job.
   - Installer scope: lists limited to assigned installations.
2. **`snags` module**
   - `/snags`: cross-job board (severity/status), part-link chips, open-remake action.
   - Snag transitions `open → in_progress → resolved | waived`; open snags block installation `complete`; resolve/waive individually and audited; snag → remake opens the M9 lineage (Phase 6 contract).
3. **`aftercare` module**
   - `/aftercare`: filters (type, status, job), New request modal (job + optional original part).
   - `/aftercare/[id]`: description, original/replacement part lineage (captions, UUID only where part detail allows), visit log (add visit), status machine buttons with required notes, resolution note.
4. **`reports` module**
   - `/reports`: report index cards.
   - `/reports/[name]`: parameterised table (and chart where the report is visual) + CSV export button; every report respects the caller's permission scope; CSV export is audited **with the filters used**.
   - `/jobs/[id]/financials`: contract value, deposit paid, balance, outstanding — **derived**, explicitly labelled, with the formula source; payment table.
   - Chart primitives use the fixed DESIGN §3.9 palette; no chart library unless D5 is decided otherwise.
5. **`exports-centre` module**
   - `/exports`: dataset picker limited to datasets the caller holds `X` (export) on, filter form, export history (recent requests, status, expiring download).
   - Permission-filtered CSV only; rows the caller cannot view can never be exported; download URLs ≤15 min, single-user (FT-M14-04).
6. **Dashboard data hooks:** `/reports/pipeline` and scoped lists become available for the Phase 8 role widgets; no dashboard is built here.
7. **Shared UI** additions in §4.2.
8. **Audit** for every installation/snag/aftercare transition, sign-off evidence, report export and data export.

### Not in this phase

- Admin, roles, settings, deletion, audit log page, account pages, onboarding, platform console, dashboard widget grid, `/activity` (Phase 8).
- Notifications/email/SMS, scheduling optimisation, route maps/doorstep routing (R7 not specified), accounting integrations, warranty billing, stock.
- Automatic retention deletion (Phase 8 / OPS).

---

## 2. Requirements

| Requirement | Where it is enforced |
|---|---|
| S32/**G7** — installation machine + sign-off evidence | `installations` mock transitions; `SignOffPanel` requires customer name + complete evidence asset; sign-off without evidence → `gate_blocked` |
| S32 — snags block completion; remake link | `snags` mock; installation `complete` blocked while any snag open; `open remake` creates the Phase 6 request |
| S32 — aftercare machine + part lineage | `aftercare` mock transitions with required notes; original/replacement part references |
| S33 — financials are derived | `reports/domain/financials.ts` pure sums (contract from job copy, deposit/balance/outstanding from payments); UI labels "Derived"; no stored running totals |
| S38/FT-M13-02 — permission-filtered CSV, audited filters | `reports` and `exports-centre` mock enforce dataset permission and write an `export` audit row with the filter object |
| FT-M14-04 — download URLs ≤15 min, single-user | mock expiring URL + owner check |
| R1/R3 | UUIDs; transitions audited; no destructive edits; snag/aftercare history preserved |
| Part 6 §3 | `installation.view/update`, `snag.view/update`, `aftercare.view/create/update`, `report.*`, `export.*`; `PermissionGate` |
| Part 11 §4.11 / DESIGN §10.3 | derived values labelled; report pattern; index cards |
| A11y + design gates | DESIGN §12.6, §15.1–§15.4, ui-ux §19 |

---

## 3. Routes and pages

| Route | Page component | Permissions | Endpoints | Notes |
|---|---|---|---|---|
| `/installations` | `installations/presentation/pages/InstallationsListPage.svelte` | `installation.view` | `GET /installations` | status/date filters, book |
| `/installations/[id]` | `InstallationDetailPage.svelte` | `installation.view` | `GET /installations/:id`, transitions, `/signoff`, snags | timeline, team editor, notes, G7 panel |
| `/snags` | `snags/presentation/pages/SnagsPage.svelte` | `snag.view` | `GET /snags`, `POST /snags/:id/transition` | board + table, part chips, remake action |
| `/aftercare` | `aftercare/presentation/pages/AftercareListPage.svelte` | `aftercare.view` | `GET /aftercare`, `GET /jobs/:id/aftercare` | type/status/job filters, new request |
| `/aftercare/[id]` | `AftercareDetailPage.svelte` | `aftercare.view` | `GET/PATCH /aftercare/:id`, visits, transition | lineage, visit log, status buttons |
| `/jobs/[id]/financials` | `reports/presentation/pages/JobFinancialsPage.svelte` | `payment.view` | `GET /jobs/:id/financials`, `GET /jobs/:id/payments` | derived labelling + formula source |
| `/reports` | `ReportsIndexPage.svelte` | per report | — | cards with the report's permission |
| `/reports/[name]` | `ReportPage.svelte` | per report | `GET /reports/:name?…`, `?format=csv` | parameter form + table/chart + export |
| `/exports` | `exports-centre/presentation/pages/ExportCentrePage.svelte` | `export.*` per dataset | `POST /exports`, `GET /exports/:id` | dataset picker + history |

`[name]` validate against the report registry (unknown → not-found, never a blank page).

---

## 4. Modules and shared components

### 4.1 Modules

| Module | Domain | Data | Presentation |
|---|---|---|---|
| `installations` | `Installation`, `InstallationUser`, `InstallationStatus`, `signOffSchema`, transition table | repository, provider, `installationsApi`, mock, seed, adapters, mappers, tests | list, detail, timeline, team editor, `SignOffPanel` |
| `snags` | `SnagItem`, `SnagSeverity`, `SnagStatus`, `snagSchema` | repository, provider, `snagsApi`, mock, seed, adapters, mappers, tests | board/table, snag detail drawer, remake action |
| `aftercare` | `AftercareRequest`, `AftercareVisit`, `AftercareStatus`, `aftercareSchema`, `visitSchema` | repository, provider, `aftercareApi`, mock, seed, adapters, mappers, tests | list, detail, lineage, visit log |
| `reports` | report registry, parameter schemas, `financials.ts`, aggregation selectors | repository, provider, `reportsApi`, mock, seed, adapters, mappers, tests | index, report page, job financials, chart wrapper, CSV action |
| `exports-centre` | `ExportDataset`, `ExportRequest`, permission map, `exportSchema` | repository, provider, `exportsCentreApi`, mock, seed, adapters, mappers, tests | dataset picker, filter form, history |

### 4.2 Shared UI added

| Component | Contract | Notes |
|---|---|---|
| `ChartFrame` + series primitives | DESIGN §3.9 + §9.2 | fixed 7-colour order, 2 px lines, no 3D/gradients, direct labels ≤4 series, pattern/dash second channel |
| `ReportFilters` | DESIGN §10.2 (Report) | parameter form, URL-synced, CSV action |
| `DerivedValue` label | DESIGN §10.3 | "Derived" + formula source caption |
| Reuse | `EvidenceUploader` (G7), `KanbanBoard` (snags), `DataTable`, `MoneyField`, `StateChip`, `GateBanner` | no duplicates |

### 4.3 Orchestrator wiring

Routes/permissions (including the resolved `/exports` decision); nav Site, Aftercare, Finance (Payments, Job financials, Reports), Data (Export centre); report registry; job hub tabs (Installations, Aftercare, Financials); `COLLECTIONS`; `mock-bootstrap`; schema bump + migration; tracker.

---

## 5. Data

### 5.1 Collections

`installation`, `installation_user`, `snag_item`, `aftercare_request`, `aftercare_visit`, plus the export history collection (`export_request`) and audit events.

- Installation: jobId, status, scheduledAt, team[], siteNotes, signOffCustomerName, signOffEvidenceAssetId, signOffAt, timestamps.
- SnagItem: installationId/jobId nullable per spec, partId nullable, severity, status, description, resolutionNote, waivedReason, timestamps.
- AftercareRequest: jobId, type, status, originalPartId nullable, replacementPartId nullable, description, resolutionNote, timestamps.
- AftercareVisit: requestId, visitedAt, engineer, notes, outcome.
- ExportRequest: datasetKey, filters, status, requestedBy, expiresAt, fileRef, audit filters snapshot.

### 5.2 Seed

- 6 installations across the machine (ready, booked, delivered, installing, snagging, signed off), one with open snags (blocks complete), one with sign-off evidence missing (G7 blocked).
- 8 snags across jobs/parts (severity/status mix, one waived with reason, one linked to a remake).
- 6 aftercare requests (all statuses; one with original + replacement part lineage; one with visits).
- Payment fixtures reused from Phase 5; one job with deposit paid and balance outstanding, one fully paid, one overpaid/negative adjustment.
- Reports seeded with enough rows to exercise filters and CSV (pipeline, quote margins, job profit, production board, aftercare summary).
- Export datasets: a permitted and a forbidden dataset for the same user; one expired download.
- Deterministic ids/dates; money integers.

### 5.3 Mock behaviour

- Installation transitions per Part 4 §8; `complete` blocked by open snags or missing sign-off; sign-off requires evidence `complete` (G7); every transition audited; installer scope filters lists.
- Snag: duplicate open remake for the same part → `conflict`; waive requires a reason; resolve requires a note.
- Aftercare: guarded steps require notes; part lineage immutable after resolution; visits append.
- Financials: sums derived on read; no stored totals; `closed` job requires outstanding = 0 or an audited Owner override (surfaced as a blocked state).
- Reports: identical filters produce identical aggregates (spot-check vs mock collections); CSV contains exactly the visible rows and writes an `export` audit with the filters.
- Export centre: dataset permission enforced server-side (mock), short-lived single-user URL, expired download → `gone`.
- Unknown report name → 404 state.

### 5.4 Tests

- Domain: machine tables, financial sums (zero, negative, overpaid), report parameter schemas, CSV serialisation (quoting, UTF-8, CRLF/LF decision), permission map.
- Mock: G7 block/allow, snag block on completion, remake link, aftercare guards, derived financials, export permission + expiry + audit filters.
- Component: sign-off panel states, derived label, chart accessibility (text alternative/table), report filters.
- E2E: installation → snag → block completion → resolve → sign-off with evidence → complete; aftercare request → visit → resolve; report filter → CSV; export centre permitted/forbidden dataset; financials match payment rows.

---

## 6. Design contract

- **Installation detail:** timeline with `<time>`, state chip, G7 panel, snag list; one primary action (next legal transition); team editor with role badges; site notes preserved on reload.
- **Snag board:** kanban by status/severity, compact density, cards link to part and job, open-remake action with confirmation; no colour-only severity (icon + label).
- **Aftercare:** lineage shown as captions with part links (UUID only on part detail), visit log, required-note fields inline, resolution note persists.
- **Financials:** contract/deposit/balance/outstanding each labelled "Derived" with the formula source in captions; money rules from Phase 5; no accounting terminology (ledger, invoice).
- **Reports:** parameter form + chart/table; charts follow the fixed palette and always have a table/text alternative; CSV button states what will be exported; derived numbers labelled.
- **Export centre:** dataset cards show the required permission and why a dataset is unavailable; history shows status and an expiring download with the expiry time.
- **A11y:** charts have accessible names + data table, boards keyboard navigable, file upload labelled, 200 % zoom, dark/high contrast, focus visible.

---

## 7. Work waves

| Wave | Agent | Exclusive paths | Gate |
|---|---|---|---|
| 0 (serial) | orchestrator | interfaces for five modules, report registry contract, export dataset/permission contract, `/exports` resolution, wiring list | `pnpm check` |
| 1 (parallel, 3) | data-agent group 1 | `modules/installations/{domain,data}/**`, `modules/snags/{domain,data}/**` | mock + domain tests |
| 1 (parallel, 3) | data-agent group 2 | `modules/aftercare/**`, `modules/reports/**`, `modules/exports-centre/**` data/domain | mock + domain tests |
| 2 (parallel, 5) | ui-agent per module | each module's `presentation/**` + routes | page smoke + component tests |
| 2 (parallel, 1) | shared-ui-agent | `ChartFrame`, `ReportFilters`, `DerivedValue` in `src/shared/presentation/ui/**` | component tests |
| 3 (serial) | orchestrator | wiring (routes/nav/report registry/tab registrations/collections/bootstrap/schema+migration/tracker) | check/lint/arch:check |
| 4 (parallel) | gate-runner + boundary-reviewer | read-only | full gate + boundary report |
| 5 | orchestrator | Rule 3 matrix on 9 routes + board/report/CSV flows, fixes, commits | post-fix screenshots |

---

## 8. Done when

- [ ] Installation timeline follows Part 4 §8; `complete` is blocked by open snags or missing sign-off; sign-off without evidence is blocked (G7) and succeeds with customer name + complete evidence; installers see only assigned installations.
- [ ] Snags: create, resolve (note), waive (reason), part link, open-remake → Phase 6 lineage; open snags visibly block completion.
- [ ] Aftercare: request → assigned → in progress → resolved → closed with required notes; visits append; original/replacement part lineage shown.
- [ ] Financials: contract/deposit/balance/outstanding derived from job copy + payment rows, labelled "Derived", with the formula source; no stored running totals; the closed-job rule is surfaced.
- [ ] Reports: index cards respect permissions; each report filters correctly, matches mock aggregates, and exports a CSV containing exactly the visible rows with an audited filter snapshot.
- [ ] Export centre: only permitted datasets are selectable; forbidden datasets explain why; downloads expire within 15 minutes and are single-user; history shows status.
- [ ] `/exports` collision resolved and consistent with Phase 6 (no duplicate or shadowed route).
- [ ] `arch:check` 0; no mock/adapter imports in presentation; no business rules in `.svelte`; no Svelte 4 syntax; UUIDs + deterministic seeds.
- [ ] Unit + e2e suites pass; browser matrix on all nine routes (including board at 320/390), dark, high contrast, 200 %, keyboard, charts have text alternatives, zero console errors.
- [ ] Full pnpm gate green; committed and pushed to `main`; phase status flipped only after the gate.

---

## 9. Open questions (report, never guess)

1. **`/exports` route collision** — the governed data export centre (§4.13) and Macmazza export runs (§4.7) share the URL space. This phase cannot wire `/exports` until Phase 6's run detail is re-homed. Proposed: data centre keeps `/exports`, run detail moves to `/jobs/[id]/exports/[exportId]`. Owner decision required.
2. **Q8 warranty length + retention** — "warranty period + 6 years" is an interim. Aftercare has no duration rules until answered.
3. **Report definitions** — Part 10 §22 names the Phase 1 outputs; exact columns, filters and formulas beyond financials are not fully enumerated. Default: implement exactly the enumerated outputs and report any missing definition.
4. **D5 chart library** — lightweight SVG/CSS is the default; a library needs an explicit decision. No new dependency in this phase.
5. **CSV conventions** — encoding (UTF-8 with BOM?), delimiter, line endings and date format are unspecified. Default: UTF-8, comma, `\n`, en-GB dates; confirm for Excel compatibility.
6. **Export dataset keys and permissions** — the dataset list is implied by Part 6 §3 but not enumerated per dataset. Default: one dataset per list endpoint, permission = the list's view code plus the corresponding `X` grant.
7. **Download expiry value** — ≤15 min is the ceiling (FT-M14-04). Default: 10 minutes; confirm.
8. **Snag severity values** — used in the board but not enumerated. Default: `low | medium | high | critical`; confirm.
9. **Aftercare types** — `warranty | service | damage | other` is implied; confirm.
10. **Installer team model** — `installation_user` roles (lead/crew) are not defined. Default: members with a `lead` flag; confirm.
11. **Notifications** — no email/SMS channel is specified; none is built. Confirm notifications are out of scope for this frontend.
