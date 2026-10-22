# AGENTS.md — Interio Frontend: binding rules for every agent

> **This file is the contract for how work is done in this repository.**
> Load it first, obey it strictly, and never treat it as optional. If a rule here conflicts with `web-design-engineer/spec.md`, `web-design-engineer/ui-ux.md` or `standards/architecture.md`, those documents win and you report the conflict in one line.

---

## 0. Repository state and precedence

### 0.1 Current state (re-check on every task, never assume)

| Item | State |
|---|---|
| Application code | **Not scaffolded yet.** No `package.json`, no `src/`. Phase 0 creates them. |
| `requirements/` | `phase-0.md` … `phase-8.md` — the only allowed execution plans. |
| `DESIGN.md` | **Draft V1.0 · awaiting approval.** Blocks UI implementation (Rule 1). |
| `web-design-engineer/spec.md` | Product contract (Parts 0–13). `spec.md` Part 11 = frontend, Part 12 = phasing, Part 13 = verification. |
| `standards/` | `architecture.md` — SvelteKit 2 + Svelte 5 runes architecture. |
| `testing/` | `ui-ux-tester.md`, `standards/basic-rules.md` — mandatory browser testing. |
| Git | Remote `origin` = `Kairosys-org/interio_frontend`. `.opencode/` is ignored — never commit it. |

### 0.2 Precedence ladder (highest first)

| Rank | Source | Answers |
|---|---|---|
| 1 | `AGENTS.md` | How the agent works — process only |
| 2 | `requirements/phase-N.md` | Scope of the active phase (execution plan, **not** a source of truth) |
| 3 | `web-design-engineer/spec.md` | **What** the product does and **where** — wins on product behaviour |
| 4 | `web-design-engineer/ui-ux.md` | **How** the interface behaves and feels — wins on interaction |
| 5 | `standards/architecture.md` | **How** it is built — wins on structure |
| 6 | `DESIGN.md` | Exact visual values — tie-breaker for tokens only |
| 7 | `testing/` | Proof that work is done |

Nothing in this file overrides ranks 3–6. If you must refuse a request, cite the rule.

### 0.3 Phase dependency graph

| Phase | Depends on | Unlocks |
|---|---|---|
| 0 Foundation, shell, tenancy | — | 1–8 |
| 1 Records spine (customers, properties, projects) | 0 | 2–8 |
| 2 Survey: web review, mobile capture, offline sync | 1 | 3–7 |
| 3 Catalogue and materials | 0 (1 for the imports shell) | 4, 6 |
| 4 Design studio and public viewer | 1–3 | 5 |
| 5 Commercial: quotes, approval, orders, payments | 3–4 | 6–7 |
| 6 Production, purchasing, saw export | 3–5 | 7 |
| 7 Site, aftercare, reports | 5–6 | 8 |
| 8 Admin, governance, platform console | 0–7 | release |

Default execution order is `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`. The only permitted out-of-sequence start is a phase whose own header declares it may start earlier (today: phase 3 after 0/1). Reordering for convenience is a violation.

---

## RULE 1 — UI/UX follows the design authority chain

1. **Load the `web-design-engineer` skill** and read, in this order: `web-design-engineer/spec.md` Part 11 (pages, modules, permissions, endpoints) and the parts named by the active phase's `Read with:` line → `web-design-engineer/ui-ux.md` in full → `DESIGN.md` in full. `DESIGN.md` requires this before a single component is written.
2. **`DESIGN.md` is the only source for visual values:** tokens, palettes, type scale, spacing, radii, shadows, motion, component contracts, page patterns, copy patterns. No colour, size, duration, shadow or radius may be added that is not in that file (§0.4.3). No hardcoded hex/rgb, no arbitrary Tailwind values (`bg-[#…]`, `text-[13px]`), no inline `style` except dynamic data or 3D/canvas geometry (§14.3).
3. **Stack constraints from DESIGN §14.1 and architecture:** Tailwind CSS 4 + `cn()`; **no shadcn-svelte, no new component library**; shared UI in `src/shared/presentation/ui` (one owner file + barrel), feature-only UI in the module's `presentation/`; no API calls or feature imports inside primitives.
4. **Precedence inside design:** `spec.md` > `ui-ux.md` > `architecture.md` > `DESIGN.md`. When they disagree, follow the higher rank and report it.
5. **Blocker:** `DESIGN.md` is *Draft V1.0 · awaiting approval*. Do no UI implementation until the user approves it or explicitly says "proceed on draft". Never invent missing values — undecided items stay in `DESIGN.md` §16 and are raised, not filled.
6. A screen is "designed" only when `DESIGN.md` §12.6 test matrix, §15.1–§15.4 quality gates and `ui-ux.md` §19 pre-ship checklist pass.

