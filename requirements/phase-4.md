# Phase 4 — Design studio and public viewer

> **Status:** not started · created 2026-10-22
> **Depends on:** phase-1, phase-2, phase-3 · **Unlocks:** 5
> **Spec map:** `spec.md` Part 12 §1 "Phase 2 — Commercial" (design environment S10–S13, S36–S37); Part 11 §4.4 (+ §4.5 placement inputs); Part 10 §9; Part 5 `design`, `design_version`, `design_share_link`; Part 4 §3 (design machine, **G1**); Part 13 FT-M4-01…05, C-02.
> **Read with:** `spec.md` Part 11 §4.4, Part 10 §9, Part 5 design entities, Part 4 §3, Part 8 §1 (placement options), Part 9 §10–§11 (measurements/notes consumed read-only), Part 13 §3 (M4); `DESIGN.md` §1.4 (public viewer), §2.2 (brand surfaces), §3.7 + Appendix B, §9.2 (`VersionTimeline`, `GateBanner`, `StageIndicator`), §10.2 (Editor, Public viewer), §11 (responsive editor/viewer), §12, §13.4 (read-only copy), §14.6 (code-splitting), §15; `ui-ux.md` §5, §8, §11–§12, §15–§16; `standards/architecture.md` §3–§4, §9–§10, §15–§16, §20–§22; `testing/ui-ux-tester.md`.
> **DESIGN.md blocker:** Draft V1.0 · awaiting approval (Rule 1.5). The editor and public viewer are the highest visual-risk surfaces — no implementation before approval.
> **Branch:** RULE 0 — `main` only, no PR.
> **Frontend only:** three.js renders mock/seed design data; no backend, no external design service. Public viewer uses the public (no-session) repository path.
> **Prerequisite:** phase-1/2/3 `Status: completed` (survey ≥ submitted data for G1, catalogue placement options, materials finishes).

---

## 1. Scope

### Ships

1. **`designs` module**
   - `/designs`: list per project, source survey chip, current version, state.
   - `/designs/[id]`: version list with statuses (`VersionTimeline`), New version (Vn+1), issue / approve / reject actions per version, G1 banner while the survey is `< submitted`, frozen state for issued/approved versions.
   - `/designs/[id]/versions/[vid]`: issue preview — render gallery, dimension summary, snapshot compare vs previous version, **ShareLinkButton** (create, copy, revoke) with the validity rule explained (stops when a newer version is issued).
   - `/designs/[id]/versions/[vid]/edit`: editor shell — left `CataloguePalette` (families), centre 2D grid + **3D via three.js**, right `PropertyInspector` (unit config, finish pickers FK → decor, worktop/hardware/appliance selectors), bottom read-only `SurveyStrip` (room dims snapshot), Save draft, Issue, **Suggest** → advisory suggestion cards (accept = normal placement, ignore = gone; never auto-persisted).
2. **Public viewer** `/s/[token]` — full-screen 3D look-around of one issued version, version badge (V-number + issued date), read-only banner, no sidebar/top bar/actions, dead-link screen for unknown/revoked/superseded tokens. No session; no writes.
3. **Public data path** — `designs/data/public-repository.ts`, `public-api.ts`, `adapters/mock.public.repository.ts`, `adapters/public-api.repository.ts` (returns 501 until a backend exists); no session, explicit loading/error/empty states.
4. **Version rules** — contiguous V1…Vn, never reused; issuing Vn supersedes Vn−1 (System); approved versions are terminal (no status change or field update); draft edits only; lock + "Frozen" label in UI.
5. **G1** — issue blocked while the source survey is `< submitted`, with `blocking_reasons[]` shown before the action.
6. **Share links** — create for issued/approved versions only; copy; revoke; superseding a version kills the link (404); every access (200 and 404) writes `share_view` audit.
7. **Suggestions (S36)** — request → suggestion cards → accept/ignore; nothing persists unless the user places a unit manually; no external service.
8. **Shared UI** additions in §4.2.

