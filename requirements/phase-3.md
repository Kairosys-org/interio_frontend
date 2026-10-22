# Phase 3 — Catalogue and materials

> **Status:** not started · created 2026-10-22
> **Depends on:** phase-0 (phase-1 only for the imports shell) · **Unlocks:** 4 (placement + finishes), 6 (engineering rules)
> **Spec map:** `spec.md` Part 12 §1 "Phase 2 — Commercial" (catalogue S14–S15 slice); Part 8 §1 (master cabinet catalogue) and §8 (materials & decor usage); Part 11 §4.5–§4.6; Part 10 §10–§11; Part 5 catalogue/materials entities; Part 4 §1 (no workflow, active/discontinued flags); Part 13 FT-M5-01, FT-M5-03, FT-M5-04, C-02.
> **Read with:** `spec.md` Part 8 §1 + §8, Part 10 §10–§11, Part 11 §4.5–§4.6 + §4.13 (supplier/material import kinds), Part 5 catalogue/materials entities, Part 13 §3 (M5); `DESIGN.md` §3.7 + Appendix B, §5.5 (compact density), §9.2, §9.3 (`Tabs`, `Combobox`, `DataTable`), §10.2, §12, §13.2 (terminology), §15; `ui-ux.md` §9, §13, §15; `standards/architecture.md` §3–§4, §10–§11, §16, §22; `testing/ui-ux-tester.md`.
> **DESIGN.md blocker:** Draft V1.0 · awaiting approval (Rule 1.5).
> **Branch:** RULE 0 — `main` only, no PR.
> **Frontend only:** mock-first. Catalogue and materials are **master data**; no pricing/engineering engine is implemented here (prices are fields, engineering is Phase 6).
> **Prerequisite:** phase-0 `Status: completed`; the imports shell from phase 1 is required for supplier/material import kinds.

---

## 1. Scope

### Ships

1. **`catalogue` module**
   - `/catalogue/cabinets`: family filter chips, sortable table, New cabinet modal.
   - `/catalogue/cabinets/[id]`: tabs — **Parameters** (min/max/default editor per parameter, typed), **Component rules** (expression JSON editor + `rule_version`, condition, active toggle, validation on save), **Usage** (read-only reference list of units/parts would be Phase 6; this tab is added by Phase 6 wiring, not built now).
   - `/catalogue/rules`: cross-cabinet rule list with `rule_version` filter and active toggle.
   - Parameter bounds validate on save; out-of-bounds configuration never reaches the catalogue (mock mirrors the server rule).
   - Catalogue edits are audited and **never** retro-engineer existing units/parts (Phase 6 proves the snapshot rule; this phase must not create a snapshot path).
2. **`materials` module**
   - `/materials/decor`: filters (manufacturer, colour, material, tier, status, `customer_visible`), table, create/edit.
   - `/materials/decor/[id]`: record form + tabs **Edgings** (match-type links), **Suppliers** (supplier code, primary flag), **Attributes** (key/value), **Sample asset** (reuses `EvidenceUploader`/asset contract).
   - `/materials/edging`: table + editor modal.
   - `/materials/suppliers` + `/materials/suppliers/[id]`: supplier CRUD, lead time, linked decors.
   - `/materials/manufacturers`: manufacturer → collection tree with inline create/edit (no separate collection module).
   - One `is_primary` supplier per decor (partial-unique rule); attributes extend without a schema change.
3. **Import kinds for suppliers and materials** — registered into the Phase 1 wizard/kind registry through the orchestrator wiring patch (no second wizard). Reuses the same staging/commit/outcome contract.
4. **Shared UI** additions in §4.2.
5. **Audit** for every catalogue/material change, including rule-version changes.

### Not in this phase

- **Preview-engineering playground** (`/catalog/cabinets/:id/preview-engineering`) — needs the deterministic breakdown engine (Phase 6). Deferred there; the tab is registered by Phase 6 wiring. No fake "deterministic" preview is built here.
- Design placement UI, costing (Phase 4/5), engineering breakdown, parts, pricing, supplier ordering.
- Stock/inventory (Q17 out of scope).
- Editing manufacturer/collection hierarchy beyond one parent level unless Part 5 says otherwise (see §9).

---

## 2. Requirements

