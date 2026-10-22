# Phase 2 — Survey: web review, mobile capture, offline sync

> **Status:** not started · created 2026-10-22
> **Depends on:** phase-1 · **Unlocks:** 3–7 (Design consumes G1/G8; Catalogue is independent after 0/1)
> **Spec map:** `spec.md` Part 12 §1 "1c — Survey assignment + web", "1d — Survey mobile", "1e — Survey governance"; Part 9 in full (field-level capture, §13 offline, §14 checklist); Part 11 §4.3 + §5; Part 10 §7, §8, §24; Part 5 `survey_*` + `asset` entities; Part 4 §2 (survey machine) and §12 (asset upload); gate **G8**; Part 13 FT-M3-01…05, C-02, C-07.
> **Read with:** `spec.md` Part 9 in full, Part 10 §7–§8 + §24, Part 11 §4.3 + §5, Part 4 §2 + §12, Part 5 `survey_room`/`survey_wall`/`survey_opening`/`survey_utility`/`survey_obstacle`/`survey_measurement`/`survey_note`/`asset`, Part 13 §3 (M3); `DESIGN.md` §1.4 (mobile instrument), §3.7 + Appendix B, §5.5, §9.2 (`DimensionField`, `ChecklistDrawer`, `EvidenceUploader`, `SyncStatusChip`), §10.2, §11, §12, §13.4 (offline/conflict copy), §15; `ui-ux.md` §6–§7, §9, §13, §16–§17; `standards/architecture.md` §3–§4, §10, §13, §20–§22; `testing/ui-ux-tester.md`.
> **DESIGN.md blocker:** Draft V1.0 · awaiting approval (Rule 1.5).
> **Branch:** RULE 0 — `main` only, no PR.
> **Frontend only:** mock-first; `/sync/push` is simulated by the mock backend with idempotency, conflict and failure paths.
> **Prerequisite:** phase-1 `Status: completed`. Phase 3 may start in parallel only after phase 0/1 requirements for the imports shell are met (AGENTS §0.3).

---

## 1. Scope

### Ships

1. **`surveys` module (web review)** — list (project, status, surveyor, appointment; filters + URL state), detail with section nav (Rooms / Walls via rooms / Openings / Utilities / Obstacles / Measurements / Notes / Media), `RoomBoard` (cards per room with counts), submission checklist drawer, verification workstation `/surveys/[id]/verify` (critical-measurement table with value, source, capture, per-row verify with method, bulk verify, survey Verify/Reject with role gating), media page with asset grid by owner + lightbox + desk upload.
2. **`surveys` mobile capture** (`/m/*`) — Projects · Surveys · Sync · Account tabs; assigned projects only (`?scope=mine`); survey hub; room detail accordion (Walls, Openings, Utilities, Obstacles, Measurements, Notes, Photos); wall/opening forms with inline prerequisite checks; **measurement capture** (laser/LiDAR/manual rows, source chip, critical highlight, per-row state); camera/plan capture with an upload queue; submission screen with the server checklist; verification screen for `survey.approve` holders; sync hub (pending ops, upload queue with retry, pull-to-refresh, conflicts); account.
3. **Offline-first capture** — every mobile form writes to a local store first, shows per-row sync state (`queued` / `sending` / `sent` / `conflict`), queues operations with idempotency keys, drains through `POST /sync/push`, pulls with `/sync/pull`, server wins on conflict with a side-by-side re-apply UI. Works fully offline (verified in the browser with network emulation).
4. **`assets` module (shared)** — asset init/complete flow, sha256 verification, exactly-one-owner rule, short-lived signed URL access (mock URL), upload_state machine (`pending → uploading → complete` / `failed`), evidence uploader reused later by approvals, renders and sign-off.
5. **`sync` module** — outbox model, idempotency keys, retry policy, conflict list, pending counters, sync status chip data.
6. **G8 enforcement in the UI and in the mock** — verify/reject transitions blocked while manufacturing-critical measurements are unverified; reasons listed in a `GateBanner`; verification requires a method.
7. **Shared UI** additions in §4.2.
8. **Audit**: survey transitions, reopen, verification, asset init/complete, share-view-free; every state change shows in the audit tab.

### Not in this phase

- Design studio, share links, public viewer (`/s/:token`), quotes, jobs, parts, installations, aftercare, payments, reports, admin, platform console.
- Real device SDKs (LiDAR/laser import is a documented adapter seam, not an implementation); no native app packaging.
- Non-survey offline data; no offline queue for any other module.
- Project QR / scanner tab (permanent exclusion).
- Photo-per-room enforcement and quotas until Q15 is answered (flagged, not guessed).