### Not in this phase

- Quotes/pricing (Phase 5), engineering/parts (Phase 6), real renders (assets are placeholders when no binary exists), site presentation/AR on mobile (Part 9/11 exclusions), external 3D services, second renderer.
- Mobile design UI — none exists (spec exclusion).
- Persistent suggestions, saved layouts beyond the version draft.

---

## 2. Requirements

| Requirement | Where it is enforced |
|---|---|
| S10/S12 — design creation requires `source_survey_id`; survey data read-only | domain type requires source survey; design writes never touch survey collections; attempted writes → `forbidden` in mock |
| S11 — placed units reference catalogue + material FKs, never free text | `Unit` domain type uses `cabinetId`, `decorId`, `edgingId`; inspector uses comboboxes only |
| S13 — versions, freezing, superseding, contiguity | mock version engine + UI lock; PATCH on issued/approved → `state_conflict` |
| G1 | `design_version` transition to `issued` checks survey status ≥ submitted |
| S36 — advisory suggestions | separate request, ephemeral cards, explicit accept/ignore, no persistence |
| S37 — public viewer + share links | public repository/API; issued/approved only; revoke; supersede → 404; `share_view` audit on every access |
| R1 — no usable ids exposed publicly | public DTO contains display captions and geometry only; no raw tenant/entity ids beyond the token |
| R3 — immutability | frozen versions, new version instead of edit, superseded stays frozen |
| Part 6 §3 | `design.view`, `design.create`, `design.update`, `design.share`, `design.approve`; `PermissionGate` on every action |
| Part 11 §1 | detail pages show state chip, gate banner, audit tab |
| Part 11 §7 | no mobile design UI, no second renderer, no project QR |
| Performance | three.js code-split, not in the shell bundle; LCP/INP/CLS budgets (DESIGN §14.6) |

---

## 3. Routes and pages

| Route | Page component | Permissions | Endpoints | Notes |
|---|---|---|---|---|
| `/designs` | `designs/presentation/pages/DesignsListPage.svelte` | `design.view` | `GET /projects/:id/designs` (project-scoped list), `GET /designs/:id` | project + source survey chip + current version |
| `/designs/[id]` | `DesignDetailPage.svelte` | `design.view` | `GET /designs/:id`, `GET /designs/:id/versions`, `POST /designs/:id/versions`, `POST /designs/versions/:vid/transition` | version timeline, G1, issue/approve/reject |
| `/designs/[id]/versions/[vid]` | `DesignVersionPage.svelte` | `design.view` | `GET /designs/versions/:vid`, `GET /assets`, `GET/POST/DELETE /designs/versions/:vid/share-links` | preview, gallery, snapshot compare, share button |
| `/designs/[id]/versions/[vid]/edit` | `DesignEditorPage.svelte` | `design.update` | `GET /designs/versions/:vid`, `GET /catalog/cabinets`, `GET /materials/decor`, `GET /designs/versions/:vid/context`, `POST /designs/versions/:vid/layout-suggestions`, save/issue endpoints | editor shell (2D + 3D), save state visible |
| `/s/[token]` | `modules/designs/presentation/pages/PublicDesignViewerPage.svelte` | **public** (no session) | `GET /share/:token` | full-bleed 3D, version badge, read-only banner, dead-link state |

**Route conflict (reported):** architecture §2 places external pages under `routes/public/`; the spec fixes the public URL at `/s/:token`. Precedence rank 3 (spec) wins → implement `/s/[token]` (optionally inside a `(public)` group so no layout leaks). See §9.

**Route guard:** `[vid]`/`[id]` validated as UUIDs; `/s/[token]` validates token shape; session guard must **not** redirect `/s/*`.

---

## 4. Modules and shared components

### 4.1 Module

