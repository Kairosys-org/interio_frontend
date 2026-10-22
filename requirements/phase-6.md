# Phase 6 — Production, purchasing and the saw export

> **Status:** not started · **Depends on:** phases 3–5 · **Unlocks:** phase 7
> **Spec map:** Part 12 Phase 3 · Part 11 §8 steps 7–8
> **Read with:** `DESIGN.md`, `spec.md` Parts 4 §6–§7/§11, 8, 10 §14–18, 11 §4.7–4.8.

## 1. Scope

**Ships**

- Jobs list (board + table), job hub (stage indicator, contract value, survey chain chip, tabs: Rooms/Units, Parts, Costs, Payments, Installations, Aftercare, Exports, Audit). The Installations and Aftercare tabs are stubs here and are wired in phase 7.
- Engineering page: unit list, configure-unit drawer against parameter bounds, engineer selected/batch, progress to `procuring`.
- Parts list and part detail: identity + QR, dimensions/material, edge map, boring spec, 13 validation results, event timeline, role-gated transitions, remake request, lineage.
- Workshop board: kanban by active part status, held column with reasons, `ScanInput` UUID entry, reprint label, quick note.
- Remakes list/detail: request, approve (creates replacement), complete, reject.
- Export runs and mapping page with the G6 hold-point banner; preview only until mapping confirmed.
- Purchasing: jobs needing costs, actual-vs-quoted variance, add/correct actuals.
- Shared modules owned here: `ValidationList`, `QrPanel`, `ScanInput`; mounts the phase 5 `FinancialsPanel`.

**Not in this phase:** site/aftercare/reports (phase 7), any Detel CNC output, any production export before the hold point clears.

## 2. Requirements

| Group | Covered here |
|---|---|
| Rules | R1, R3, R4, R8 |
| Requirements | S16 (job costs), S22–S31 |
| Gates | G5, G6 |
| Tests | FT-M8-01…04, FT-M9-01…04, FT-M10-01, PERF-05, C-02 |

## 3. Routes and pages

| Route | Permission | Primary action |
|---|---|---|
| `/jobs` | `job.view` | Open job |
| `/jobs/:id` | `job.view` | Next legal transition |
| `/jobs/:id/engineering` | `job.view` | Engineer selected |
| `/jobs/:id/parts` | `part.view` | Validate and release |
| `/parts/:id` | `part.view` | Next part transition |
| `/workshop` | `part.view` | Scan part |
| `/remakes` | `remake.view` | Request remake |
| `/remakes/:id` | `remake.view` | Approve remake |
| `/jobs/:id/exports` | `export.view` | New export |
| `/exports/:id` | `export.view` | Download |
| `/exports/mapping` | `export.view` | Confirm mapping |
| `/purchasing` | `job_cost.view` | Record actual |
| `/jobs/:id/costs` | `job_cost.view` | Add actual cost |
| `/jobs/:id/financials` | `payment.view` | none (derived values only) |

## 4. Modules and shared components

```text
src/modules/jobs/          domain (job machine, stage counts), data, presentation ListPage, HubPage, tabs
src/modules/engineering/   domain (deterministic breakdown mirror), data, presentation EngineeringPage, ConfigureUnitDrawer
src/modules/parts/         domain (part machine, validation V01–V13, skip rules), data, presentation
  pages/                   PartsListPage, PartDetailPage, WorkshopBoardPage
  components/              ValidationList, EdgeMap, BoringSpec, PartTimeline, LabelsButton
src/modules/remakes/       domain, data, presentation
src/modules/exports/       domain (mapping status), data, presentation ExportRunsPage, ExportDetailPage, MappingPage
src/modules/purchasing/    domain, data, presentation PurchasingPage, JobCostsPage, VarianceTable
```

`ScanInput` is a single labelled field: paste/type, submit on Enter, validates 36-char lowercase UUID; no camera, no scanner tab.

## 5. Data

| Endpoint | Use |
|---|---|
| `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/transition`, `/rooms`, `/units`, `/engineering/progress` | job spine |
| `POST /units/:id/engineer`, `POST /jobs/:id/engineer`, `GET /units/:id/parts`, `PATCH /units/:id` | engineering |
| `/jobs/:id/parts`, `/parts/:id`, `/validate`, `/jobs/:id/validate`, `/transition`, `/release`, `/jobs/:id/parts/release`, `/edges/:position`, `/events`, `/scan`, `/jobs/:id/labels` | parts + workshop |
| `GET /parts/:id/qr` | label QR |
| `/remakes`, `POST /parts/:id/remakes`, `GET /remakes/:id`, `POST /remakes/:id/transition` | remakes |
| `/jobs/:id/exports`, `/exports/:id`, `/download`, `/exports/mapping`, `/exports/released-parts` | export + G6 |
| `/jobs/:id/costs`, `/job-costs/:id`, `/costs/variance` | purchasing |

Mock seeds: one job at each meaningful stage, 60 parts across rooms/units, two held with validation errors, one remake chain, one preview export run, mapping `unconfirmed`.

## 6. Design contract

- Board pattern per DESIGN §10.2; compact density default here; drag is an enhancement with a menu alternative.
- `ValidationList` shows code + human label + pass/fail/warning + reason; filter by result; count changes announced.
- Labels: part UUID text + QR; **BORING: YES/NO** at least twice body size, bold, boxed, monochrome-safe; remake badge with original UUID.
- G5 blocks release with per-item reasons; partial release reports released vs blocked.
- G6 hold point is a persistent banner; production mode is impossible, preview is watermarked “UNCONFIRMED MAPPING — NOT FOR MACHINE IMPORT”.
- Stage skips produce an explicit event note; no silent jumps in the timeline.
- No UUID display outside part detail and QR payloads.

## 7. Work waves

| Wave | Agent | Exclusive files | Gate |
|---|---|---|---|
| 1 | parts domain | `parts/domain/**` (machine, V01–V13) + tests | skip rules + validation matrix |
| 1 | engineering domain | `engineering/domain/**` + tests | deterministic breakdown |
| 2 | jobs + engineering UI | `modules/jobs/**`, `modules/engineering/**` | stage counts + drawer bounds |
| 2 | parts + workshop UI | `modules/parts/**` | G5 + scan + labels |
| 3 | remakes | `modules/remakes/**` | original untouched + one open request |
| 3 | export + mapping | `modules/exports/**` | G6 impossible in production |
| 3 | purchasing | `modules/purchasing/**` | 13 elements + variance |
| 4 | gates | Playwright workshop + export | all gates green |

## 8. Done when

- [ ] Engineering is deterministic and records `rule_version`; config change resets to pending.
- [ ] Release is blocked by an unverified survey chain and by any failing validation item; blocked rows name the reason.
- [ ] Workshop scans append events and reject illegal transitions; skipped stages are explicit.
- [ ] Labels render from part data only, with prominent boring indicator and QR.
- [ ] Remake approval creates a new part with lineage; the original is never edited or deleted.
- [ ] Production export is unreachable with `mapping_status='unconfirmed'`; preview is watermarked.
- [ ] Job costs show quoted vs actual per element; no accounting-ledger behaviour.

## 9. Open questions

Q1–Q6 (saw-PC capture, Optimak version, MacmazzaLink, label printer, read-back, encoding/units) gate the hold point, not the UI. Q18 (Detel hole patterns) gates boring-spec content only. Q4/Q22 label printing.
