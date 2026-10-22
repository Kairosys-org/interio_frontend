# Phase 5 — Commercial: quotes, approval, orders, payments

> **Status:** not started · created 2026-10-22
> **Depends on:** phase-3, phase-4 · **Unlocks:** 6, 7
> **Spec map:** `spec.md` Part 12 §1 "Phase 2 — Commercial" (costing S16–S19, approval + job gate S20–S21, payments S33); Part 7 in full; Part 11 §4.2 (quotes, quote builder, approvals, orders) and §4.11 (payments); Part 10 §12, §13, §21; Part 5 `cost_line`, `quote`, `quote_version`, `quote_line`, `approval`, `sales_order`, `payment`; Part 4 §4 (quote/approval), §5 (order), §10 (payment); gates **G2, G3, G4**; Part 13 FT-M6-01…04, FT-M7-01…03, C-02/C-05.
> **Read with:** `spec.md` Part 7 in full, Part 10 §12–§13 + §21, Part 11 §4.2 + §4.11, Part 4 §4–§5 + §10, Part 5 quad entities, Part 13 §3 (M6, M7), Part 12 §4 (Q16, Q19); `DESIGN.md` §3.7 + Appendix B, §4.3 (money), §9.2 (`MoneyField`, `PricingChainWidget`, `EvidenceUploader`, `VersionTimeline`), §10.2 (Detail hub, Editor), §10.3 (immutability, derived financials), §12, §13.3–§13.4, §15; `ui-ux.md` §9, §13, §15; `standards/architecture.md` §3–§4, §10–§11, §16, §20–§22; `testing/ui-ux-tester.md`.
> **DESIGN.md blocker:** Draft V1.0 · awaiting approval (Rule 1.5).
> **Branch:** RULE 0 — `main` only, no PR.
> **Frontend only:** mock-first. Money is integer pence end-to-end; all totals are **derived** in the mock exactly as Part 7 defines and recomputed, never stored as mutable UI state.
> **Prerequisite:** phase-3/4 `Status: completed` (materials prices + issued design version for G1/G2 inputs).

---

## 1. Scope

### Ships

1. **`quotes` module**
   - `/quotes`: list (state, customer, total, margin), New quote modal (pick an issued design version; unissued versions are blocked with a G2 hint).
   - `/quotes/[id]`: version timeline (V1…Vn + status), header actions (new version, issue, withdraw).
   - `/quotes/[id]/versions/[vid]`: **quote builder** — `LineEditor` (decor/unit FK pickers), `CostPanel` (the 13 cost elements with recompute), `PricingChainWidget` (cost → mark-up → discount → VAT → total → GP %, live and derived), `TermsForm`, Issue (G2), require-approval action.
   - Preview computation without persisting; recompute endpoint mapped through the mock.
2. **`approvals` module**
   - `/approvals`: list; `/approvals/[id]`: frozen snapshot viewer (design, quote, finishes, totals, evidence asset, deposit status, readiness flags) + **Mark deposit satisfied** for Accounts (G4 precondition).
   - Approval creation is atomic in the mock: quote version `approved` + design version `approved` + approval row with frozen snapshot + audit for both; idempotent per version (unique).
3. **`orders` module**
   - `/orders`: list; `/orders/[id]`: detail with **Create job** button and the G4 checklist (approved ✓ evidence ✓ deposit ✓ → enabled), idempotent submit, blocking reasons when incomplete.
   - Order row per approval; creation from an approved quote version.
4. **`payments` module**
   - `/payments`: list (type, status, due/paid), New payment modal (job), mark paid / refund transitions for Accounts with confirmations.
   - Payment machine `pending → paid | cancelled | refunded`; deposit satisfaction writes `deposit_satisfied_at` + payment FK in the same transaction; a later refund does **not** unset it (Owner override only, audited).