```text
modules/designs/
  domain/types.ts            Design, DesignVersion, UnitPlacement, DesignContext, ShareLink, Suggestion,
                             DesignListParams, Create/Update inputs, public snapshot types
  domain/validations.ts      designFormSchema, unitFormSchema, shareLinkSchema, suggestionSchema
  domain/versioning.ts       pure helpers: nextVersionNumber, canTransition, frozen guards
  domain/rules.ts            G1 precondition + placement referential rules (pure)
  data/repository.ts         DesignsRepository (private, session)
  data/public-repository.ts  PublicDesignsRepository (token only)
  data/repository-provider.ts getDesignsRepository()
  data/api.ts                designsApi
  data/public-api.ts         publicDesignsApi
  data/mock.ts               designs + versions + share links + suggestions on mock-backend
  data/seed.ts               deterministic designs, versions, links, renders
  data/adapters/{mock,api}.repository.ts
  data/adapters/{mock,public}-api.repository.ts
  data/mappers/design.mapper.ts
  data/__tests__/*.test.ts
  presentation/pages/*       {DesignsListPage, DesignDetailPage, DesignVersionPage,
                             DesignEditorPage, PublicDesignViewerPage}
  presentation/editor/*      CataloguePalette, DesignCanvas2D, DesignCanvas3D, PropertyInspector,
                             SurveyStrip, SaveBar, SuggestionCards
  presentation/components/*  VersionRow, ShareLinkButton, SnapshotCompare, RenderGallery
```

### 4.2 Shared UI added

| Component | Contract | Notes |
|---|---|---|
| `VersionTimeline` | DESIGN §9.2 | current/frozen/superseded/approved; lock icon + "Frozen" text; expandable diff entry point |
| `GateBanner` | reuse (Phase 1) | G1 reasons before the action |
| `EmptyState`/`AsyncState` | reuse | public viewer loading/error/dead-link |

Module-local only: palettes, canvas, inspector, suggestion cards, share button. No generic "editor" primitive is shared until a second feature needs one.

### 4.3 Orchestrator wiring

Routes/permissions (including the **public** route exception in `ROUTE_PERMISSIONS`/guard), nav Design section, `COLLECTIONS` additions, `mock-bootstrap`, schema bump + migration, audit read only (audit module in Phase 8), tracker.

### 4.4 3D rules

- `three.js` imported dynamically inside the editor/viewer island only; never in the shell bundle; `ssr = false` for the editor route.
- WebGL unavailable → 2D grid + explicit message ("3D is not available on this device; you can still edit in 2D"), never a fake render.
- Reduced motion → no auto-rotation, no camera tweening; camera moves only on user input; keyboard camera controls documented and focusable; a text summary of the room/units is always available.
- Canvas is not the only source of truth: dimensions, units and finishes are readable in text (`SurveyStrip`, inspector lists).

### 4.5 Public viewer isolation

- No `authApi`, no session bootstrap, no tenant navigation; the public repository is the only data path.
- The response is a snapshot (captions, geometry, finishes, version badge); no buttons except the browser's own controls; no download/print unless Part 11 grants it.
- Dead-link screen: short message, nothing else, no retry that implies the link may come back.
- Every access — success or not — is audited by the mock (`share_view`).

---

## 5. Data

### 5.1 Collections

`design`, `design_version`, `design_share_link`, plus references to `survey*` (read-only), `cabinet_catalog`, `decor`, `edging`.

- Design: id, tenantId, projectId, sourceSurveyId, name, state (`active|archived`), currentVersionId, timestamps.
- DesignVersion: id, designId, number (contiguous), status (`draft|issued|approved|rejected|superseded|archived`), placements[], snapshotJson, issuedAt, approvedAt, frozenBy, timestamps.
- ShareLink: id, designVersionId, token (opaque, not a UUID route id — see §9), createdAt, createdBy, revokedAt, accessCount.
- Suggestions are **not** a collection: request/response only, never persisted.

### 5.2 Seed