| Requirement | Where it is enforced |
|---|---|
| S14 — parametric cabinet library with data-driven parameters and component rules | `catalogue` domain types + parameter bounds + rule expression validation; UI editors |
| S15 — materials chain Manufacturer → Collection → Decor → edging → suppliers; attributes | `materials` modules and links; primary-supplier uniqueness |
| FT-M5-01 — parameter bounds enforced | zod + mock save rule; out-of-bounds → `validation_failed` with the offending parameter |
| FT-M5-03 — second `is_primary` supplier rejected; attributes key/value | mock partial-unique + attribute rows |
| FT-M5-04 — released part snapshot unaffected by later decor changes | Phase 6 owns the part snapshot; this phase must not write to part/unit data |
| Part 11 §4.5–§4.6 pages and modules | routes and tabs above |
| Part 6 §3 permissions | `cabinet.view`, `cabinet.create`, `cabinet.update`, `materials.view`, `materials.create`, `materials.update`; `PermissionGate` on every mutation |
| R1/R3 | UUID ids; changes audited; no delete (archive/discontinue), deactivation instead of removal |
| R5 | Name-based duplicates in decor/supplier create follow the same "candidates, never auto-merge" contract as Phase 1 where Part 5 defines it |
| A11y + design gates | DESIGN §12.6, §15.1–§15.4, ui-ux §19 |

---

## 3. Routes and pages

| Route | Page component | Permissions | Endpoints | Notes |
|---|---|---|---|---|
| `/catalogue/cabinets` | `catalogue/presentation/pages/CabinetsListPage.svelte` | `cabinet.view` | `GET /catalog/cabinets` | family chips, DataTable, New cabinet modal |
| `/catalogue/cabinets/[id]` | `CabinetDetailPage.svelte` | `cabinet.view` | `GET/PATCH /catalog/cabinets/:id`, `GET/POST/PATCH /catalog/cabinets/:id/parameters`, `…/rules` | tabs Parameters / Component rules; Usage tab registered by Phase 6 |
| `/catalogue/rules` | `CatalogueRulesPage.svelte` | `cabinet.view` | `GET /catalog/cabinets/*/rules` (aggregated) | rule_version filter, active toggle |
| `/materials/decor` | `materials/presentation/pages/DecorListPage.svelte` | `materials.view` | `GET /materials/decor` | five filters + table |
| `/materials/decor/[id]` | `DecorDetailPage.svelte` | `materials.view` | `GET/PATCH /materials/decor/:id`, `GET /materials/decor/:id/edgings`, `/suppliers`, `/attributes` | tabs + sample asset |
| `/materials/edging` | `EdgingListPage.svelte` | `materials.view` | `GET/POST/PATCH /materials/edging` | table + modal editor |
| `/materials/suppliers` | `SuppliersListPage.svelte` | `materials.view` or `purchasing.view` | `GET /materials/suppliers` | list + create |
| `/materials/suppliers/[id]` | `SupplierDetailPage.svelte` | same | `GET/PATCH /materials/suppliers/:id`, linked decors | lead time, codes, linked decors |
| `/materials/manufacturers` | `ManufacturersPage.svelte` | `materials.view` | `GET/POST/PATCH /materials/manufacturers`, `GET/POST /materials/collections` | tree + inline editor |

Route params validate with `isUuid`; invalid → not-found state.

---

## 4. Modules and shared components

### 4.1 Modules

| Module | Domain | Data | Presentation |
|---|---|---|---|
| `catalogue` | `Cabinet`, `CabinetParameter` (type: `number|enum|boolean`, min/max/default, unit), `CabinetComponentRule` (`expression` JSON, `rule_version`, `condition`, `active`), list params, `cabinetFormSchema`, `parameterSchema`, `ruleSchema` | repository, provider, `catalogueApi`, mock, seed, adapters, mappers, tests | list, detail, parameter editor, rule editor, rules page, family chips |
| `materials` | `Manufacturer`, `MaterialCollection`, `Decor` (+ tier, `customerVisible`, status, attributes), `Edging`, `DecorEdging` (match type), `Supplier`, `DecorSupplier` (code, `isPrimary`), schemas | repository, provider, `materialsApi`, mock, seed, adapters, mappers, tests | decor list/detail, edging, suppliers, manufacturers tree, attribute editor, sample asset panel |

### 4.2 Shared UI added

| Component | Contract | Notes |
|---|---|---|
| `FilterPills` | DESIGN §9.3 (Badge/Pill, 44 px interactive target) | cabinet families, decor facets |
| `ExpressionEditor` | DESIGN §4.1 (`--font-mono`), §12.5 | JSON/expression textarea with line count, validation message, format action; no `eval`, ever |
| `TableEditorDrawer` | DESIGN §9.3 (Sheet/Side panel) | edging/supplier/parameter quick edits |
| `AttributeEditor` | DESIGN §12.5 | key/value rows, add/remove by keyboard |
| Reuse | `DataTable`, `Tabs`, `Combobox`, `ConfirmDialog`, `EvidenceUploader`, `StateChip` | no new variants invented |

