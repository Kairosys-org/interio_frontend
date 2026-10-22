# Phase 7 — Site, aftercare and reports

> **Status:** not started · **Depends on:** phases 5–6 · **Unlocks:** phase 8 (closing the loop)
> **Spec map:** Part 12 Phase 4 · Part 11 §8 steps 9–10
> **Read with:** `DESIGN.md` §3.9/§10.2, `spec.md` Parts 4 §8–§9, 10 §19–20/§22, 11 §4.9–4.11.

## 1. Scope

**Ships**

- Installations list and detail: timeline (ready → booked → delivered → installation → snagging → sign-off → complete), team editor, site notes, sign-off panel with evidence (G7), snags.
- Snags board (cross-job): severity/status filters, part link chips, open-remake action.
- Aftercare list/detail: request types, original/replacement part lineage, visit log, status machine, resolution note.
- Reports index + `/reports/:name`: parameter form, chart and/or table, CSV export; pipeline, quote margins, job profit, production board, aftercare, audit summary.
- Job hub tabs for Installations, Aftercare and Reports wiring (the hub itself ships in phase 6).
- Shared `StateChip`, `DataTable`, `EvidenceUploader`, `PricingChainWidget` (financials only).

**Not in this phase:** new backend domains; any chart library beyond lightweight SVG/CSS unless explicitly approved (D5).

## 2. Requirements

| Group | Covered here |
|---|---|
| Rules | R1, R3, R4, R8 |
| Requirements | S32, S33 (close-out view), S35 (report/CSV audit) |
| Gates | G7 |
| Tests | FT-M11-01…03, FT-M13-01…02, E2E-05, C-02 |

## 3. Routes and pages

| Route | Permission | Primary action |
|---|---|---|
| `/installations` | `installation.view` | Book installation |
| `/installations/:id` | `installation.view` | Next transition / Capture sign-off |
| `/snags` | `snag.view` | Resolve snag |
| `/aftercare` | `aftercare.view` | New request |
| `/aftercare/:id` | `aftercare.view` | Add visit |
| `/reports` | report-specific | Open report |
| `/reports/:name` | report-specific | Export CSV |

## 4. Modules and shared components

```text
src/modules/installations/  domain (installation machine), data, presentation
  pages/                    InstallationListPage, InstallationDetailPage
  components/               InstallationTimeline, TeamEditor, SignOffPanel, SnagList
src/modules/snags/          domain, data, presentation SnagBoardPage, SnagDetailDrawer
src/modules/aftercare/      domain (aftercare machine, visits), data, presentation
  pages/                    AftercareListPage, AftercareDetailPage
  components/               PartLineage, VisitLog, ResolutionForm
src/modules/reports/        domain (report registry, params), data, presentation
  pages/                    ReportIndexPage, ReportPage
  components/               ReportChart, ReportTable, CsvExportButton
```

Charts use fixed categorical colours from DESIGN §3.9, max 7 series, 2 px lines, no gradients, direct labels when ≤ 4 series, dash/pattern as a second channel.

## 5. Data

| Endpoint | Use |
|---|---|
| `/jobs/:id/installations`, `/installations/:id`, `PATCH`, `/transition`, `/team`, `/signoff` | installation + G7 |
| `/installations/:id/snags`, `/snags`, `/snags/:id/transition` | snags |
| `/aftercare`, `POST /jobs/:id/aftercare`, `/aftercare/:id`, `/transition`, `/visits` | aftercare |
| `/reports/pipeline`, `/quote-margins`, `/job-profit`, `/production-board`, `/aftercare`, `/audit-summary`, `?format=csv` | reports |

Mock seeds: one job in `snagging`, one installation awaiting sign-off, two snags (one linked to a part with a remake), one aftercare request with two visits, six months of synthetic report data.

## 6. Design contract

- Installation timeline is an ordered list with text states; current step marked by shape + label, not colour alone.
- Sign-off panel: customer name, timestamp, evidence uploader; G7 failure explains the missing evidence beside the action.
- Snags use the board pattern; severity uses semantic colour + label + icon; resolving requires a note.
- Aftercare lineage shows original and replacement part UUIDs (allowed here), with links to part detail.
- Reports: parameter form + result; derived values labelled “Derived”; CSV is the only export action; empty state explains the date range that produced no rows.
- Tables become stacked cards below `md`; charts reflow without horizontal page scroll.

## 7. Work waves

| Wave | Agent | Exclusive files | Gate |
|---|---|---|---|
| 1 | installations + G7 | `modules/installations/**` | evidence + timeline |
| 1 | snags | `modules/snags/**` | part link + remake action |
| 2 | aftercare | `modules/aftercare/**` | machine + visits + lineage |
| 2 | reports domain/data | `modules/reports/domain/**`, `modules/reports/data/**` | permission scoping |
| 3 | reports UI + charts | `modules/reports/presentation/**` | chart palette + CSV |
| 4 | gates | Playwright site journey | all gates green |

## 8. Done when

- [ ] G7 blocks sign-off without customer name, timestamp and evidence.
- [ ] `complete` is blocked while any snag is open or in progress; waive requires a reason.
- [ ] Aftercare follows its machine with required notes; visits record engineer and parts used.
- [ ] Every report runs under the caller’s permission scope; CSV writes an audited export.
- [ ] Charts stay within the fixed palette and remain readable without colour.
- [ ] DESIGN §15 passes; print/zoom unaffected.

## 9. Open questions

Q8 (warranty length and retention), Q5 (read-back from Optimak is not needed here).