5. **Job bridge (contract only):** `POST /sales-orders/:id/job` creates a minimal job row (id, contract value + currency, customer/property/survey/design FKs) so G4 is complete. The job hub and all production data are Phase 6; Phase 6 extends the same row via migration.
6. **Shared UI** additions in §4.2.
7. **Audit** for every state change, snapshot freeze, deposit action and payment transition; evidence required for approvals.

### Not in this phase

- Job hub, engineering, parts, production, procurement, exports (Phase 6).
- Financials/reports/payments dashboards (`/jobs/:id/financials` is Phase 7); accounting integrations (permanent exclusion); billing (permanent exclusion).
- Price lists/versioned pricing engine beyond the 13 elements and the chain defined in Part 7.
- Multi-currency UX beyond the currency field (Q19).

---

## 2. Requirements

| Requirement | Where it is enforced |
|---|---|
| S16 — costing over 13 elements | `quotes/domain/costing.ts` pure calculation; `CostPanel`; recompute without persisting |
| S17 — pricing chain identities + GP/margin | `quotes/domain/pricing.ts`; `PricingChainWidget`; integer pence only |
| S18/S19 — quote record, versions, immutability | version engine (contiguous, supersede on issue, frozen issued); withdraw/expire leave rows immutable |
| **G2** — issue requires lines, terms and an issued design version | mock validates and returns `gate_blocked` + reasons before the action |
| **G3** — atomic approval with mandatory evidence | mock transaction + unique per quote version; approval snapshot frozen; evidence asset required |
| **G4** — job creation requires approved quote + satisfied deposit | `orders` checklist + mock `gate_blocked`; `Idempotency-Key` replay returns the same job |
| S21 — deposit satisfaction | `approvals` Accounts action → payment `paid` → `deposit_satisfied_at` same transaction; refund does not unset |
| S33 — operational payments, not accounting | payment types deposit/stage/final; statuses; derived financials labelled later |
| R1/R3 | UUID ids incl. idempotency keys; snapshots immutable; no delete of issued/approved rows |
| Part 6 §3 | `quote.view/create/update/issue/approve`, `approval.view/approve`, `sales_order.view/create`, `payment.view/create/update`; `PermissionGate` |
| Part 11 §1 / DESIGN §10.3 | state chip, gate banner, audit tab; derived values labelled |
| Money rules | integer pence in/out, 2-decimal GBP display, true minus sign, no float maths, tabular numerals |
| A11y + design gates | DESIGN §12.6, §15.1–§15.4, ui-ux §19 |

---

## 3. Routes and pages

| Route | Page component | Permissions | Endpoints | Notes |
|---|---|---|---|---|
| `/quotes` | `quotes/presentation/pages/QuotesListPage.svelte` | `quote.view` | `GET /quotes`, `GET /projects/:id/quotes` | new quote requires issued design version |
| `/quotes/[id]` | `QuoteDetailPage.svelte` | `quote.view` | `GET /quotes/:id`, `GET /quotes/:id/versions` | timeline + new version/issue/withdraw |
| `/quotes/[id]/versions/[vid]` | `QuoteBuilderPage.svelte` | `quote.view` (edit: `quote.update`) | `GET /quotes/versions/:vid`, lines/costs/recompute/transition endpoints | builder, G2 panel, frozen state |
| `/approvals` | `approvals/presentation/pages/ApprovalsListPage.svelte` | `approval.view` | `GET /approvals` | list + readiness |
| `/approvals/[id]` | `ApprovalDetailPage.svelte` | `approval.view` | `GET /approvals/:id`, `POST /approvals/:id/deposit-satisfied`, `GET /approvals/:id/readiness` | frozen snapshot + deposit action |
| `/orders` | `orders/presentation/pages/OrdersListPage.svelte` | `sales_order.view` | `GET /orders` | list |
| `/orders/[id]` | `OrderDetailPage.svelte` | `sales_order.view` | `GET /sales-orders/:id`, `POST /sales-orders/:id/job` | G4 checklist + idempotent create |
| `/payments` | `payments/presentation/pages/PaymentsListPage.svelte` | `payment.view` | `GET /payments`, `POST /jobs/:id/payments`, `PATCH /payments/:id` | type/status/due filters, mark paid/refund |

