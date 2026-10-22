# Phase 2 — Survey: web review, mobile capture, offline sync

> **Status:** not started · **Depends on:** phase 1 · **Unlocks:** phases 3–7
> **Spec map:** Part 12 Phase 1c + 1d + 1e · Part 11 §8 step 3
> **Read with:** `DESIGN.md`, `spec.md` Parts 4 §2, 5 §4.4–4.12, 9, 10 §7–8/§24, 11 §4.3/§5.

## 1. Scope

**Ships**

- Web: survey list, survey detail, verification workstation (G8), media gallery.
- Mobile shell: bottom tabs Projects · Surveys · Sync · Account; assigned-project entry; no QR, no scanner tab.
- Mobile capture: survey creation/naming, rooms, walls, openings, utilities, obstacles, measurements, notes, media, submit checklist.
- Offline store, operation queue, asset queue, conflict UI, sync hub; queue survives restart; per-row sync chips.
- Shared modules owned here: `DimensionField`, `ChecklistDrawer`, `SyncStatusChip`; generic asset upload plumbing reused by `EvidenceUploader` in phase 5.
- Shared `StateChip` survey statuses, `GateBanner` for G8, `DataTable` survey list.

**Not in this phase:** surveyor assignment admin (phase 1), design reading survey data (phase 4), workshop scanning on mobile (never — Part 11 §7).

## 2. Requirements

| Group | Covered here |
|---|---|
| Rules | R1, R2, R3, R4, R8 |
| Requirements | S1–S9 |
| Gates | G8 |
| NFRs | N2, N3, N7 |
| Tests | FT-M3-01…05, TEN-10, E2E-04 (UI half), C-02 |

## 3. Routes and pages

| Route | Permission | Primary action |
|---|---|---|
| `/surveys` | `survey.view` | New survey |
| `/surveys/:id` | `survey.view` | Submit / next transition |
| `/surveys/:id/verify` | `survey.view` + `survey.approve` | Verify survey |
| `/surveys/:id/media` | `survey.view` | Upload media |
| `/m/login` | public | Sign in |
| `/m/projects` | authenticated (Surveyor) | Open project |
| `/m/projects/:id` | `survey.view` (assigned) | New survey |
| `/m/surveys` | `survey.view` (own) | Resume survey |
| `/m/surveys/:id` | `survey.view` | Continue capture |
| `/m/surveys/:id/rooms` | `survey.update` | Add room |
| `/m/surveys/:id/rooms/:rid` | `survey.update` | Add measurement |
| `/m/surveys/:id/rooms/:rid/walls/:wid` | `survey.update` | Save wall |
| `/m/surveys/:id/openings/:oid` | `survey.update` | Save opening |
| `/m/surveys/:id/measurements` | `survey.update` | Add measurement |
| `/m/surveys/:id/media` | `survey.update` | Capture photo |
| `/m/surveys/:id/submit` | `survey.update` | Submit survey |
| `/m/surveys/:id/verify` | `survey.approve` | Verify critical measurements |
| `/m/sync` | authenticated | Sync now |
| `/m/account` | authenticated | Sign out |

## 4. Modules and shared components

```text
src/modules/surveys/        domain (room/wall/opening/utility/obstacle/measurement/note rules), data, presentation
  pages/                    SurveyListPage, SurveyDetailPage, SurveyVerifyPage, SurveyMediaPage
  components/               RoomBoard, MeasurementTable, CriticalMeasurementTable, SubmissionChecklist
src/modules/mobile-survey/  offline store, queue, conflict resolution, presentation shell
  pages/                    ProjectsPage, ProjectPage, SurveyListPage, SurveyHubPage, RoomListPage, RoomPage,
                            MeasurementCapturePage, MediaPage, SubmitPage, VerifyPage, SyncPage, AccountPage
src/shared/presentation/ui/ DimensionField, ChecklistDrawer, SyncStatusChip, MediaUploader
```