---

## RULE 2 — `standards/` is law

1. Read **every** `.md` in `standards/` before writing code (today `architecture.md`) and apply all of it: layer responsibilities (§3), module anatomy (§4), shared/network layers (§5–7), auth/session/RBAC (§8), thin routes (§9), runes-only presentation (§10), naming (§11), enforcement tooling (§14), modes (§15–18), framework lock (§19), hard prohibitions (§20), multi-agent orchestration (§22).
2. **Framework lock:** SvelteKit 2 + Svelte 5 runes + TypeScript strict, Vite, Tailwind 4, zod, Vitest, Playwright, ESLint + Prettier, adapter-node. No Svelte 4 syntax (`export let`, `$:`, `on:`, `<slot>`, `createEventDispatcher`), no React/Vue/Next/Angular, no alternative folder structure, no new alias conventions.
3. **Boundaries:** presentation and routes never import `data/mock*`, `data/adapters/*`, `$network/mock-backend` or `$network/mock-bootstrap`; presentation calls only the feature `data/api.ts`; only the repository provider picks mock vs API; mock and API adapters share one domain model; no business rules in `.svelte`; no `fetch`/`localStorage` in presentation.
4. **Identity and data:** all ids are UUIDs (`Uuid`, `isUuid`, `newUuid()`, `deterministicUuid()`); no numeric/slug/prefixed ids; deterministic seeds only (no `Math.random`, no `Date.now`); mock DB schema versioned with migrations; no unversioned collection changes.
5. **Multi-agent is mandatory** when work spans 2+ independent units: the main agent is the orchestrator (plan waves, spawn all independent subagents in one response, apply shared wiring, run gates, commit). Subagents get owned paths, forbidden paths, the exact rule sections, the interfaces, and the required output format. Two agents never touch the same file. Orchestrator-only files (mock bootstrap, schema version, permissions, route permissions, navigation, collections, `index.ts` barrels, `package.json`, `.env.example`, CI/ESLint config, `docs/` tracker) are edited only by the orchestrator via wiring patches.
6. Where `architecture.md` writes `npm`, read `pnpm`.
7. When a request conflicts with a standard: follow the standard and say so in one line (§21 etiquette).

---

## RULE 3 — Test the frontend through `testing/` before saying "done"

1. Read `testing/ui-ux-tester.md` and `testing/standards/basic-rules.md` in full, plus every file later added under `testing/`.
2. Use `playwright-cli`, **headless only** (never `--headed`). Open with `playwright-cli open --browser=chromium <url>`. Save screenshots/snapshots to `.playwright-cli/ui-review/`; read only what you need — never dump whole pages into the conversation. Close the session when finished.
3. **Viewports, every page including 404:** `320×720`, `390×844`, `768×1024`, `1280×720`, `1920×1080`. Scroll to capture below the fold. Check light and dark mode, `prefers-contrast: more`, and 200 % text zoom.
4. **Mandatory evals per page:** horizontal overflow (`scrollWidth <= innerWidth`), tap targets `< 44×44` on mobile, computed contrast ratios (4.5:1 text / 3:1 large text, icons, focus), console errors and failed own-asset requests, heading order, keyboard-only pass with visible focus.
5. **User flows:** list 3–5 real tasks per feature, run each on mobile and desktop, happy path first, then abuse — empty submit, very long text, odd characters, double click, browser back, mid-flow reload, unknown route.
6. **Project overlays on top of the generic guide:** `DESIGN.md` §12.6 test matrix, §15.1–§15.4 gates, `ui-ux.md` §19 checklist, `spec.md` Part 13 UI contract, and the active phase's `Done when` UI items.
7. No post-fix screenshot = not fixed. Fix bugs yourself; report suggestions and do not implement them without being asked. Never redesign a flow on your own. Do not edit files unrelated to the visual problem.
8. Leave no test data behind; state in the report anything you created, edited or deleted. Never guess credentials; ask for them. If the dev server will not start, report the exact error.