- 6 designs across 4 projects: one with V1 issued + V2 draft; one with V1 superseded + V2 approved (frozen); one with a rejected version; one whose source survey is `draft` (G1 blocked fixture); one archived; one with no versions.
- Share links: one valid, one revoked, one superseded (all three dead-link states), one for a draft version (creation must be refused).
- Renders: asset metadata + placeholder cards (no fabricated images).
- Units reference seeded cabinet families/decor; room dimensions match the seeded survey (survey fixtures reused, not duplicated).
- Ids `deterministicUuid('design:n:version:n')`; dates via demo clock.

### 5.3 Mock behaviour (server rules mirrored)

- Create design without `sourceSurveyId` → `validation`.
- Issue: survey status must be ≥ `submitted` (G1); no lines? (not applicable) → allowed; issuing V2 supersedes V1 and freezes it; V1 keeps its number forever.
- Any PATCH on issued/approved → `state_conflict`; approve on non-issued → `conflict`; approve is terminal.
- Share link create on draft/rejected/superseded → `conflict`; revoke idempotent; `GET /share/:token` returns the snapshot or 404 for unknown/revoked/superseded; every call audits `share_view` (target type, token hash, result).
- Suggestions: deterministic given the same context (seeded rng), returned only, never stored; accepting places a normal unit client-side and saves as a draft edit.

### 5.4 Tests

- Domain: version numbering, transition table, frozen guards, G1 rule, share-link eligibility.
- Mock: version lifecycle, supersede, terminal approve, share link lifecycle + audit on 200/404, suggestion non-persistence, referential placement validation.
- Component: version timeline states, gate banner, inspector FK pickers.
- E2E: create design → draft → issue blocked by G1 → verify survey (fixture) → issue → new version → approve (frozen); share link create/copy/revoke; public viewer renders and dead-links; suggestion accept/ignore leaves no persisted suggestion. Public route tested with no session and no sidebar.

---

## 6. Design contract

- **Editor pattern (DESIGN §10.2):** left catalogue palette, centre 2D/3D canvas, right property inspector, bottom read-only survey strip; collapsible panels; save state always visible; one primary action ("Issue version") when legal, otherwise the next legal action.
- **Canvas:** full-bleed inside the content area, never causes page scroll; panels become sheets below `lg`; canvas keeps aspect ratio; no autoplay camera; reduced motion respected; visible 2D/3D toggle; keyboard operable; text alternative.
- **Read-only:** issued/approved versions show lock + "Frozen"; preview is read-only with an explicit banner; editing creates a new version.
- **Public viewer:** highest brand strength, tenant logo + accent allowed, full-bleed 3D, no app chrome, version badge, read-only banner ("View only. This design cannot be changed."), dead-link screen with nothing else; must work one-handed on a phone; no horizontal scroll.
- **Gates:** G1 reasons visible before Issue, with a link to the survey verification surface.
- **Numbers:** dimensions integer mm with thin space; dates `22 Oct 2026`; no UUIDs in UI; version labels "V1", "V2".
- **A11y:** canvas has an accessible name and a text summary; palette/inspector keyboard complete; sheet focus traps; 200 % zoom; dark/high contrast; no colour-only status.

---

## 7. Work waves

| Wave | Agent | Exclusive paths | Gate |
|---|---|---|---|
| 0 (serial) | orchestrator | interfaces (`designs` private/public types, repository, api), version/share contracts, wiring patch list | `pnpm check` |
| 1 (parallel, 2) | designs-data-agent | `modules/designs/{domain,data}/**` | mock + domain tests |
| 2 (parallel, 1) | editor-agent | `modules/designs/presentation/editor/**`, editor route + `ssr=false` layout | canvas smoke, 2D/3D toggle, reduced motion |
| 2 (parallel, 1) | version-ui-agent | `modules/designs/presentation/{pages,components}/**` (list/detail/version), routes | version lifecycle e2e |
| 2 (parallel, 1) | public-viewer-agent | `presentation/pages/PublicDesignViewerPage.svelte`, `/s/[token]` route, public components | public route e2e + dead links |
| 2 (parallel, 1) | shared-ui-agent | `VersionTimeline` in `src/shared/presentation/ui/**` | component tests |
| 3 (serial) | orchestrator | wiring (routes incl. public exception, nav, collections, bootstrap, schema/migration, tracker) | check/lint/arch:check |
| 4 (parallel) | gate-runner + boundary-reviewer | read-only | full gate + boundary report |
| 5 | orchestrator | Rule 3 matrix (editor at 768/1280/1920, public viewer at 320–1920, dark, 200 %, keyboard), performance check, fixes, commits | post-fix screenshots |