---

## 2. Requirements

| Requirement | Where it is enforced |
|---|---|
| S1/S2 — assigned surveyor starts from assigned projects | `/m/projects` uses `?scope=mine`; project hub assignment from Phase 1; create survey blocked for unassigned surveyor |
| S3–S6 — room/wall/opening/utility/obstacle/note field sets | Phase 2 forms mirror Part 9 §5–§11 exactly, including messages |
| S7 — media capture and asset integrity | `assets` module: sha256 on complete, one owner, signed URL, `failed` never `complete` |
| S8/S9 — measurement provenance + critical verification | measurement source chip, critical flag from settings, per-row verify with required method, G8 |
| S9/Part 4 §2 — survey machine incl. reopen | mock transitions; editing verified data requires an audited reopen; verification columns cleared |
| N2/N3 — offline and conflict policy | local-first writes, outbox, idempotency, server-wins conflict UI |
| R1 — UUIDs | every survey entity and idempotency key is a UUID; route params validated |
| R3 — history/immutability | submitted/verified survey edits gated; reopen audited; no destructive delete |
| Part 6 §3 — permissions | `survey.view`, `survey.create`, `survey.update`, `survey.approve`, `asset.*`; role gating on verify/reject |
| Part 11 §5 — mobile scope lock | no workshop/installer/commercial/admin screens under `/m`; four tabs only |
| G8 | blocked transition returns `gate_blocked` with `blocking_reasons[]`; UI renders reasons before submit/verify |
| A11y + design gates | DESIGN §12.6, §15.1–§15.4, ui-ux §19 |

---

## 3. Routes and pages

### 3.1 Web (`(dashboard)`)

| Route | Page component | Permissions | Endpoints | Notes |
|---|---|---|---|---|
| `/surveys` | `surveys/presentation/pages/SurveysListPage.svelte` | `survey.view` | `GET /surveys`, `POST /projects/:id/surveys` | project/status/surveyor/appointment filters; new survey (project picker = assigned when Surveyor) |
| `/surveys/[id]` | `SurveyDetailPage.svelte` | `survey.view` | `GET /surveys/:id`, children, `GET /surveys/:id/checklist` | header status chip, section nav, RoomBoard, checklist drawer |
| `/surveys/[id]/verify` | `SurveyVerifyPage.svelte` | `survey.view` + approve ability for actions | `GET /surveys/:id/measurements/critical`, `POST /survey-measurements/:id/verify`, `POST /surveys/:id/transition` | G8 workstation, bulk verify, verify/reject |
| `/surveys/[id]/media` | `SurveyMediaPage.svelte` | `survey.view` | `GET /assets`, `POST /assets`, `PATCH /assets/:id` | grid by owner, lightbox, desk upload |

### 3.2 Mobile (`/m`, client-only shell: `+layout.ts` with `ssr = false`)

| Route | Page component | Endpoints | Notes |
|---|---|---|---|
| `/m/login` | `mobile/pages/MobileLoginPage.svelte` | `/auth/login`, `/auth/mfa/verify` | offline unlock of stored session; biometric unavailable on web → flag |
| `/m/projects` | `MobileProjectsPage.svelte` | `GET /projects?scope=mine` | cards; empty "No projects assigned" |
| `/m/projects/[id]` | `MobileProjectPage.svelte` | `GET /projects/:id/summary`, `/projects/:id/surveys` | summary + surveys + new survey |
| `/m/surveys` | `MobileSurveysPage.svelte` | `GET /surveys?scope=mine`, `/surveys/:id/progress` | resume-first; offline badge |
| `/m/surveys/[id]` | `MobileSurveyHubPage.svelte` | `GET /surveys/:id` | section grid |
| `/m/surveys/[id]/rooms` | `MobileRoomsPage.svelte` | `GET /surveys/:id/rooms` | room cards |
| `/m/surveys/[id]/rooms/[rid]` | `MobileRoomPage.svelte` | room children | accordion: walls, openings, utilities, obstacles, measurements, notes, photos |
| `/m/surveys/[id]/rooms/[rid]/walls/[wid]` | `MobileWallPage.svelte` | `GET/PATCH /survey-walls/:id` | length/height/condition + linked-opening warning |
| `/m/surveys/[id]/openings/[oid]` | `MobileOpeningPage.svelte` | `GET/PATCH /survey-openings/:id` | type, dims, sill, swing, wall link, unattached flag |
| `/m/surveys/[id]/measurements` | `MobileMeasurementsPage.svelte` | `GET/POST/PATCH /surveys/:id/measurements`, `/measurements/critical` | **core screen**: capture rows, source chip, critical highlight, verify |
| `/m/surveys/[id]/media` | `MobileMediaPage.svelte` | `GET/POST /assets`, `/sync/asset-state` | capture → pending → upload queue |
| `/m/surveys/[id]/submit` | `MobileSubmitPage.svelte` | `GET /surveys/:id/checklist`, `POST /surveys/:id/transition` | checklist + submit |
| `/m/surveys/[id]/verify` | `MobileVerifyPage.svelte` | critical list + verify | only for `survey.approve` holders |
| `/m/sync` | `MobileSyncPage.svelte` | `/sync/pending`, `/sync/push`, `/sync/pull` | counters, queue, retry, conflicts |
| `/m/account` | `MobileAccountPage.svelte` | `GET /auth/me` | profile, session, logout |

