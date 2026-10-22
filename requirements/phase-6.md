# Phase 6 — Production, purchasing, saw export

> **Status:** not started · created 2026-10-22
> **Depends on:** phase-3, phase-4, phase-5 · **Unlocks:** 7
> **Spec map:** `spec.md` Part 12 §1 "Phase 3 — Production"; Part 8 in full (§2 breakdown, §3 parts, §4 validation, §5 labels, §6 Detel, §7 remakes) + the Macmazza/Optimak export specification; Part 11 §4.7–§4.8; Part 10 §14–§18; Part 5 `job`, `room`, `unit`, `part`, `part_edge`, `production_event`, `remake_request`, `export_run`, `job_cost_line`; Part 4 §5–§7 + §11; gates **G5, G6**; Part 13 FT-M8-01…04, FT-M9-01…04, C-02/C-05.
> **Read with:** `spec.md` Part 8 in full + the export specification, Part 10 §14–§18, Part 11 §4.7–§4.8, Part 4 §5–§7 + §11, Part 5 corresponding entities, Part 12 §4 (Q1–Q6, Q18), Part 13 §3 (M8, M9); `DESIGN.md` §3.7 + Appendix B, §4.3 (dimensions/money), §5.5 (compact), §9.2 (`QrPanel`, `ScanInput`, `ValidationList`, `KanbanBoard`), §10.2 (Board, Detail hub), §10.3 (immutability), §12–§13 (labels/hold-point copy), §15; `ui-ux.md` §7–§9, §13, §15; `standards/architecture.md` §3–§4, §10–§11, §16, §20–§22; `testing/ui-ux-tester.md`.
> **DESIGN.md blocker:** Draft V1.0 · awaiting approval (Rule 1.5).
> **Branch:** RULE 0 — `main` only, no PR.
> **Frontend only:** mock-first. Engineering, validation, labels, scanning and export packaging are simulated deterministically; the real machine mapping is a **hold point** and is never faked as confirmed.
> **Prerequisite:** phase-3/4/5 `Status: completed` (catalogue rules, issued design, approved order/job).

---

## 1. Scope

### Ships

1. **`jobs` module**
   - `/jobs`: board + table views (status columns from Part 4 §5), filters, stage counts.
   - `/jobs/[id]`: **job hub** — StageIndicator, contract value, survey chain chip (verified ✓), tabs registered over time: Rooms/Units, Parts, Costs, Payments, Exports, Audit (Installations/Aftercare arrive in Phase 7).
   - `/jobs/[id]/engineering`: unit list with `engineering_status`; `ConfigureUnitDrawer` (parameters vs bounds); Engineer selected / Engineer all; progress bar → transition to `procuring` allowed only when every unit is engineered.
   - `/jobs/[id]/parts`: parts table (status/type/unit filters), batch actions: validate, release (G5 summary of blocked vs released), label batch print, CSV.
2. **`parts` module**
   - `/parts/[id]`: identity panel (UUID + QR, the only place a UUID is displayed), dimension/material card, edge map (4-position editor), boring spec viewer (read-only), validation result list V01–V13 (pass/fail + reason), status timeline (`production_event`), transition buttons by role, remake request button, supersede lineage.
3. **`workshop` module**
   - `/workshop`: kanban board by active statuses, held-with-reason column, scan entry (paste/type UUID), reprint label, quick note.
4. **`remakes` module**
   - `/remakes`, `/remakes/[id]`: request / approve (Prod Mgr) / complete flows; replacement part link; original never altered or deleted; second open request on the same original rejected.
5. **`export-runs` module**
   - `/jobs/[id]/exports`, `/exports/[id]`: run list (mode, status, checksum), New export modal with the **G6 hold-point banner** when the mapping is unconfirmed, download, `error_detail` viewer.
   - `/exports/mapping`: hold-point status card, mapping version, checklist reference, confirm-mapping action (audited), neutral source field preview. **Preview exports are allowed while unconfirmed; production exports are blocked.**
6. **`purchasing` module**
   - `/purchasing`: jobs needing costs, open cost proxy list, variance highlights.
   - `/jobs/[id]/costs`: 13-element table, quoted vs actual bars, Add actual form (supplier, date), variance.
7. **Catalogue `Preview-engineering` tab** — registered into `/catalogue/cabinets/[id]` through orchestrator wiring: same unit config + rule version twice → byte-identical breakdown (proves determinism).
8. **Labels** — batch PDF preview/print with part-UUID QR (36-char lowercase), non-released parts excluded; label template version from settings.
9. **Shared UI** additions in §4.2.
10. **Audit + production events** for every scan, release, validation, export and cost write; no silent stage skips (an explicit "stage skipped: reason" event).

