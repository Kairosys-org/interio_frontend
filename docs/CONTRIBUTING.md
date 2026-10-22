# Contributing to the Interio frontend

## Purpose

Interio is a SvelteKit 2 + Svelte 5 (runes) + TypeScript strict application built in layers:
route → page → feature `data/api.ts` → repository interface → provider → adapter (mock or API).
Mock and API adapters share one domain model, and only the provider chooses between them.
Before every commit run the gate, in this order:

```bash
pnpm check
pnpm lint
pnpm arch:check
pnpm test:unit -- --run
pnpm test:e2e
pnpm run build
```

## The rules

1. Never import mock implementations from presentation or routes.
2. Never import an API adapter from presentation or routes.
3. UI talks only to the feature `data/api.ts` facade.
4. `api.ts` talks only to the repository interface.
5. The repository provider is the only place that selects mock vs API.
6. Mock and API adapters use the same domain types.
7. Never duplicate a domain model between mock and API paths.
8. No environment-specific business rules in the UI.
9. Errors are normalized and stable (`ApiError`), never swallowed.
10. A model change requires matching seed data and green tests.
11. No repository-bypassing quick fixes.
12. Seed data is deterministic: no `Math.random()`, no `Date.now()`.
13. The mock database schema is versioned; bump `MOCK_DB_SCHEMA_VERSION` with a migration.
14. Every id is a UUID: `newUuid()` at runtime, `deterministicUuid()` in seeds, `isUuid()` on input.
15. Every finished unit is committed and pushed to `main` (see below).

## IDs

All entity ids, foreign keys, route params and DTO ids are UUIDs (`Uuid`). Numeric, slug or
prefixed ids are forbidden. Seeds use `deterministicUuid('<entity>:<n>')`; runtime creates use
`newUuid()`. Route params are validated with `isUuid()`.

## Git workflow

- The only branch is `main`. Never create `feature/*`, `fix/*`, `mock` or `api` branches.
- One small focused commit per finished logical unit, in build order: scaffold, tooling, domain,
  data, UI, wiring, docs.
- Conventional messages: `<type>(<scope>): <imperative summary>`, types `feat`, `fix`, `refactor`,
  `test`, `docs`, `chore`, `build`.
- Stage explicit paths; never `git add -A`.
- Push immediately after each commit: `git push -u origin main` the first time, then `git push`.
- Never force push, never rewrite pushed history, never open a pull request.
- Never commit secrets, `.env`, build output, test output, `.opencode/` or `node_modules`.
- Subagents never commit or push; the orchestrator owns git.

## Pull request checklist

Not used: work lands directly on `main`. Before pushing, confirm the gate is green, the tracker in
`docs/tracker.md` is updated, presentation has no mock/adapter imports, all ids are UUIDs, and
the docs match the code.

## Do and don't

| Do                                           | Don't                                       |
| -------------------------------------------- | ------------------------------------------- |
| Read the governing docs first                | Rely on memory or summaries                 |
| Use `DESIGN.md` tokens only                  | Add colours, sizes, durations or shadows    |
| Call the feature `data/api.ts`               | Import mocks/adapters or call `fetch` in UI |
| Write Svelte 5 runes                         | Use Svelte 4 syntax                         |
| Test in a real headless browser              | Claim a fix without a screenshot            |
| Use UUIDs and deterministic seeds            | Use numeric ids or random seed data         |
| Commit small, push often, straight to `main` | Open a PR, force push, `git add -A`         |
| Run the full pnpm gate last                  | Fake, skip or weaken the gate               |