Mobile layout: bottom tabs Projects · Surveys · Sync · Account, sync chip always visible, offline banner, sticky action bar above safe area, `100dvh`, 16 px minimum body.

---

## 4. Modules and shared components

### 4.1 Modules

| Module | Domain | Data | Presentation |
|---|---|---|---|
| `surveys` | survey tree types, `SurveyListParams`, inputs, `surveyFormSchema`, `roomFormSchema`, `wallFormSchema`, `openingFormSchema`, `utilityFormSchema`, `obstacleFormSchema`, `measurementFormSchema`, `noteFormSchema`, `submitChecklistSchema`, `verifyMeasurementSchema`; prerequisite rules in `domain/rules.ts` | repository, provider, `surveysApi`, mock, seed, adapters, mappers, **`data/offline/{store,outbox,ids}.ts`**, tests | web pages + `mobile/pages/*` + components (`RoomBoard`, `SectionNav`, `MeasurementRow`, `CriticalBadge`, `ChecklistDrawer` usage, `MediaGrid`) |
| `assets` | `Asset`, `AssetOwner`, `uploadState`, `assetFormSchema`, sha256 + MIME/size validation | repository, provider, `assetsApi`, mock, seed, adapters, mappers, tests | `EvidenceUploader` usage, `AssetGrid`, `Lightbox`, `UploadQueue` |
| `sync` | `SyncOperation`, `SyncState`, `Conflict`, `syncResultSchema` | repository (outbox), `syncApi`, mock transport, tests | `SyncStatusChip` usage, sync page sections, conflict sheet |

**Offline architecture note (extension, not a standards change):** `standards/architecture.md` defines no offline layer. Offline storage lives only in `surveys/data/offline/*` (browser-only, guarded by `browser`), the outbox in `sync/data/*`, and is invoked by the survey repository provider. Presentation never touches storage or the network; SSR-safe files never import these modules. The `/m` shell is client-rendered (`ssr = false`) because its data source is the browser mock/outbox. This is recorded here so later audits do not read it as a boundary violation.

### 4.2 Shared UI added

| Component | Contract | Notes |
|---|---|---|
| `DimensionField` | DESIGN §9.2 + §4.3 | integer mm, range hint, critical flag, `inputmode="numeric"` |
| `ChecklistDrawer` | DESIGN §9.2 | sheet on mobile, side panel on desktop, blocker count in title |
| `EvidenceUploader` | DESIGN §9.2 | reused by Phase 5/6/7 evidence flows |
| `SyncStatusChip` | DESIGN §9.2 | `aria-live="polite"`, never colour-only |
| `MediaGrid` + `Lightbox` | DESIGN §8.2 | real asset placeholders when no binary; no stock images |
| `OfflineBanner` | DESIGN §13.4 | persistent while offline, copy from the spec |
| `MobileTabBar` | DESIGN §11 | four tabs, safe-area padding |
| `MeasurementRow` (module-local, not shared) | Part 9 §10 | source chip, critical highlight, verify action |

### 4.3 Orchestrator wiring

Routes/permissions for 20 routes; nav entries Surveys (web) + mobile-only shell; `COLLECTIONS` additions; `mock-bootstrap`; schema bump + migration; settings read for critical measurement list; tracker.

---

## 5. Data

### 5.1 Collections

`survey`, `survey_room`, `survey_wall`, `survey_opening`, `survey_utility`, `survey_obstacle`, `survey_measurement`, `survey_note`, `asset`, `sync_operation` (+ local-only outbox store outside the mock DB).