Approval creation uses `POST /quotes/versions/:vid/approval` (no list-page route of its own). Route params validated with `isUuid`.

---

## 4. Modules and shared components

### 4.1 Modules

| Module | Domain | Data | Presentation |
|---|---|---|---|
| `quotes` | `Quote`, `QuoteVersion`, `QuoteLine`, `CostLine` (13 elements), `PricingChain`, `quoteFormSchema`, `lineSchema`, `termsSchema`, pure `costing.ts` + `pricing.ts` + `versioning.ts` | repository, provider, `quotesApi`, mock, seed, adapters, mappers, tests | list, detail, builder, `LineEditor`, `CostPanel`, `TermsForm`, `QuoteHeader`, `GatePanel` |
| `approvals` | `Approval`, `ApprovalSnapshot`, `ReadinessFlag`, `approvalSchema`, `depositSatisfiedSchema` | repository, provider, `approvalsApi`, mock, seed, adapters, mappers, tests | list, detail, `SnapshotViewer`, `ReadinessChecklist`, `DepositAction` |
| `orders` | `SalesOrder`, `OrderLine`, `CreateJobInput`, `jobCreationSchema` | repository, provider, `ordersApi`, mock, seed, adapters, mappers, tests | list, detail, `GateChecklist`, `CreateJobButton` |
| `payments` | `Payment`, `PaymentType`, `PaymentStatus`, `paymentFormSchema`, `paymentTransitionSchema` | repository, provider, `paymentsApi`, mock, seed, adapters, mappers, tests | list, `NewPaymentModal`, `PaymentActions` |

Cross-module reads go through each feature's `data/api.ts` or `domain/types` only (no mock imports).

### 4.2 Shared UI added

| Component | Contract | Notes |
|---|---|---|
| `MoneyField` | DESIGN §9.2 + §4.3 | integer pence, GBP affix, `inputmode="decimal"`, validation, tabular numerals |
| `PricingChainWidget` | DESIGN §9.2 | definition list (not a colour bar), live derived chain, GP %, negatives |
| Reuse | `VersionTimeline`, `EvidenceUploader`, `GateBanner`, `ConfirmDialog`, `DataTable`, `StateChip` | no new variants |

### 4.3 Orchestrator wiring

Routes/permissions; nav Sales (Quotes, Approvals, Orders) + Finance (Payments); `COLLECTIONS` additions; `mock-bootstrap`; schema bump + migration (including the minimal `job` row contract for Phase 6); tracker.

---

## 5. Data

### 5.1 Collections

`cost_line`, `quote`, `quote_version`, `quote_line`, `approval`, `sales_order`, `payment`, plus the minimal `job` row created by G4.

- CostLine: quoteVersionId, elementKey (one of the 13), description, amountPence.
- Quote: id, tenantId, projectId, designVersionId, state (`active|archived`), currentVersionId.
- QuoteVersion: id, quoteId, number, status (`draft|issued|approved|rejected|expired|withdrawn|superseded|archived`), totals derived, validUntil, terms, snapshotJson, timestamps.
- QuoteLine: quoteVersionId, designUnitId, decorId, cabinetId, quantity, unitPricePence (derived from cost + chain), notes.
- Approval: id, quoteVersionId, designVersionId, snapshotJson (frozen), evidenceAssetId, approvedBy, approvedAt; unique per quote version.
- SalesOrder: id, approvalId, status (`open|completed|cancelled`), jobId nullable, timestamps.
- Payment: id, tenantId, jobId, type (`deposit|stage|final`), amountPence, currency, status, dueDate, paidAt, method, reference, timestamps.
- Job (minimal): id, tenantId, contractValuePence, currency, customerId, propertyId, surveyId, designVersionId, status (`created`), timestamps — Phase 6 extends.