`DimensionField`: numeric, `mm` suffix, `inputmode="numeric"`, range hint from Part 5, critical flag, error under field with `aria-describedby`.
`ChecklistDrawer`: sheet on mobile / side panel on desktop, blocker count in title, jump links, focus trap.
`SyncStatusChip`: icon + count + label (Queued / Conflicts), `aria-live="polite"`, tap opens Sync.

## 5. Data

| Endpoint | Use |
|---|---|
| `GET /surveys`, `GET /projects/:id/surveys`, `POST /projects/:id/surveys`, `GET/PATCH /surveys/:id` | list + header |
| `POST /surveys/:id/transition`, `GET /surveys/:id/checklist`, `GET /surveys/:id/progress` | lifecycle + readiness |
| `/surveys/:id/rooms`, `/survey-rooms/:id`, walls, openings, utilities, obstacles | capture tree |
| `/surveys/:id/measurements`, `/survey-measurements/:id`, `POST …/verify`, `GET …/critical` | measurements + G8 |
| `/surveys/:id/notes`, `POST /survey-notes/:id/revision` | append-only notes |
| `POST /assets`, `POST /assets/:id/complete`, `GET /assets/:id/content`, `POST /assets/:id/state` | media |
| `POST /sync/push`, `GET /sync/pull`, `GET /sync/pending`, `POST /sync/asset-state` | offline |

Offline rules: forms write local-first; ops carry UUIDv7 idempotency keys; server wins conflicts with a re-apply prompt; rejected ops stay queued with reason; submission may queue offline. Mock simulates latency, conflict and offline mode behind a dev flag.

## 6. Design contract

- Web detail follows DESIGN §10.2 detail hub; verification page is a work surface, not a wizard.
- Mobile shell per §11: comfortable density, body ≥ 16 px, 44 px targets, `100dvh`, safe-area padding, offline banner, sync chip always visible, bottom tabs with icon + label.
- Forms mirror Part 9 §5–§11 field sets and messages; labels above fields; validate on blur; preserve data on error.
- Verification shows value, source, capture time, method; never colour-only; count changes announced.
- Media grid by owner, 4:3 photos, 16:9 video, labelled placeholder for missing assets, no stock imagery.
- Motion: sheet 300 ms, tab indicator 250 ms, no gesture-only actions.

## 7. Work waves

| Wave | Agent | Exclusive files | Gate |
|---|---|---|---|
| 1 | survey domain | `modules/surveys/domain/**` + tests | geometry + checklist rules |
| 1 | offline core | `modules/mobile-survey/data/offline-*`, queue, sync | queue restart + conflict tests |
| 1 | shared fields | `DimensionField`, `ChecklistDrawer`, `SyncStatusChip` | a11y + 44 px |
| 2 | web survey | survey pages + components | G8 negative + positive |
| 2 | mobile shell + rooms | mobile shell, project/survey/room pages | 320 px + safe areas |
| 2 | mobile capture | walls, openings, utilities, obstacles, measurements, notes | Part 9 field parity |
| 3 | media + submit | `MediaUploader`, media pages, submit/verify | offline media queue |
| 4 | gates | Playwright mobile + web, dark + 200 % | all gates green |

## 8. Done when

- [ ] A surveyor can go from assigned project → named survey → full capture → submit fully offline.
- [ ] Queue survives restart; nothing is silently lost; failed ops stay visible with retry.
- [ ] G8 blocks verification until every critical measurement is verified; editing a verified value clears verification.
- [ ] Submission checklist names every missing prerequisite; server rejection returns the survey to `in_progress` with field errors.
- [ ] Web verification and media pages are read-only where the spec says designers must not edit.
- [ ] No project QR anywhere; no mobile workshop/part screens.
- [ ] DESIGN §15 passes on both shells; 320–1920; keyboard; reduced motion/transparency.

## 9. Open questions

Q7 (laser/LiDAR devices and formats → import stub stays generic), Q9 (mobile platforms), Q10 (offline conflict policy acceptance), Q15 (photo-per-room default and media quotas).
