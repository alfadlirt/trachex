# Implementation Plan

1. Inspect current ingestion, chunk persistence, FTS5 search, Qdrant adapter, Anvia transformer API, and Docker Compose profile.
2. Add a lazy local embedding service using Anvia's default Transformers model without duplicating model configuration.
3. Add sqlite-vec initialization, vector schema, chunk upsert, project-scoped KNN search, and deterministic rebuild behavior.
4. Wire vector indexing into source ingestion after canonical snapshot/chunk persistence, preserving FTS5 and fallback behavior.
5. Add explicit retrieval backend configuration and concrete optional Qdrant selection/availability behavior using `TRACHEX_VECTOR_BACKEND=sqlite|qdrant`, `QDRANT_URL`, `QDRANT_API_KEY`, and `QDRANT_COLLECTION`.
6. Rename/implement the agent-facing tool as `vectorSearch` with the stable `SearchResult` provenance contract.
7. Add unit/integration tests for vector rows, semantic search, project isolation, fallback, Qdrant selection, and tool output.
8. Run storage, agent, API, and dashboard checks plus typecheck, Biome, and relevant builds.

## Validation

```bash
pnpm exec biome check apps/api/src packages/agent/src packages/storage-sqlite/src
pnpm --filter @trachex/storage-sqlite test
pnpm --filter @trachex/agent test
pnpm --filter @trachex/api test
pnpm --filter @trachex/storage-sqlite typecheck
pnpm --filter @trachex/agent typecheck
pnpm typecheck
```

## Risky Files

- `packages/storage-sqlite/src/connection.ts`
- `packages/storage-sqlite/src/migrations.ts`
- `packages/storage-sqlite/src/ingest.ts`
- `packages/storage-sqlite/src/repositories.ts`
- `packages/storage-sqlite/src/qdrant.ts`
- `packages/agent/src/factory.ts`
- `apps/api/src/context.ts`
- `docker-compose.yml`

## Explicitly Not Doing

- No PostgreSQL, R2/S3, hosted auth, or mandatory Docker.
- No duplicate embedding-model config.
- No removal of FTS5 fallback.
- No direct canonical requirement mutation.
