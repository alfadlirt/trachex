# Implementation Plan

1. Read the frontend/backend specs and inspect the current adjustment tests, source snapshot paths, and dependency/license constraints.
2. Select and add a maintained Node-compatible PDF text extraction dependency; document the chosen package and limit behavior.
3. Add `@anvia/transformers` and use its built-in default embedding model without introducing a duplicate Trachex model constant or environment variable; document package/model size, cache location, offline behavior, first-run latency, and license.
4. Implement the local sqlite-vec vector repository alongside FTS5 and connect it through the existing `SearchRepository` contract.
5. Complete optional Qdrant repository/client wiring and the Docker Compose vector profile without making Docker required; add explicit backend selection and availability checks.
6. Defer the backend-neutral `vectorSearch` agent tool to the semantic-RAG follow-up until vector indexing and backend selection are implemented together; keep the current FTS5 `search_context` tool honest.
7. Add server-side upload validation and local filesystem storage with safe generated paths and a configurable size limit.
8. Add multipart adjustment handling that combines typed note and extracted document text, then chunks/indexes uploaded content while preserving the existing JSON path.
9. Add API/storage/agent tests for Markdown, PDF, invalid type, oversized input, empty submission, indexing, backend selection, tool provenance, and proposal/source failure behavior.
10. Rework the dashboard adjustment card with labeled fields, file picker/dropzone treatment, selected-file metadata, remove action, loading, success, and error states.
11. Run focused API/dashboard/storage/agent tests, typecheck, Biome, and builds; review for path traversal, memory limits, duplicate submission, Docker opt-in behavior, and provenance regressions.
12. Track semantic-RAG completion separately: do not claim chunk upsert, backend selection, or vectorSearch provenance until they are covered by integration tests; keep FTS5 explicitly documented as the current retrieval mechanism.

## Validation

```bash
pnpm exec biome check apps/api/src apps/dashboard/src packages/storage-sqlite/src
pnpm --filter @trachex/api test
pnpm --filter @trachex/dashboard test
pnpm --filter @trachex/api typecheck
pnpm --filter @trachex/dashboard typecheck
pnpm --filter @trachex/dashboard build
```

## Risky Files

- `apps/api/src/routes.ts`
- `apps/api/src/validation.ts`
- `apps/api/src/routes.test.ts`
- `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx`
- `apps/dashboard/src/lib/api.ts`
- `packages/storage-sqlite/src/ingest.ts`
- `packages/storage-sqlite/package.json`
- `packages/storage-sqlite/src/qdrant.ts`
- `packages/agent/src/factory.ts`
- `docker-compose.yml`

## Explicitly Not Doing

- No R2/S3 or PostgreSQL dependency or deployment in MVP 1. Qdrant is optional and explicit; sqlite-vec is the local default.
- No browser local-storage file persistence.
- No SaaS/B2B hosting concerns, accounts, tenant isolation, OCR, virus scanning, public download URLs, or background job system.
- No direct canonical requirement mutation.
