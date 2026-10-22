# Phase 1 — Records spine (customers, properties, projects)

> **Status:** not started · **Depends on:** phase 0 · **Unlocks:** phases 2–8
> **Spec map:** Part 12 Phase 1b · Part 11 §8 step 2
> **Read with:** `DESIGN.md`, `spec.md` Parts 3, 5, 10, 11 (and Part 6 §3 for permissions).

## 1. Scope

**Ships**

- Customer list + detail (properties, projects, audits), create/edit/archive, dedup review inline.
- Property list + detail, create/edit/archive.
- Project list + project hub with `StageIndicator`, summary cards, `AssignmentPanel`, tabs (Surveys, Designs, Quotes, Orders, Job, Audit), create wizard (customer → property → project → assign surveyors).
- Dedup queue with side-by-side comparison and `DedupReviewModal`.
- Dashboard with real role-scoped widgets and next-step actions.
- Activity page (audit stream, before/after diff, filters).
- Governed CSV import for **customers** only: batch list, wizard, row outcomes, commit.
- Shared modules owned here: `DataTable`, `StageIndicator`, `AssignmentPanel`, `DedupReviewModal`, `AuditTrailTab`, `GateBanner` (component; gates used from phase 4 onward).

**Not in this phase:** surveys and mobile (phase 2), designs (phase 4), quotes/orders (phase 5), supplier/decor/price-list imports (phase 3), export centre (phase 8).

## 2. Requirements

| Group | Covered here |
|---|---|
| Rules | R1, R2, R3, R5, R8 |
| Requirements | S1 (assignment UI), S2 (project context), S34 (scoped visibility), S38 (customer import), S39 |
| Tests | FT-M2-01…04, E2E-07 (import half), TEN-01/02 (list scope), C-02 |

## 3. Routes and pages

| Route | Permission | Primary action |
|---|---|---|
| `/dashboard` | authenticated | role-specific next step |
| `/activity` | `audit.view` | Export CSV |
| `/customers` | `customer.view` | New customer |
| `/customers/:id` | `customer.view` | Edit customer |
| `/properties` | `property.view` | New property |
| `/properties/:id` | `property.view` | Edit property |
| `/projects` | `project.view` | New project |
| `/projects/:id` | `project.view` | Add surveyor (P2 adds New survey) |
| `/dedup-queue` | `customer.view` | Review duplicates |
| `/imports` | `import.view` | New import |
| `/imports/new` | `import.create` | Stage import |
| `/imports/:id` | `import.view` | Commit import |

## 4. Modules and shared components

```text
src/modules/customers/   domain, data, presentation (ListPage, DetailPage, Cells, Form)
src/modules/properties/  domain, data, presentation
src/modules/projects/    domain, data, presentation (ListPage, HubPage, Wizard, AssignmentPanel wrapper)
src/modules/dedup/       domain, data, presentation (QueuePage, DedupReviewModal)
src/modules/imports/     domain (csv parsing rules), data, presentation (ListPage, WizardPage, RowOutcomes)
src/modules/activity/    domain, data, presentation (ActivityPage)
src/modules/dashboard/   role widgets, next-step cards
```

`StageIndicator` renders the 15 stages + G1–G8 badges from the project summary; compact mode shows current ± 1. `DataTable` gets sticky header, sortable columns, URL-synced filters, compact/comfortable density, bulk bar, keyset pagination, stacked cards below `md`.

## 5. Data

| Endpoint | Use |
|---|---|
| `GET/POST /customers`, `GET/PATCH /customers/:id`, archive/unarchive, `/dedup/review` | customers |
| `GET/POST /properties`, `GET/PATCH /properties/:id`, archive, dedup review | properties |
| `GET/POST /projects`, `GET/PATCH /projects/:id`, archive, dedup review, `/summary` | projects |
| `GET/POST /projects/:id/assignments`, `DELETE …/:userId` | surveyor assignment |
| `GET /dedup-queue` | review queue |
| `GET /audit-events`, `GET /audit-events/:id` | activity + audit tab |
| `GET /imports`, `POST /imports`, `GET /imports/:id`, `GET /imports/:id/rows`, `POST /imports/:id/commit` | customer import |
| `GET /reports/pipeline` | dashboard widgets |

Mock seeds: 3 customers, 3 properties, 4 projects (one held in dedup review), one assigned surveyor per project, one staged customer import batch.

## 6. Design contract

- Patterns: Dashboard, List, Detail hub, Wizard, Audit/activity (DESIGN §10.2).
- `AssignmentPanel`: combobox multi-select, role badge, removal confirmation explains “existing surveys kept, new surveys blocked”.
- `DedupReviewModal`: focus trap, radio decision, mandatory note for “Confirm distinct”, full candidate labels (DESIGN §9.2).
- Empty states explain the next action; filtered-empty is distinct from empty; errors inline.
- Money/date/percent formatting only through `shared/lib/format`; UUIDs never displayed.
- Destructive actions (archive) use confirmation with consequence text; no hard delete anywhere.

## 7. Work waves

| Wave | Agent | Exclusive files | Gate |
|---|---|---|---|
| 1 | customers | `modules/customers/**` | CRUD + normalisation tests |
| 1 | properties + projects | `modules/properties/**`, `modules/projects/**` | FK creation order tests |
| 1 | shared tables | `shared/presentation/ui/DataTable*` | URL filter + a11y table test |
| 2 | dedup | `modules/dedup/**` | never auto-merge test |
| 2 | assignments + stage | `AssignmentPanel`, `StageIndicator` | role + removal rules |
| 2 | imports | `modules/imports/**` | staged → commit new-rows-only |
| 3 | dashboard + activity | `modules/dashboard/**`, `modules/activity/**` | scoped widgets |
| 4 | gates | Playwright review 4 viewports + dark + 200 % | all gates green |

## 8. Done when

- [ ] Duplicate create returns candidates and a held row; nothing is merged automatically.
- [ ] Assigning a non-Surveyor is rejected; removing an assignment blocks new surveys and keeps existing ones.
- [ ] Project hub shows stage indicator, assignment panel, child tabs and audit tab.
- [ ] Every list filter is in the URL and survives reload.
- [ ] Import commits new rows only; clashes land in `/dedup-queue`; per-row outcomes visible.
- [ ] DESIGN §15.1–15.4 checklist passes; tables keyboard-operable; stacked cards below `md`.

## 9. Open questions

None blocking. Dedup reviewer role is Sales per Part 6 §3; import commit stays System Admin / Owner-Management.