### 4.3 Orchestrator wiring

Route permissions + nav entries (Catalogue, Materials sections per Part 11 §3); import-kind registration; `COLLECTIONS` additions; `mock-bootstrap`; schema bump + migration; tracker. Phase 3 must **not** touch `src/modules/imports/**` files directly.

---

## 5. Data

### 5.1 Collections

`cabinet_catalog`, `cabinet_parameter`, `cabinet_component_rule`, `manufacturer`, `material_collection`, `decor`, `edging`, `decor_edging`, `supplier`, `decor_supplier`, `decor_attribute`.

- Cabinet: id, tenantId, family, name, code, description, status (`active|discontinued`), timestamps.
- Parameter: cabinetId, key, label, type, unit (`mm|count|enum`), min, max, default, required.
- Rule: cabinetId, expression (JSON string or structured clauses — see §9), condition, ruleVersion (integer, monotonic), active, timestamps.
- Decor: manufacturerId, collectionId, name, code, colour, material, tier, `customerVisible`, status, timestamps.
- Edging: name, code, thickness, colour, status. `decor_edging`: decorId, edgingId, matchType.
- Supplier: name, code, leadTimeDays, contact fields, status. `decor_supplier`: decorId, supplierId, supplierCode, `isPrimary`.
- `decor_attribute`: decorId, key, value (free text, no schema change).

### 5.2 Seed

- 6 cabinet families, 24 cabinets, 18 parameters per representative cabinet, 12 component rules across 2 rule versions (one inactive, one invalid-on-purpose fixture for the editor error state).
- 4 manufacturers, 12 collections, 40 decors (all filter facets represented, 6 `customer_visible=false`, 3 discontinued), 8 edgings, 60 decor-edging links, 6 suppliers, 30 decor-supplier links (one decor deliberately has two primaries for the rejection test fixture, never persisted), 25 attributes.
- One decor with a sample asset (metadata + placeholder), one without (empty state).
- Deterministic ids (`deterministicUuid('decor:n')`), demo dates only.

### 5.3 Mock behaviour

- Parameter save: min ≤ default ≤ max, type match, enum options non-empty, unit required for mm; violation → `validation_failed` naming the parameter.
- Rule save: JSON must parse and match the rule schema; `rule_version` increments on functional change; invalid → `validation_failed`; a rule is never silently deleted (deactivate instead).
- Decor create: normalised name/code duplicate → dedup candidates (no auto-merge).
- Second primary supplier → `conflict` with the existing supplier named.
- Attribute keys are unique per decor; empty key/value rejected.
- Supplier/material import kinds: same staging, commit-new-only, per-row outcome contract as Phase 1.
- Every mutation writes an audit event (`create`, `update`, `deactivate`, `rule_version`).

### 5.4 Tests

Domain: schemas, parameter bounds, rule schema, attribute uniqueness, primary-supplier rule. Mock: list/filter/pagination, CRUD, audit, import kinds. Component: parameter editor, expression editor validation. E2E: create a cabinet with parameters + rule; filter decors; link an edging; add a supplier code; flip primary; add attributes; supplier import commit. Determinism check as in Phase 1.

---

## 6. Design contract

- **Dense master data:** compact density (44 px rows), sticky header, tabular numerals for dimensions, filter chips with 44 px targets, URL-synced filters.
- **Detail tabs:** 2–5 views of one object, `aria-selected`, arrow keys, URL tab param.
- **Rule editor:** monospace, visible line structure, inline validation ("Rule JSON is not valid at line 3…"), no syntax colouring beyond tokens, save only when valid, version shown as a caption.
- **Audit/immutability:** rule versions and prices are historical; the UI says a change never retro-applies (copy from Part 8 §1) without inventing mechanics.
- **Units/format:** mm with thin space + `mm`, counts locale-separated, no currency here (prices belong to costing in Phase 5).
- **States:** decor/supplier active/discontinued use `StateChip` categories from Appendix B (muted for discontinued); no page-local colours.
- **A11y:** comboboxes keyboard-complete, dialogs/sheets focus-trapped, expression editor labelled with hint + error, 200 % zoom, dark/high contrast.