---

## RULE 4 — Commit and push continuously

1. Adopt `standards/architecture.md` §14.8 verbatim. Inspect `git status`, branch and `git remote -v` first.
2. **Never work on `main`/`master`.** Use a short-lived branch per task: `feature/<name>`, `fix/<name>`, `refactor/<name>`, `chore/<name>`. Never create permanent `mock`/`api`/`demo` branches.
3. **One small focused commit per finished logical unit** (scaffold, tooling, domain layer, data layer, UI, wiring, docs, tracker). Never one giant commit, never a vague "wip". Never mix refactor + feature + fix.
4. **Conventional commits:** `<type>(<scope>): <imperative summary>` with `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`. Example: `feat(customers): add domain types and validation`.
5. **Before each commit:** the checks covering that unit pass (`check`, `lint`, `arch:check`, the relevant unit tests). Never commit on red. Stage only the files of that unit by explicit path — **never `git add -A`**.
6. **Push immediately after every commit:** `git push -u origin <branch>` the first time, then `git push`. Never force push, never rewrite pushed history, never push straight to `main`. Open a PR into `main` when the task is done and a remote/forge CLI exists.
7. **Push fails or no remote:** keep committing locally at the same cadence, state it once in one line (what failed, what is needed), and carry on — do not stall.
8. **Never commit:** secrets, `.env`, `node_modules`, `.svelte-kit`, `build`, test output, `.opencode/`. Respect `.gitignore`.
9. The orchestrator owns git. Subagents do not commit or push, except a subagent working in its own worktree branch, which commits there; the orchestrator merges, re-runs the gate and pushes.

---

## RULE 5 — `requirements/` phases, in order, and each phase is marked complete

### 5a. Execute one phase at a time

1. The nine files `requirements/phase-0.md` … `phase-8.md` are the execution plans. Follow the header (`Status`, `Depends on`, `Unlocks`, `Spec map`, `Read with`) and the §0.3 dependency graph. Never invent, reorder, split or merge phases.
2. Implement **only** the `## 1. Scope → Ships` list. Anything in `Not in this phase` is out of bounds and is a violation if touched.
3. Obey `## 2. Requirements`, `## 3. Routes and pages`, `## 4. Modules and shared components`, `## 5. Data`, `## 6. Design contract` exactly.
4. Execute `## 7. Work waves` as the subagent layout: each row is one agent with its **exclusive files** and its gate; batch independent agents in one response (architecture §22). Apply shared wiring yourself.
5. `## 9. Open questions` are reported, never answered or guessed.
6. Commits follow the wave order (Rule 4) — domain, data, UI, wiring.

### 5b. Mark the phase complete — mandatory

A phase is marked complete **only** when all of these are true:

- every box in `## 8. Done when` is objectively satisfied;
- Rule 3 testing passed, with post-fix screenshots at all five viewports, dark mode and 200 % zoom;
- Rule 7 gate fully green;
- every unit of the phase is committed and pushed.

Then, and only then, edit `requirements/phase-N.md`:

1. Tick every item in `## 8. Done when`: `- [ ]` → `- [x]`.
2. Replace the header status with: `> **Status:** completed · <YYYY-MM-DD> · gate green (check, lint, arch:check, unit, e2e, build)` — keep `Depends on:` and `Unlocks:` untouched.
3. Do not rewrite scope, requirements, routes, data, design contract, waves or open questions.
4. Commit `docs(phase-N): mark phase complete`, then push. This is the **only** edit permitted after the gate; it changes no code, so the gate is not re-run.

Never mark a phase complete with a red gate, an unticked box, an open suggestion from testing, or to unblock the next phase. A phase that is 95 % done stays `in progress`.

**Hard block:** a phase may not start until every phase listed in its `Depends on:` header is `completed` (for phase 3: 0, plus 1 for the imports shell).

---

## RULE 6 — (precondition) Load the instructions before anything

Before any task, in this order:

1. `AGENTS.md` (this file).
2. `requirements/phase-N.md` — the active phase.
3. Every document listed in that phase's `Read with:` line (specific `spec.md` parts included).
4. `web-design-engineer/ui-ux.md` in full.
5. `DESIGN.md` in full.
6. Every `.md` in `standards/`.
7. Every `.md` in `testing/` (including `testing/standards/`).

Re-read them on every new task and whenever any of them changes on disk. Never rely on memory from an earlier turn or summary. A missing file or folder is a stop condition — report it, never assume its contents.

---

## RULE 7 — (FINAL) Run the pnpm gate only after all other rules are complete

1. This is the **last** step of a unit and of a phase: it runs only after implementation (Rule 2), testing (Rule 3), commits and pushes (Rule 4) and the phase obligations (Rule 5a) are satisfied.
2. Run in this exact order, zero skips:

   ```bash
   pnpm check
   pnpm lint
   pnpm arch:check
   pnpm test:unit -- --run
   pnpm test:e2e
   pnpm run build
   ```

   (`pnpm run preview` only where e2e needs it.)

3. **`pnpm dev` and `pnpm install` are the only pnpm commands allowed before this step.** Every other pnpm script belongs to the gate.
4. **Current reality:** before Phase 0 lands there is no `package.json`. Say so in one line and never fake, skip or stub the gate. Phase 0 owns making every script real.
5. **Red gate:** fix, make a small follow-up commit, push, and re-run the whole gate. The unit/phase stays open. Nothing is left red.
6. **Never:** `--no-verify`, `pnpm install --ignore-scripts` tricks, disabling lint rules, deleting or skipping tests, `test.skip`/`test.only`, lowering thresholds, or editing the gate scripts to pass.
7. Where `standards/architecture.md` §14.5 writes `npm`, these pnpm commands are the equivalent; the order is fixed.

---

## 8. Execution order (follow literally)

```text
0. Load Rule 6 sources.
1. Announce the mode, phase and wave plan (architecture §21/§22); inspect the repo.
2. Read the active phase file and its Read with: documents.
3. Implement only the phase scope, under Rule 2 architecture and Rule 1 design.
4. Browser-test per Rule 3 (5 viewports, dark, 200 %, keyboard, flows).
5. Commit and push the finished unit(s) per Rule 4.
6. RULE 7 FINAL GATE: check -> lint -> arch:check -> test:unit -> test:e2e -> build.
7. Green -> Rule 5b: tick Done when, set Status: completed, commit docs(phase-N), push.
8. Red -> fix, commit, push, repeat step 6; phase stays in progress.
9. Report: what changed, commits pushed, gate result, what is enforced now, next phase.
```

---

## 9. Stop conditions (report, do not improvise)

- `DESIGN.md` is unapproved and UI work is requested.
- The active phase file is missing, or its `Depends on:` phases are not `completed`.
- A document named in `Read with:` or in Rule 6 is missing.
- `package.json` does not exist yet (gate not runnable) — state it, do not fake it.
- The gate is red after repeated fix attempts — report the exact failing output.
- Requirements contradict each other — follow the precedence ladder and report.
- The dev server will not start, credentials are unknown, or a flow cannot be verified.

---

## 10. Definition of done

**Unit:** implemented per standards · tested in a real browser with post-fix screenshots · gate green · committed on a task branch · pushed.

**Phase:** all of the above · every `Done when` box ticked · `Status: completed` written · docs commit pushed · no untested scope and no open blocker.

Anything less is **in progress** — never report it as done.

---

## 11. Do / don't

| Do | Don't |
|---|---|
| Read every governing document first | Rely on memory or summaries |
| Use `DESIGN.md` tokens only | Add colours, sizes, durations or shadows |
| Call the feature `data/api.ts` | Import mocks/adapters or call `fetch` in presentation |
| Write Svelte 5 runes | Use Svelte 4 syntax |
| Test in a real headless browser | Claim a fix without a screenshot |
| Use UUIDs and deterministic seeds | Use numeric ids, `Math.random`, `Date.now` in seeds |
| Commit small, push often, on a branch | Commit to `main`, force push, `git add -A`, leave work uncommitted |
| Run the full pnpm gate last | Fake, skip or weaken the gate |
| Mark a phase complete when proven | Mark it complete to move on |
| Report open questions | Invent product decisions, data or endpoints |
| Fan out independent work to subagents | Serialise multi-module work in one agent |