- Survey: id, tenantId, projectId, surveyorId, name, appointmentAt, status, submittedAt, verifiedAt, rejectedReason, timestamps.
- Room: dimensions, ceiling height, notes; Wall: length/height/condition/room; Opening: type, dims, sill, swing, wallId nullable + unattached flag; Utility/Obstacle: type, position, notes.
- Measurement: valueMm, dimension kind, **source** (`laser|lidar|manual|import`), `isCritical`, `verifiedAt`, `verifiedBy`, `method`, capturedAt, room/wall link.
- Asset: owner type + owner id (exactly one), filename, mime, size, sha256, uploadState, signedUrl (mock, short-lived), timestamps.
- Sync operation: idempotency key (UUID), entity, op, payload, state, attempts, lastError, clientTimestamp.

### 5.2 Seed

- One project with 2 surveys: one `in_progress` (5 rooms, 18 measurements incl. 3 critical unverified), one `verified` (complete tree, media metadata). One `submitted` survey awaiting verification, one `rejected` with a reason.
- Rooms include a missing ceiling-height case for the submit-blocked test; an opening not linked to a wall; a measurement with `source=lidar` and a critical unverified row.
- Assets: metadata-only fixtures with a labelled placeholder (no fabricated images); one `failed` upload case; one asset owned by an approval-less entity to prove owner rules.
- Ids `deterministicUuid('survey:n:room:n')` etc.; dates via `demoDays`.

### 5.3 Mock behaviour

- Survey transitions per Part 4 §2: `draft → in_progress → submitted → verified|rejected`; `submitted → verified` blocked by unverified critical measurements (`gate_blocked`, G8); editing a verified survey without reopen → `conflict`; reopen audited and clears verification.
- Submit checklist: rooms present, ceiling height present, ≥1 length+width pair, opening dims, checklist items — each failure named.
- Asset complete with mismatched sha256 → `failed`, never `complete`; second owner on one asset → `conflict`; signed URL access only.
- Sync push: idempotency key replay returns the original result; deliberately conflicting base version returns `conflict` with server vs local values; transient failure retried with backoff.
- Measurements: verify requires `method`; re-editing a verified value clears `verifiedAt/verifiedBy` only after an audited reopen.

### 5.4 Tests

- Domain: every form schema + prerequisite rule (missing ceiling, unlinked opening, invalid dimension range).
- Mock/repository: survey tree CRUD, transitions, G8 block, reopen, asset owner/sha256, sync idempotency/conflict.
- Offline unit tests: outbox ordering, retry, dedupe by idempotency key, offline read from local store, server-wins merge.
- E2E: mobile capture offline → reconnect → sync; critical verify → G8 clears; submit blocked vs success; web verify; media upload; conflict re-apply. Playwright network emulation for offline (camera capture is stubbed — see §9).

---

## 6. Design contract

- **Shells:** web pages use the Phase 0 shell; `/m` uses the mobile shell (no sidebar, bottom tabs, 16 px body minimum, `100dvh`, safe areas, always-visible sync chip, offline banner first-class).
- **Mobile instrument:** one task per screen, large targets (≥44×44), numeric keypads (`inputmode`), sticky action bar, no hover-only affordances, standard gestures only, camera permission requested in context with an explanation.
- **Measurements:** `DimensionField` for every mm value; source chip + critical badge always paired with text; verify actions inline with method selection; tabular numerals; range hints from Part 5.
- **Sync/offline copy:** exactly the DESIGN §13.4 patterns ("You are offline…", "This record changed on the server…"); per-row state chips, never colour alone.
- **Conflict UI:** side-by-side server vs local values, server wins, explicit "Re-apply my change" action, no silent overwrite.
- **Media:** real assets or labelled placeholders; 4:3 survey photos; lazy loading; alt text describing content.
- **A11y:** focus order per screen, drawer focus trap, announcements for sync counts and verification results, no colour-only critical markers, 200 % zoom, dark mode, high contrast.

---

## 7. Work waves