### 5.2 Seed

- 10 quotes across projects: draft with no lines (G2 blocked fixture), draft complete, issued, approved (frozen), rejected, expired, withdrawn, superseded pair, archived.
- Cost lines covering all 13 elements for one builder quote; a zero-cost and a negative-adjustment case.
- Approvals: one approved with evidence, one pending readiness (evidence missing), one with deposit unsatisfied.
- Orders: one open with deposit satisfied (G4 enabled), one open with deposit pending (blocked), one completed with a job id.
- Payments: deposit paid, deposit pending, stage paid, final refunded.
- Evidence asset fixture (metadata + placeholder), no fabricated documents.
- Deterministic ids/dates; money integers only.

### 5.3 Mock behaviour

- Recompute: all 13 elements summed; chain identities hold; totals derived on read; no stored float.
- G2 on issue: missing lines, missing terms, or design version not `issued` → `gate_blocked` with reasons; issuing Vn supersedes Vn−1.
- Edit on issued/approved → `state_conflict`; withdraw/expire leave immutable; expiry evaluated against validity date.
- G3: approval without evidence → `validation`; second approval on the same quote version → idempotent return (no duplicate); the atomic step sets quote + design approved and writes two audit events.
- Deposit: `POST /approvals/:id/deposit-satisfied` requires a paid deposit payment; sets the timestamp + FK atomically; refund does not unset unless the Owner override path is used (audited).
- G4: create job requires approved quote, evidence present, deposit satisfied; `Idempotency-Key` replay returns the same job; missing precondition → `gate_blocked` with the checklist.
- Payments: mark paid only from `pending`; refund only from `paid`; cancel only from `pending`; every transition audited with amounts.

### 5.4 Tests

- Domain: costing 13 elements, chain identities, GP/margin, money formatting, versioning, G2/G3/G4 preconditions.
- Mock: version lifecycle, atomic approval, idempotency, deposit/refund rules, payment transitions, snapshot immutability.
- Component: builder totals update, gate panel reasons, deposit action state, create-job checklist.
- E2E: quote → issue (blocked then success) → approval with evidence → deposit → order → job (twice, one job); withdrawal; refund after deposit does not unset; frozen version rejects edits.

---

## 6. Design contract

- **Quote builder (Editor pattern):** line editor + cost panel + pricing chain + terms, sticky total summary, save state visible; one primary action (Issue) when legal; frozen versions render read-only with a lock label; new edits create a version.
- **Money:** integer pence underneath, GBP `£12,480.00`, true minus for negatives, tabular numerals, no float arithmetic in the UI; derived totals labelled "Derived" with the source chain (DESIGN §10.3).
- **Pricing chain:** definition list with cost → mark-up → discount → VAT → total → GP %; each row labelled, no colour-only meaning; discount authority (Q16) not invented — if the user exceeds it, the mock returns a permission error and the UI explains.
- **Approvals:** frozen snapshot viewer is read-only; evidence shows as a file row/preview; readiness flags use text + icon; "Mark deposit satisfied" is the one primary action for Accounts.
- **Orders:** G4 checklist shows each precondition (approved ✓ evidence ✓ deposit ✓) with the unblocking link; disabled state is accompanied by an explanation, never a dead button.
- **Payments:** status chips from the single state map; destructive/irreversible transitions (refund) require confirmation with amount + consequence.
- **A11y:** money inputs labelled with currency and hint, errors inline, tables sortable and keyboard navigable, 200 % zoom, dark/high contrast.

---

## 7. Work waves

