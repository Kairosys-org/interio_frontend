# Phase 4 — Design studio and public viewer

> **Status:** not started · **Depends on:** phases 1–3 · **Unlocks:** phase 5
> **Spec map:** Part 12 Phase 2 (design half) · Part 11 §8 step 4
> **Read with:** `DESIGN.md`, `spec.md` Parts 4 §3, 5 §4.13, 10 §9, 11 §4.4, and Part 11 §7 (exclusions).

## 1. Scope

**Ships**

- Design list per project, design detail with version timeline (V1…Vn, status, frozen badge).
- Editor shell: catalog palette (left), 2D canvas + three.js 3D view (centre), property inspector (right), read-only survey strip (bottom); collapsible panels, visible save state.
- Layout suggestions (advisory only), renders upload/gallery, dimension snapshot compare.
- Share links for `issued`/`approved` versions (create, copy, revoke) with the validity copy.
- Public viewer `/s/:token`: full-bleed 3D, version badge, read-only banner, no chrome, dead-link screen.
- Shared modules owned here: `VersionTimeline` (reused by phase 5 quotes).

**Not in this phase:** pricing/quotes (phase 5), engineering/parts (phase 6), any mobile design UI, any second 3D renderer.

## 2. Requirements

| Group | Covered here |
|---|---|
| Rules | R1, R3, R4, R8 |
| Requirements | S10–S13, S36, S37 |
| Gates | G1 |
| Tests | FT-M4-01…05, E2E-03/E2E-06 (design chain), PERF route splitting, C-02 |

## 3. Routes and pages

| Route | Permission | Primary action |
|---|---|---|
| `/designs` | `design.view` | New design |
| `/designs/:id` | `design.view` | New version |
| `/designs/:id/versions/:vid/edit` | `design.update` | Save draft / Issue version |
| `/designs/:id/versions/:vid` | `design.view` | Create share link |
| `/s/:token` | public, no auth | none (view only) |

## 4. Modules and shared components

```text
src/modules/designs/      domain (version chain, payload snapshot, suggestion rules),
                          data, presentation
  pages/                  DesignListPage, DesignDetailPage, DesignEditorPage, VersionPreviewPage
  components/             VersionTimeline, CataloguePalette, DesignCanvas2D, DesignCanvas3D,
                          PropertyInspector, SurveyStrip, SuggestionCards, RenderGallery, ShareLinkPanel
src/modules/public-viewer/ data/public-api + adapters, presentation PublicViewerPage, DeadLinkPage
```

Heavy editor and three.js load only on the editor/viewer routes (route-level code splitting); neither is in the shell bundle.

## 5. Data

| Endpoint | Use |
|---|---|
| `GET/POST /projects/:id/designs`, `GET /designs/:id` | design header |
| `POST /designs/:id/versions`, `GET/PATCH /designs/versions/:vid` | versions (draft-only PATCH) |
| `POST /designs/versions/:vid/transition` | issue (G1) / approve / reject / supersede / archive |
| `GET /designs/versions/:vid/context` | read-only survey snapshot |
| `/designs/versions/:vid/assets`, `GET …/render` | renders |
| `POST /designs/versions/:vid/layout-suggestions` | suggestions (nothing persisted) |
| `GET/POST /designs/versions/:vid/share-links`, `DELETE …/:lid` | share links |
| `GET /share/:token` | public snapshot |

Mock seeds: 2 designs with V1 issued and V2 draft, one approved version, a superseded version with a dead share link, room dimensions snapshot, a few placed units.

## 6. Design contract

- Editor pattern per DESIGN §10.2: three panels + bottom survey strip; panels collapse to sheets below `lg`; canvas keeps aspect ratio and never causes page scroll.
- Canvas is data-driven; missing render shows a labelled placeholder, never a fake image.
- Survey data is read-only everywhere in the editor (no edit affordance, no hidden write path).
- Frozen versions show lock + “Frozen”; issue/approve actions appear only when G1 is satisfied.
- Public viewer: full-bleed, no nav, version badge, permanent “View only. This design cannot be changed.” banner; dead link explains and offers nothing else.
- Share-link panel copies the rule verbatim: stops when a newer version is issued or the link is revoked.
- Motion: panel/sheet 300 ms, no page-load choreography; 3D interaction respects reduced motion where applicable.

## 7. Work waves

| Wave | Agent | Exclusive files | Gate |
|---|---|---|---|
| 1 | design domain | `modules/designs/domain/**` + tests | version chain + suggestion rules |
| 1 | design data | repository/api/mock/seed | G1 + frozen guards |
| 2 | version UI | list/detail/preview, `VersionTimeline`, share links | issue/supersede/revoke flows |
| 2 | editor shell | editor layout, palette, inspector, survey strip | keyboard + panel collapse |
| 3 | 2D canvas | `DesignCanvas2D` | placement parity with manual path |
| 3 | 3D canvas | `DesignCanvas3D` (three.js) | route split + no scroll |
| 3 | public viewer | `modules/public-viewer/**`, `/s/:token` | 404 + no other capability |
| 4 | gates | Playwright editor + viewer, 4 viewports + dark | all gates green |

## 8. Done when

- [ ] Draft-only editing; issued/approved/superseded rows are immutable in the UI and mock facade.
- [ ] G1 blocks issue with a visible reason when the survey is below `submitted`.
- [ ] V(n+1) supersedes V(n), numbers contiguous, never reused.
- [ ] Suggestions never apply themselves and persist nothing.
- [ ] Share link returns a snapshot only; revoke and supersede produce 404; every access is audited (mock mirror).
- [ ] Public viewer works one-handed on a phone with no account and no app chrome.
- [ ] Editor/viewer code is split out of the shell bundle; LCP budget respected.

## 9. Open questions

B2 (tenant logo/branding in the public viewer), B3 (branding envelope). Q14 is closed: three.js on web, iPhone supplies measurements.
