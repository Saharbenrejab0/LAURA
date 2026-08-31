---
name: cycle-code-deferred
description: New cycles created via admin tooling won't get a code until generation is wired into cycle creation
metadata:
  type: project
---

New cycles get their `code` column value from `cycle_code_column` migration backfill only. Any cycle created *after* the migration runs will have `code = NULL` unless code generation is added to the cycle creation flow.

**Why:** There is currently no cycle-creation endpoint in the API. Cycles are created directly or via admin tooling. When a creation endpoint is built (admin dashboard work), it must generate the code at insert time using the same `{YEAR}-Q{Q}-N{seq}` / `{YEAR}-EX{seq}` pattern from the migration.

**How to apply:** When implementing the admin dashboard / cycle creation flow, add a `code` generation step before the INSERT. The pattern is deterministic: query the count of existing normal/emergency cycles in the same year (+quarter for normal) and set `seq = count + 1`.

[[design-integration-architecture]]