| Wave | Agent | Exclusive paths | Gate |
|---|---|---|---|
| 0 (serial) | orchestrator | interfaces (four modules' types/repository/api), costing/pricing contracts, G4 job bridge, wiring list | `pnpm check` |
| 1 (parallel, 4) | data-agent per module | `modules/{quotes,approvals,orders,payments}/{domain,data}/**` | mock + domain tests |
| 2 (parallel, 4) | ui-agent per module | that module's `presentation/**` + its routes | page smoke + component tests |
| 2 (parallel, 1) | shared-ui-agent | `MoneyField`, `PricingChainWidget` in `src/shared/presentation/ui/**` | component tests |
| 3 (serial) | orchestrator | wiring (routes/nav/collections/bootstrap/schema+migration/job bridge/tracker) | check/lint/arch:check |
| 4 (parallel) | gate-runner + boundary-reviewer | read-only | full gate + boundary report |
| 5 | orchestrator | Rule 3 matrix on 8 routes + money edge cases, fixes, commits | post-fix screenshots |

---

## 8. Done when

- [ ] Quote list/detail show versions with contiguous numbering and correct statuses; issuing supersedes the previous version; withdraw leaves the row immutable.
- [ ] Quote builder recomputes 13 cost elements and the pricing chain live; totals are derived (no stored float), GP % correct; preview does not persist.
- [ ] G2: issuing without lines, terms or an issued design version is blocked with named reasons; it succeeds when all pass.
- [ ] Approval: evidence is mandatory; approval is atomic (quote + design approved + snapshot + two audits); repeating the call is idempotent; snapshot is frozen.
- [ ] Deposit: Accounts can satisfy the deposit only with a paid payment; the timestamp is set with the payment FK; a later refund does not unset it (override audited).
- [ ] G4: Create job is enabled only with approved quote + evidence + satisfied deposit; blocked state lists the reasons; double-submit with the same key creates one job.
- [ ] Payments: mark paid / cancel / refund respect the machine; every transition audited; list filters work.
- [ ] Money displays integer pence as GBP everywhere, no float artefacts, negatives use a true minus, tabular numerals in every table.
- [ ] `arch:check` 0; no mock/adapter imports in presentation; no business rules in `.svelte`; no Svelte 4 syntax; UUIDs + deterministic seeds.
- [ ] Unit + e2e suites pass; browser matrix on all eight routes + builder at 768/1280/1920 (320/390 for lists), dark, high contrast, 200 %, keyboard, zero console errors.
- [ ] Full pnpm gate green; committed and pushed to `main`; phase status flipped only after the gate.

---

## 9. Open questions (report, never guess)

1. **Q16 discount authority threshold** — undefined; the UI cannot enforce a limit. Default: no threshold in mock; any discount above 0 requires `quote.approve` and is audited. Confirm the real rule.
2. **Q19 regions, currencies, VAT rates** — schema carries `currency`; GBP/VAT 20 % is used as the seed default only. Confirm launch regions/rates.
3. **13 cost elements** — Part 7 §1 names the elements but the exact keys/labels must be copied from the spec table; any element not named there is reported, not invented.
4. **Pricing chain rounding** — whether mark-up/discount/VAT round at each step or only at the end is a money rule. Default: integer pence at each derived line, totals recomputed; confirm against Part 7 §2.
5. **Quote validity period** — how `expired` is triggered (date vs days) and who sets it. Default: `validUntil` date from the form; expiry evaluated on read.
6. **Approval evidence types/limits** — allowed MIME types and size caps are not specified. Default: PDF/PNG/JPEG, 20 MB, one asset; confirm.
7. **Deposit amount rule** — percentage vs fixed is not defined. Default: the payment row's amount drives satisfaction; no derived percentage.
8. **Payment types/methods** — `deposit|stage|final` is implied; method enumeration is unspecified. Default: `bank_transfer|card|cash|other`.
9. **Job creation payload** — Part 10 §13 defines the endpoint and FKs; the full job row is Phase 6. Confirm the minimal row fields this phase may create.
10. **Order creation trigger** — whether an order is auto-created on approval or explicitly by Sales is not fixed. Default: explicit "Create order" from the approval detail, audited.