---

## 8. Done when

- [ ] Design list and detail show real mock versions; V1…Vn numbering is contiguous; issuing Vn supersedes Vn−1; approved versions are frozen with a lock label and reject any edit.
- [ ] G1: issuing while the source survey is `draft`/`in_progress` is blocked with a reason and a link; after the survey is `submitted`, issuing succeeds.
- [ ] Editor: palette, 2D canvas, 3D canvas (three.js, dynamically imported), inspector with FK-only catalogue/decor pickers, survey strip, save draft, issue; WebGL-off fallback works; reduced motion honoured; keyboard operable; text summary available.
- [ ] Suggestion request returns cards; accept places a unit normally; ignore removes it; nothing suggestion-related is persisted or auto-applied.
- [ ] Share links: create only for issued/approved, copy, revoke; issuing a newer version 404s the old link; every viewer access (200 and 404) writes `share_view`.
- [ ] `/s/[token]` renders with **no session and no chrome**, shows version badge + read-only banner, works at 320 px and 1920 px, and shows the dead-link screen for unknown/revoked/superseded tokens.
- [ ] No mobile design UI, no second renderer, no project QR; no raw ids in the public DTO.
- [ ] `arch:check` 0; three.js not in the shell bundle; route-level code splitting verified; no Svelte 4 syntax; UUIDs and deterministic seeds.
- [ ] Unit + e2e suites pass; browser matrix (editor, viewer, list, detail) light/dark/high contrast/200 %/keyboard clean with zero console errors.
- [ ] Full pnpm gate green; committed and pushed to `main`; phase status flipped only after the gate.

---

## 9. Open questions (report, never guess)

1. **`/s/[token]` vs `routes/public/`** — architecture §2 fixes a `routes/public/` folder; the spec fixes `/s/:token`. Precedence resolution used here: spec URL wins, route may live in a `(public)` group. Confirm.
2. **Share token format** — Part 10 names `{token, url}` but not its shape. Default: opaque 32-byte URL-safe string (not a UUID, since it is a bearer credential); hashed in audit.
3. **`layout-suggestions` algorithm** — S36 says advisory catalogue fits + standard runs; the rule set is undefined. Default: deterministic mock suggestions derived from room dims + catalogue bounds, clearly labelled as advisory; the real rule lives server-side later.
4. **3D data source** — Part 9 captures measurements/walls/openings but no mesh format; the editor's 3D view is generated from the survey tree. Confirm no external mesh/scan import exists.
5. **Render/gallery assets** — no render pipeline is specified; missing renders show labelled placeholders. Confirm who generates renders and in what format/size.
6. **Share-link creation states** — Part 11 §4.4 says "issued/approved only"; whether an approved-superseded version keeps links is covered by the supersede rule. Confirm.
7. **Public viewer interactions** — no download/print is mentioned; this plan exposes none. Confirm read-only means no export.
8. **`design.update` vs version permissions** — whether issuing/approving needs separate codes is defined in Part 6 §3; this plan uses `design.update` for editing and `design.approve` for approve/reject. Confirm exact codes.
9. **Editor on tablet** — supported (768 px) but panels collapse to sheets; confirm tablet editing is in scope (spec says desktop browser, tablet-OK).