### Not in this phase

- Installations, snags, sign-off, aftercare, financials, reports (Phase 7); admin/governance/platform (Phase 8).
- Real machine integration, file templates, saw-PC capture, Optimak connectivity (hold point Q1–Q3, Q6); no confirmed mapping data is invented.
- Detel CNC controls (view-only boring spec only).
- Stock/inventory (Q17 out of scope); supplier ordering automation.

---

## 2. Requirements

| Requirement | Where it is enforced |
|---|---|
| S22/S23 — deterministic breakdown, `rule_version` recorded | `jobs/domain/engineering.ts` pure function; mock writes parts with resolved config + rule version; UI preview proves repeatability |
| S24 — part data incl. edges/boring | `parts` domain; 4-position edge editor; boring spec read-only |
| S25/**G5** — validation V01–V13 + survey-verified chain before release | mock validate/release; `ValidationList`; release blocked with per-row report |
| S26–S27/**G6** — Macmazza export hold point | `export-runs` mapping status; production mode blocked until confirmed; preview allowed; confirm audited |
| S28 — labels/QR | `QrPanel` + batch PDF; UUID only in part detail/QR; non-released excluded |
| S29 — workshop scanning and tracking | scan transitions validated against the part machine; every scan appends `production_event` + audit; job auto-advances on first cut-family scan |
| S30 — Detel boring info | read-only viewer; no controls |
| S31 — remakes | request/approve/complete machine; partial-unique open request; replacement lineage |
| S16 (actual costs) — procurement | `job_cost_line` vs quoted elements; variance; no accounting ledger |
| R1/R3 | UUIDs; parts immutable snapshots of config/material; no destructive edits; supersede lineage |
| Part 6 §3 | `job.view/update`, `part.view/update/release`, `export.view/create`, `remake.*`, `job_cost.view/create`; `PermissionGate` |
| Part 11 §1 / DESIGN §10.3 | state chip, gate banner, audit tab; frozen/immutable labels |
| A11y + design gates | DESIGN §12.6, §15.1–§15.4, ui-ux §19 |

---

## 3. Routes and pages

| Route | Page component | Permissions | Endpoints | Notes |
|---|---|---|---|---|
| `/jobs` | `jobs/presentation/pages/JobsPage.svelte` | `job.view` | `GET /jobs`, `GET /reports/pipeline` | board/table toggle, filters, counts |
| `/jobs/[id]` | `JobDetailPage.svelte` | `job.view` | `GET /jobs/:id`, children | hub + tabs registry + StageIndicator |
| `/jobs/[id]/engineering` | `JobEngineeringPage.svelte` | `job.view` | `GET /jobs/:id/units`, `POST /units/:id/engineer`, `POST /jobs/:id/engineer`, `POST /jobs/:id/transition` | configure drawer, progress, transition guard |
| `/jobs/[id]/parts` | `JobPartsPage.svelte` | `part.view` | `GET /jobs/:id/parts`, validate/release/labels/CSV | batch bar, G5 summary |
| `/parts/[id]` | `parts/presentation/pages/PartDetailPage.svelte` | `part.view` | `GET /parts/:id`, children, `POST /parts/:id/scan`, `POST /parts/:id/remakes` | identity/QR, edges, validation, timeline |
| `/workshop` | `workshop/presentation/pages/WorkshopPage.svelte` | `part.view` | `GET /jobs/*/parts?status=`, `POST /parts/:id/scan` | kanban, scan input, reprint, note |
| `/remakes` | `remakes/presentation/pages/RemakesListPage.svelte` | `remake.view` | `GET /remakes` | statuses + filters |
| `/remakes/[id]` | `RemakeDetailPage.svelte` | `remake.view` | `GET /remakes/:id`, transitions | request/approve/complete + replacement link |
| `/jobs/[id]/exports` | `export-runs/presentation/pages/JobExportsPage.svelte` | `export.view` | `GET /jobs/:id/exports`, `POST /jobs/:id/exports` | G6 banner, run list |
| `/exports/[id]` | `ExportRunDetailPage.svelte` | `export.view` | `GET /exports/:id`, `GET /exports/:id/download` | checksum, error detail, expiring download |
| `/exports/mapping` | `ExportMappingPage.svelte` | `export.view` | `GET/PUT /exports/mapping`, `GET /exports/released-parts` | hold-point card, confirm action |
| `/purchasing` | `purchasing/presentation/pages/PurchasingPage.svelte` | `job_cost.view` | `GET /jobs/*/costs/variance` | jobs needing costs + variance |
| `/jobs/[id]/costs` | `JobCostsPage.svelte` | `job_cost.view` | `GET /jobs/:id/costs`, `POST /jobs/:id/costs` | 13 elements, quoted vs actual, add actual |

**Route collision (reported):** Part 11 §4.7 uses `/exports/:id` for Macmazza run detail and `/exports/mapping`; Part 11 §4.13 uses `/exports` for the governed data export centre (Phase 7). This plan keeps the spec routes as written for Phase 6 and escalates the collision before Phase 7 ships `/exports`. See §9.

---

## 4. Modules and shared components

### 4.1 Modules

| Module | Domain | Data | Presentation |
|---|---|---|---|
| `jobs` | `Job`, `Room`, `Unit`, `UnitConfig`, `EngineeringStatus`, `JobListParams`, `engineeringSchema`, `configureUnitSchema`, pure `engineering.ts` (deterministic breakdown), `jobMachine.ts` | repository, provider, `jobsApi`, mock, seed, adapters, mappers, tests | board/table, hub, engineering page, configure drawer, `StageIndicator` usage, job tab registry |
| `parts` | `Part`, `PartEdge` (4 positions), `BoringSpec`, `ValidationResult` (V01–V13), `PartStatus`, `EdgeMapSchema`, `partTransitionSchema` | repository, provider, `partsApi`, mock, seed, adapters, mappers, tests | detail, identity/QR, dimension card, edge editor, validation list, timeline, transition bar |
| `workshop` | scan input schema, board columns | scan + reprint endpoints via `partsApi` (no duplicate repository) | kanban board, scan field, quick note |
| `remakes` | `RemakeRequest`, `RemakeReason`, `remakeSchema`, machine | repository, provider, `remakesApi`, mock, seed, adapters, mappers, tests | list, detail, request/approve/complete |
| `export-runs` | `ExportRun`, `ExportMode`, `MappingStatus`, `mappingSchema`, checksum helpers | repository, provider, `exportsApi`, mock, seed, adapters, mappers, tests | job exports, run detail, mapping page, `HoldPointBanner` |
| `purchasing` | `JobCostLine`, `Variance`, `actualCostSchema` | repository, provider, `purchasingApi`, mock, seed, adapters, mappers, tests | purchasing page, job costs page, variance bars |

### 4.2 Shared UI added

| Component | Contract | Notes |
|---|---|---|
| `QrPanel` | DESIGN §9.2 | monochrome QR + UUID text, print action, quiet zone; parts only |
| `ScanInput` | DESIGN §9.2 | 36-char lowercase UUID, paste/type, inline error |
| `ValidationList` | DESIGN §9.2 | code + human label + pass/fail/warning + reason, filter, announced counts |
| `KanbanBoard` | DESIGN §9.2/§10.2 | columns by state, cards with metadata, drag optional with menu alternative, compact density |
| `HoldPointBanner` | DESIGN §9.2 `GateBanner` variant | persistent, explains the mapping hold point, links to `/exports/mapping` |
| Reuse | `DataTable`, `MoneyField`, `DimensionField`, `EvidenceUploader` (remake evidence if required), `ConfirmDialog`, `StateChip`, `StageIndicator` | no duplicates |

### 4.3 Orchestrator wiring

Routes/permissions; nav Production (Jobs, Remakes, Exports, Export mapping) + Purchasing; catalogue preview tab registration; job hub tab registrations; `COLLECTIONS`; `mock-bootstrap`; schema bump + migration extending the minimal job row; tracker.

---

## 5. Data

### 5.1 Collections

`job` (extended), `room`, `unit`, `part`, `part_edge`, `production_event`, `remake_request`, `export_run`, `export_mapping`, `job_cost_line`.

- Job: status machine, contract value pence, currency, survey/design/customer/property FKs, timestamps.
- Room/Unit: room dims, unit config snapshot, `engineering_status`.
- Part: unitId, jobId, type, dimensions (mm), material snapshot (decor/edging/colour), status, `remakeStatus`, `remakeOfPartId`, `ruleVersion`, validation results, timestamps.
- PartEdge: partId, position (front/back/left/right or the spec's 4-position model), edgingId, thickness.
- ProductionEvent: partId, fromStatus, toStatus, actor, at, note, skippedReason (append-only).
- RemakeRequest: originalPartId, reason, note, status, replacementPartId, requestedBy/approvedBy, timestamps.
- ExportRun: jobId, mode (`preview|production`), status, checksum, counts, fileRef (expiring URL), errorDetail, createdBy, timestamps.
- ExportMapping: status (`unconfirmed|confirmed`), mappingVersion, confirmedBy/At, fields preview.
- JobCostLine: jobId, quoteVersionId, elementKey, quotedPence, actualPence, supplierId, incurredOn, note.

### 5.2 Seed

- 8 jobs across the machine (created, engineering, procuring, released, in production, ready for install, on hold, closed) with 2–5 rooms and 8–20 units.
- One job with all units engineered; one with 3 pending; one whose survey is not verified (G5 blocked fixture).
- Parts across all statuses incl. `held` with two validation failures, one `scrapped`, one with a remake lineage, one superseded.
- Validation fixtures for every V01–V13 code (at least one pass and one fail each).
- Export runs: preview success, production blocked (unconfirmed mapping), production success (confirmed), failed with error detail.
- Costs: one job with 13 quoted elements and partial actuals; variance positive and negative.
- Labels: one released batch + one blocked part to prove exclusion.
- Deterministic ids/dates; no random values; engineering output stable across resets.

### 5.3 Mock behaviour

- Engineering: same config + rule version → identical parts (stable ordering/ids via `deterministicUuid('part:<job>:<unit>:<n>')`, not random); config change pre-engineering resets `engineering_status=pending`; engineering never mutates released parts.
- Validation: any V01–V13 failure → `held` with persisted errors; fixing data → pending → revalidate.
- G5 release: job survey must be `verified` and parts must pass validation; batch release returns a per-row released/blocked report.
- Scans: only legal transitions per Part 4 §6; illegal jump → `conflict`; every scan appends `production_event` + audit; first cut-family scan advances the job to `in_production`.
- G6: `POST /jobs/:id/exports` with `mode=production` requires `mapping_status='confirmed'` → otherwise `gate_blocked` (mirrors the DB CHECK); preview always allowed; confirm mapping is audited with a version bump; downloads use expiring URLs.
- Remakes: second open request on the same original → `conflict`; approval creates a replacement with `remakeOfPartId`, same dims/material, `pending_validation`; original untouched; replacement must pass G5.
- Costs: quoted is read-only (from the approved quote); actual write audited; variance derived, never stored.
- Labels: batch excludes non-released parts; QR encodes the 36-char lowercase UUID.

### 5.4 Tests

- Domain: breakdown determinism (run twice, deep-equal), validation rules per code, edge map, scan transition table, remake machine, checksum helpers.
- Mock: engineering/re-engineering, validation→held→revalidate, G5 batch report, G6 block/allow, scan events + job auto-advance, remake uniqueness/lineage, cost variance.
- Component: validation list, edge editor, QR panel, scan input, hold-point banner.
- E2E: engineer → validate → release (blocked then allowed) → label batch → scan through statuses → remake request/approve → export preview → mapping confirm → production export.

---

## 6. Design contract

- **Job hub:** StageIndicator full, contract value money format, survey chain chip, tabs 2–5 + overflow if needed, audit tab; primary action is the next legal transition.
- **Boards:** compact density (44 px rows/cards), columns by Part 4 §5 statuses with counts; card shows caption + key metadata; drag is an enhancement with a menu alternative; held column explains the reason.
- **Parts:** UUID visible only here (mono) and in QR payloads; dimension card integer mm; edge map 4 positions with clear labels (not geometry-only); boring flagged "BORING: YES" text style; validation list shows code + human label + reason; status timeline with `<time>`; frozen/superseded parts labelled.
- **Export hold point:** the banner is persistent and explains what is unconfirmed and why production is blocked; preview is clearly labelled as preview; no fake confirmed state; download uses an expiring link and states it.
- **Mapping page:** neutral source field preview, mapping version, confirm action behind confirmation, audited; no machine-specific values are invented.
- **Labels:** print preview matches the label template; QR monochrome with quiet zone; UUID text present; excluded parts listed with the reason.
- **Costs:** money rules as Phase 5; variance bars use the fixed chart palette, always with numeric labels; derived values labelled.
- **A11y:** board keyboard navigation, scan input error announced, QR has text alternative, 200 % zoom, dark/high contrast.

---

## 7. Work waves

| Wave | Agent | Exclusive paths | Gate |
|---|---|---|---|
| 0 (serial) | orchestrator | interfaces for six modules, engineering/validation contracts, export mapping contract, job-bridge extension, wiring list | `pnpm check` |
| 1 (parallel, 4) | data-agent per group: `jobs`+`purchasing`, `parts`, `workshop`+`remakes`, `export-runs` | those modules' `{domain,data}/**` | mock + domain tests |
| 2 (parallel, 6) | ui-agent per module (`jobs`, `parts`, `workshop`, `remakes`, `export-runs`, `purchasing`) | that module's `presentation/**` + its routes | page smoke + component tests |
| 2 (parallel, 1) | shared-ui-agent | `QrPanel`, `ScanInput`, `ValidationList`, `KanbanBoard`, hold-point banner in `src/shared/presentation/ui/**` | component tests |
| 3 (serial) | orchestrator | wiring (routes/nav/tab registries/preview tab/collections/bootstrap/schema+migration/tracker) | check/lint/arch:check |
| 4 (parallel) | gate-runner + boundary-reviewer | read-only | full gate + boundary report |
| 5 | orchestrator | Rule 3 matrix on 13 routes + board/scan/label flows, fixes, commits | post-fix screenshots |

Concurrency cap: 8 agents per wave; the data wave splits into 4, the UI wave into 7 (6 + shared), within the cap.

---

## 8. Done when

- [ ] Engineering: same config + rule version produces identical parts on repeat runs; config change resets pending; progress reaches 100 %; the `engineering → procuring` transition is blocked until every unit is engineered.
- [ ] Validation: every V01–V13 result renders with code, label, result and reason; failures hold the part; fixing data allows revalidation.
- [ ] G5: release is blocked while the job survey is not verified or validation fails, with a per-row report; it succeeds when clean; batch release returns released/blocked counts.
- [ ] Labels: batch PDF preview shows the QR and UUID for released parts only; non-released parts are excluded with a reason.
- [ ] Workshop: scanning drives legal transitions only; illegal jumps are rejected; every scan appends an event and audit row; the job advances to `in_production` on the first cut-family scan; held reasons visible; reprint works.
- [ ] Remakes: request (reason, note when "other"), approve (Prod Mgr), complete; second open request rejected; replacement linked with same dims/material and must pass G5; original untouched.
- [ ] G6: production export is blocked while the mapping is unconfirmed, with a hold-point banner; preview works; confirming the mapping is audited and unlocks production; download is an expiring URL; checksum/counts shown.
- [ ] Costs: 13 elements with quoted vs actual and derived variance; actual writes audited; supplier/date captured; no accounting ledger behaviour.
- [ ] Catalogue preview-engineering tab proves byte-identical breakdown for the same input.
- [ ] `arch:check` 0; no mock/adapter imports in presentation; no business rules in `.svelte`; no Svelte 4 syntax; UUIDs + deterministic seeds; no silent stage skips.
- [ ] Unit + e2e suites pass; browser matrix on all 13 routes (including board at 320/390/768/1280/1920), dark, high contrast, 200 %, keyboard, zero console errors.
- [ ] Full pnpm gate green; committed and pushed to `main`; phase status flipped only after the gate.

---

## 9. Open questions (report, never guess)

1. **Q1–Q3, Q6 — Macmazza/Optimak hold point** — sample files, Optimak version, MacmazzaLink presence, encoding/units/decimals are unresolved. This phase ships preview/mapping/blocking behaviour only; **no mapping values are invented**.
2. **Q4 label printer** — model/connection and who prints. Label output is a browser-printable PDF preview; no direct printer integration.
3. **Q5 result flow from Optimak** — assumed scan-only; confirm.
4. **Q18 Detel M-3R boring conventions** — no datasheet; the boring spec viewer renders the stored spec, no pattern generator.
5. **`/exports` route collision** — Macmazza run detail (`/exports/:id`, `/exports/mapping`) vs governed data export centre (`/exports`, Phase 7). Proposed resolution: keep `/exports` for the data centre and move run detail to `/jobs/[id]/exports/[exportId]`; needs a spec decision.
6. **V01–V13 catalogue** — codes/labels must be copied verbatim from Part 8 §4; any code not defined there is reported.
7. **Edge map position model** — "4-position editor" is stated but the position names/order are not. Default: front, back, left, right with the spec's thickness rules; confirm.
8. **Remake reason list** — reasons are referenced but not enumerated. Default: `damaged_in_transit | manufacturing_defect | measurement_error | other` (note required for `other`); confirm.
9. **CSV export columns** — parts CSV headers are unspecified. Default: caption, type, dims, material, edge summary, status, validation result; flagged.
10. **Job hub payments tab** — Phase 5 owns payments; Phase 6 registers the tab. Confirm the tab can read across modules via `paymentsApi` (allowed) rather than duplicating data.
11. **Stage skip policy** — Part 8 requires an explicit event; whether skips are ever permitted by role is not defined. Default: skips require a permission and a reason, always evented.
