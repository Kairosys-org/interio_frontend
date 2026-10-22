# Phase 5 — Commercial: quotes, approval, orders, payments

> **Status:** not started · **Depends on:** phases 3–4 · **Unlocks:** phases 6–7
> **Spec map:** Part 12 Phase 2 (commercial half) · Part 11 §8 step 6
> **Read with:** `DESIGN.md`, `spec.md` Parts 4 §4–§5/§10, 7, 10 §12–13/§21, 11 §4.2/§4.11.

## 1. Scope

**Ships**

- Quote list and quote detail with version timeline; new quote requires a design version.
- Quote builder: line editor with decor/unit FK pickers, 13 cost elements, recompute, pricing chain (cost → mark-up → discount → VAT → total → GP %), terms, issue (G2), withdraw.
- Approval: frozen snapshot viewer, evidence upload mandatory, atomic G3 record, idempotent repeat.
- Orders list/detail, readiness checklist, create job (G4, idempotent).
- Payments list + job payments panel; mark deposit satisfied, paid/refund transitions; derived financials.
- Shared modules owned here: `MoneyField`, `PricingChainWidget`, `EvidenceUploader`; reuses `VersionTimeline`, `GateBanner`, `StateChip`.

**Not in this phase:** job hub and production tabs (phase 6), reports (phase 7). `/jobs/:id/financials` content is built here and mounted in the phase 6 job hub.

## 2. Requirements

| Group | Covered here |
|---|---|
| Rules | R1, R3, R4, R8 |
| Requirements | S16–S21, S33 |
| Gates | G2, G3, G4 |
| NFR | N10 (currency/format) |
| Tests | FT-M6-01…04, FT-M7-01…04, FT-M12-01…02, PERF-03, C-02 |

## 3. Routes and pages

| Route | Permission | Primary action |
|---|---|---|
| `/quotes` | `quote.view` | New quote |
| `/quotes/:id` | `quote.view` | New version |
| `/quotes/:id/versions/:vid` | `quote.view` | Issue quote |
| `/approvals` | `approval.view` | Record approval |
| `/approvals/:id` | `approval.view` | Mark deposit satisfied |
| `/orders` | `sales_order.view` | Create job |
| `/orders/:id` | `sales_order.view` | Create job |
| `/payments` | `payment.view` | New payment |

## 4. Modules and shared components

```text
src/modules/quotes/       domain (pricing chain pure functions), data, presentation
  pages/                  QuoteListPage, QuoteDetailPage, QuoteBuilderPage
  components/             LineEditor, CostPanel, PricingChainWidget, TermsForm, IssueChecklist
src/modules/approvals/    domain, data, presentation ApprovalListPage, ApprovalDetailPage, EvidenceUploader
src/modules/orders/       domain, data, presentation OrderListPage, OrderDetailPage, CreateJobPanel
src/modules/payments/     domain, data, presentation PaymentListPage, JobPaymentsPanel, FinancialsPanel
```

Pricing chain lives in `domain/pricing.ts` as pure integer-pence functions with unit tests mirroring Part 7 §2 worked example (10,000.00 cost → 22.03 % margin).

## 5. Data

| Endpoint | Use |
|---|---|
| `GET/POST /projects/:id/quotes`, `GET /quotes/:id`, `POST /quotes/:id/versions` | quote header/versions |
| `GET/PATCH /quotes/versions/:vid`, `/lines`, `/costs`, `POST …/costs/recompute`, `POST …/preview`, `POST …/transition` | builder + G2 |
| `POST /quotes/versions/:vid/approval`, `GET /approvals/:id`, `POST …/deposit-satisfied`, `GET …/readiness` | G3 + G4 precondition |
| `POST /orders`, `GET /orders`, `GET /orders/:id`, `POST /sales-orders/:id/job` | order + G4 |
| `/jobs/:id/payments`, `PATCH /payments/:id`, `POST /payments/:id/transition`, `GET /jobs/:id/financials` | payments |

Mock seeds: one project with quote V1 superseded and V2 issued, costs covering all 13 elements, a pending approval with evidence, an order awaiting deposit, payments in pending/paid states.

## 6. Design contract

- Money: integer pence stored, GBP `en-GB` displayed, tabular numerals, true minus sign; never compute in floats in the UI.
- `PricingChainWidget` is a definition list, not a colour bar; each step labelled; derived values marked “Derived”.
- Exactly one filled primary action per screen; the primary action is the next legal transition.
- `EvidenceUploader` blocks the approval until a required asset is complete; errors sit next to the file.
- G2/G3/G4 failures render reasons next to the action, never a bare disabled button; readiness checklist uses check + text.
- Draft versions editable, issued/approved frozen with lock + “Frozen”; no destructive edits.
- Payment refunds require a reason; deposit satisfaction survives refund (UI states this).

## 7. Work waves

| Wave | Agent | Exclusive files | Gate |
|---|---|---|---|
| 1 | pricing domain | `quotes/domain/pricing*` + tests | Part 7 worked example + rounding |
| 1 | quote data | repository/api/mock/seed | G2 guards |
| 2 | quote builder | pages + line/cost/pricing components | recompute + freeze |
| 2 | approvals | `modules/approvals/**` + `EvidenceUploader` | evidence mandatory + idempotency |
| 3 | orders + G4 | `modules/orders/**` | readiness + idempotent job |
| 3 | payments | `modules/payments/**`, financials panel | derived-only + refund rule |
| 4 | gates | Playwright commercial journey | all gates green |

## 8. Done when

- [ ] Chain identities hold exactly; recompute never alters a superseded version.
- [ ] Issue blocks without an issued/approved design, lines, cost sums, terms, or discount authority.
- [ ] Approval is one atomic UI flow: quote + design approved, snapshot frozen, evidence required.
- [ ] Job creation shows the readiness checklist and stays idempotent on repeat submit.
- [ ] Financials are labelled derived and computed from payment rows only.
- [ ] Negative money uses `−£480.00`, never parentheses or red-only.
- [ ] DESIGN §15 passes; forms preserve data on error.

## 9. Open questions

Q16 (discount authority threshold), Q19 (regions/currencies and VAT per region), Q8 (warranty length does not gate quoting).
