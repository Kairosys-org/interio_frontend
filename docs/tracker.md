# Module tracker

Update this table whenever a module changes status, in the same commit as the change.

| Module             | Interface | Mock adapter | API facade | API adapter             | Tests                         | Status           |
| ------------------ | --------- | ------------ | ---------- | ----------------------- | ----------------------------- | ---------------- |
| `auth`             | done      | done         | done       | scaffold (fails loudly) | mock flow, permissions        | phase 0 complete |
| `platform-tenants` | done      | done         | done       | scaffold (fails loudly) | tenant isolation, transitions | phase 0 complete |
| `customers`        | done      | done         | done       | scaffold (fails loudly) | mock CRUD, dedup, pagination  | phase 1 complete |
| `properties`       | done      | done         | done       | scaffold (fails loudly) | mock CRUD, pagination         | phase 1 complete |
| `projects`         | done      | done         | done       | scaffold (fails loudly) | mock CRUD, transitions, users | phase 1 complete |
| `duplicates`       | done      | done         | done       | scaffold (fails loudly) | dedup normalisation, review   | phase 1 complete |
| `imports`          | done      | done         | done       | scaffold (fails loudly) | CSV parse, commit, dedup      | phase 3 complete |
| `surveys`          | done      | done         | done       | scaffold (fails loudly) | tree CRUD, transitions, G8    | phase 2 complete |
| `assets`           | done      | done         | done       | scaffold (fails loudly) | owner rule, sha256, state     | phase 2 complete |
| `sync`             | done      | done         | done       | scaffold (fails loudly) | outbox, conflict, idempotency | phase 2 complete |
| `catalogue`        | done      | done         | done       | scaffold (fails loudly) | params, rules, versions       | phase 3 complete |
| `materials`        | done      | done         | done       | scaffold (fails loudly) | decor, suppliers, links       | phase 3 complete |

Status legend: `in progress` · `phase N complete`.
