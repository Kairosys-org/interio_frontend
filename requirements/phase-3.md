# Phase 3 — Catalogue and materials

> **Status:** not started · **Depends on:** phase 0 (phase 1 for imports shell) · **Unlocks:** phases 4 and 6
> **Spec map:** Part 12 Phase 2 (catalogue/materials half) · Part 11 §8 step 5
> **Read with:** `DESIGN.md`, `spec.md` Parts 8 §1–§2/§8, 10 §10–11, 11 §4.5–4.6.

## 1. Scope

**Ships**

- Cabinet catalogue: list with family filters, create/edit, active toggle.
- Cabinet detail tabs: parameters (min/max/default/allowed values), component rules (`rule_version`, expression, condition, active), preview-engineering playground.
- Cross-cabinet rules list.
- Materials: decor list + detail (edgings, suppliers, attributes, sample asset), edging, suppliers, manufacturers and collections.
- Import extension for `supplier`, `decor`, `price_list` kinds using the phase 1 wizard.
- Shared `DataTable`, `PermissionGate`, `ConfirmDialog`; JSON/expression editors use the mono font token.

**Not in this phase:** design placement (phase 4), engineering runs and parts (phase 6), pricing (phase 5).

## 2. Requirements

| Group | Covered here |
|---|---|
| Rules | R1, R3, R4, R8 |
| Requirements | S14, S15, S22 (rules editor only), S38 (supplier/decor/price-list import) |
| Tests | FT-M5-01…04, E2E-07 (materials half), C-02 |

## 3. Routes and pages

| Route | Permission | Primary action |
|---|---|---|
| `/catalogue/cabinets` | `cabinet.view` | New cabinet |
| `/catalogue/cabinets/:id` | `cabinet.view` | Save cabinet |
| `/catalogue/rules` | `cabinet.view` | New rule |
| `/materials/decor` | `materials.view` | New decor |
| `/materials/decor/:id` | `materials.view` | Save decor |
| `/materials/edging` | `materials.view` | New edging |
| `/materials/suppliers` | `materials.view` or `purchasing.view` | New supplier |
| `/materials/suppliers/:id` | `materials.view` or `purchasing.view` | Save supplier |
| `/materials/manufacturers` | `materials.view` | New manufacturer |

## 4. Modules and shared components

```text
src/modules/catalogue/   domain (parameter bounds, rule expression validation, determinism helpers),
                         data, presentation pages + ParameterEditor, RuleExpressionEditor, PreviewEngineeringPanel
src/modules/materials/   domain (manufacturer → collection → decor → edging/supplier/attribute),
                         data, presentation pages + DecorTabs, EdgingLinker, SupplierLinker, AttributeEditor
src/modules/imports/     extend domain kinds + wizard copy only
```

Rules for the expression editor: pure/deterministic only, no clock/random/external reads; validation before save; `rule_version` immutable once used.

## 5. Data

| Endpoint | Use |
|---|---|
| `/catalog/cabinets`, `/catalog/cabinets/:id`, `/parameters`, `/rules`, `POST …/preview-engineering` | catalogue |
| `/materials/manufacturers`, `/collections`, `/decor`, `/decor/:id/edgings`, `/decor/:id/suppliers`, `/decor/:id/attributes`, `/edging`, `/suppliers` | materials |
| `POST /imports` with kind supplier, decor or price_list; rows; commit | imports |

Mock seeds: 6 cabinets across families, 3 manufacturers, 5 collections, 12 decors (one discontinued, one not customer-visible), edgings, suppliers with one primary per decor, one rule set with a known deterministic output.

## 6. Design contract

- Forms use the single-column form pattern (DESIGN §10.2), 68 rem max, sections, sticky action bar on mobile.
- FK pickers for decor/edging/supplier; never free text where the spec requires a FK.
- `one primary supplier per decor` shown as a radio/flag with a clear error, not a silent overwrite.
- Discontinued and `customer_visible` are visible states with text, not colour alone.
- JSON rule editor: mono font, line numbers optional, validation summary above the field, no syntax-colour-only meaning.
- Tables: search + filters in URL, compact density available, stacked cards below `md`.

## 7. Work waves

| Wave | Agent | Exclusive files | Gate |
|---|---|---|---|
| 1 | catalogue domain | `modules/catalogue/domain/**` + tests | bounds + deterministic preview |
| 1 | materials domain | `modules/materials/domain/**` + tests | uniqueness + FK rules |
| 2 | catalogue UI | cabinet list/detail, parameter + rule editors, preview panel | save + validation |
| 2 | materials UI | decor/edging/supplier/manufacturer pages | tabs + FK pickers |
| 3 | import extension | `modules/imports/**` kinds + copy | new-rows-only still holds |
| 4 | gates | Playwright 4 viewports + dark + 200 % | all gates green |

## 8. Done when

- [ ] Parameter bounds reject out-of-range configs in the form and through the mock facade.
- [ ] Same config + `rule_version` previews byte-identical output twice.
- [ ] Catalogue edits never mutate already-engineered units/parts (mock guard + test).
- [ ] Second primary supplier is rejected with an explained error.
- [ ] No manufacturer-specific columns anywhere; attributes are key/value rows.
- [ ] All three import kinds stage → review → commit with new rows only.
- [ ] DESIGN §15 passes; expression editor keyboard-usable.

## 9. Open questions

Q17 (stock/inventory depth) is explicitly out of phase 1 and does not block this phase. No other open item gates catalogue/materials.