| Wave | Agent | Exclusive paths | Gate |
|---|---|---|---|
| 0 (serial) | orchestrator | interfaces (`surveys`, `assets`, `sync` types/repository/api), offline store contract, wiring patch list | `pnpm check` |
| 1 (parallel, 3) | data-agent per module | `modules/{surveys,assets,sync}/{domain,data}/**` | mock + mapper + offline unit tests |
| 2 (parallel, 2) | mobile-ui-agent | `modules/surveys/presentation/mobile/**`, `src/routes/m/**`, `assets` mobile components | offline/capture e2e |
| 2 (parallel, 2) | web-ui-agent | `modules/surveys/presentation/pages/**` + web components, `src/routes/(dashboard)/surveys/**` | web review e2e |
| 2 (parallel, 1) | shared-ui-agent | `src/shared/presentation/ui/**` (DimensionField, ChecklistDrawer, EvidenceUploader, SyncStatusChip, MediaGrid/Lightbox, OfflineBanner, MobileTabBar) | component tests |
| 3 (serial) | orchestrator | wiring (permissions/routes/nav/collections/bootstrap/schema/migration/settings/tracker) | check/lint/arch:check |
| 4 (parallel) | gate-runner + boundary-reviewer | read-only | full gate + boundary report |
| 5 | orchestrator | Rule 3 matrix (all web + mobile routes, offline, conflict, 5 viewports), fixes, commits | post-fix screenshots |

Commit order: domain/data → offline/outbox → shared UI → mobile pages/routes → web pages/routes → wiring → docs.

---

## 8. Done when

- [ ] A Surveyor can open `/m/projects` (assigned only), open a survey, capture rooms/walls/openings/utilities/obstacles/measurements/notes/media **with the network offline**, see queued chips, reconnect, and watch the outbox drain.
- [ ] Conflict path: a server-side change produces a conflict row, the side-by-side sheet shows both values, server wins, and re-apply works.
- [ ] Submit is blocked with a named reason when a room lacks ceiling height, a length/width pair is missing, an opening has no dims or the checklist is incomplete; it succeeds when all pass.
- [ ] G8: verify is blocked while any manufacturing-critical measurement is unverified, listing each one; per-row and bulk verify with method work; survey verify/reject respects role gating; every transition is audited.
- [ ] Editing verified data without reopen is blocked; reopen is audited and clears verification; re-verification is required.
- [ ] Media: one-owner rule enforced, sha256 mismatch ends `failed`, desk and mobile upload both reach `complete`, grid/lightbox work, no fake imagery.
- [ ] Web review pages show status chip, checklist drawer, room board, critical table and media grid with real mock data.
- [ ] `/m` contains only Projects/Surveys/Sync/Account and no commercial/workshop/admin screen; no project QR or scanner exists.
- [ ] `arch:check` 0; no storage/network access in presentation; no Svelte 4 syntax; offline modules never imported from SSR-safe files.
- [ ] UUIDs everywhere, deterministic seeds, schema version bumped with a migration, idempotency keys stable across reloads.
- [ ] Unit + e2e suites in §5.4 pass; browser matrix (mobile routes at 320/390 plus tablet, web at 768/1280/1920; dark; high contrast; 200 %; keyboard) clean with zero console errors.
- [ ] Full pnpm gate green; committed and pushed to `main`; phase status flipped only after the gate.

---

## 9. Open questions (report, never guess)

1. **Q9 mobile platforms / packaging** — `/m/*` in the web app (DESIGN default) vs native wrapper. Affects biometrics, camera, file system and offline storage; Phase 2 assumes the web shell.
2. **Q10 offline conflict policy** — this plan implements precondition-based, server-wins + re-apply, per Part 9 §13. Needs explicit owner acceptance.
3. **Q7 LiDAR/laser devices and formats** — no SDK/format defined; the capture screen accepts manual and CSV/JSON import through an adapter seam; real device integration is out of scope until answered.
4. **Q15 photo-per-room default and media quotas** — not enforced; no quota UI; raise before enforcing.
5. **Offline storage technology** — architecture says nothing. Default: IndexedDB for captures + outbox, with a typed wrapper in `surveys/data/offline`; localStorage only for the existing mock DB. Confirm.
6. **"Offline-biometric unlock"** (Part 11 §5 `/m/login`) — impossible in a browser without WebAuthn/native. Default: stored-session unlock with a PIN-less resume; flag as a gap.
7. **Camera capture in automated tests** — Playwright cannot use a real camera; default: stub `getUserMedia` in tests and verify the upload queue with a fixture file; real-device check is manual.
8. **Measurement units/decimals** — Part 9 stores integer mm; some laser tools report 0.1 mm. Default: round to integer mm at capture, keep raw text in the note; confirm.
9. **Survey progress percentage** — `/surveys/:id/progress` formula is unspecified. Default: completed required fields / required fields; flagged as derived.
10. **Checklist item set** — Part 9 §14 lists items; any tenant-configurable additions are undefined. Default: the spec list, no configuration.
