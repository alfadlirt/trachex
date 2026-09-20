# Implementation Plan

1. Read backend, cross-layer, and testing specifications; confirm all search implementations and agent call sites.
2. Extend domain search interfaces with optional subject scope and update SQLite FTS/vector implementations.
3. Add subject ID collection during Qdrant indexing and add subject-aware Qdrant filtering/fallback result merging.
4. Extend the agent retrieval tool/input wiring so reconciliation and subject/ticket chat pass the current subject ID.
5. Add focused tests for shared snapshots, unrelated subject exclusion, empty subject IDs, project fallback, and agent tool inputs.
6. Run storage, domain, agent, API, and worker tests/typechecks; inspect the final diff for project isolation and worker duplication.
7. Rebuild existing Qdrant points as an operational follow-up if local data needs subject metadata.

Validation commands:

- `pnpm --filter @trachex/storage-sqlite test`
- `pnpm --filter @trachex/domain test`
- `pnpm --filter @trachex/agent test`
- `pnpm --filter @trachex/api test`
- `pnpm --filter @trachex/worker test`
- `pnpm --filter @trachex/storage-sqlite typecheck`
- `pnpm --filter @trachex/domain typecheck`
- `pnpm --filter @trachex/agent typecheck`
- `pnpm --filter @trachex/api typecheck`
- `pnpm --filter @trachex/worker typecheck`