---

## 7. Work waves

| Wave | Agent | Exclusive paths | Gate |
|---|---|---|---|
| 0 (serial) | orchestrator | interfaces (`catalogue`, `materials` types/repository/api), rule/parameter shapes, import-kind contract | `pnpm check` |
| 1 (parallel, 2) | data-agent per module | `modules/catalogue/{domain,data}/**`, `modules/materials/{domain,data}/**` | mock + validations tests |
| 2 (parallel, 2) | ui-agent per module | `modules/catalogue/presentation/**` + `routes/(dashboard)/catalogue/**`; `modules/materials/presentation/**` + `routes/(dashboard)/materials/**` | page smoke + component tests |
| 2 (parallel, 1) | shared-ui-agent | `FilterPills`, `ExpressionEditor`, `TableEditorDrawer`, `AttributeEditor` in `src/shared/presentation/ui/**` | component tests |
| 3 (serial) | orchestrator | wiring (routes/nav/import kinds/collections/bootstrap/schema/migration/tracker) | check/lint/arch:check |
| 4 (parallel) | gate-runner + boundary-reviewer | read-only | full gate + boundary report |
| 5 | orchestrator | Rule 3 matrix on 9 routes, flows (cabinet, rule, decor, supplier, import), fixes, commits | post-fix screenshots |

Phase 3 is the only phase permitted to start before phase 1 is completed (AGENTS §0.3): catalogue/materials need only phase 0; supplier/material imports require the Phase 1 shell.

---

## 8. Done when

- [ ] Cabinet list filters by family, opens a detail with Parameters and Component rules tabs; a parameter outside its bounds and a invalid rule JSON are rejected with the offending field named.
- [ ] Rule save increments `rule_version` only on functional change; deactivating a rule keeps it visible in history; no rule is deleted.
- [ ] `/catalogue/rules` aggregates rules across cabinets, filters by `rule_version`, toggles active, and every toggle is audited.
- [ ] Decor list applies all five filters from the URL; detail shows Edgings, Suppliers, Attributes and the sample asset (or a labelled placeholder).
- [ ] A second primary supplier for one decor is rejected and names the existing primary; attribute keys are unique; edging match types render and edit.
- [ ] Manufacturers → collections tree creates/edits both levels; suppliers show lead time and linked decors.
- [ ] Supplier and material import kinds are available in the Phase 1 wizard and follow the same staging/commit/outcome contract.
- [ ] No preview-engineering UI exists yet (deferred to Phase 6); no snapshot/retro-engineering path is introduced.
- [ ] `arch:check` 0; no mock/adapter imports in presentation; no business rules in `.svelte`; no Svelte 4 syntax; UUIDs and deterministic seeds only.
- [ ] Unit + e2e suites pass; browser matrix on all nine routes (320/390/768/1280/1920, dark, high contrast, 200 %, keyboard), zero console errors, targets and contrast pass.
- [ ] Full pnpm gate green; committed and pushed to `main`; phase status flipped only after the gate.

---

## 9. Open questions (report, never guess)

1. **Component-rule expression format** — Part 8 §1/§2 name "component rules (expr JSON editor + version, condition)" but the grammar is not specified. Default: structured JSON clauses validated by a zod schema, executed by the Phase 6 engine (never `eval`). Confirm with the engineering owner.
2. **Parameter type system** — Part 5 lists parameter min/max/default; whether enums, booleans and units beyond mm are supported is unclear. Default: `number | enum | boolean` with unit `mm | count`.
3. **Preview-engineering playground home** — deferred to Phase 6. Confirm it belongs to the catalogue page (tab registered later) and not to a standalone route.
4. **Collection hierarchy depth** — "Manufacturer → Collection tree" suggests one level; confirm whether sub-collections exist.
5. **Decor attribute keys** — free key/value (DECISION implied by Part 5). Confirm no controlled vocabulary.
6. **Supplier model** — Part 5 stores supplier codes per decor; whether a supplier also has global product references is undefined. Default: codes per decorating link only.
7. **Duplicate policy for master data** — R5 is written for customers/properties/projects. Default: same "candidates, never auto-merge" behaviour for decor/supplier names; confirm.
8. **Price fields on decor** — Part 8 §8 implies prices for costing; where the price lives (decor, supplier link, price list) is a Phase 5 decision. This phase stores no price to avoid inventing one.
9. **Import column sets for suppliers/materials** — column maps are not specified; default: the fields present in the create forms, with unknown columns rejected in the mapper.
