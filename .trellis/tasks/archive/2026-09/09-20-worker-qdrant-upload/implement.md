# Implementation Plan

1. Inspect the existing API/runtime configuration documentation and test seams.
2. Add the smallest configuration/diagnostic change needed to make API-owned upload indexing unambiguous.
3. Add a regression test proving the API-side ingest uses Qdrant when configured and still queues the worker job with the existing source.
4. Run focused API, storage, and worker tests plus package typechecks.
5. Review the diff for accidental worker re-indexing or changes to SQLite fallback behavior.

Validation commands:

- `pnpm --filter @trachex/storage-sqlite test`
- `pnpm --filter @trachex/worker test`
- `pnpm --filter @trachex/api test`
- `pnpm --filter @trachex/api typecheck`
- `pnpm --filter @trachex/worker typecheck`
