# Investigate worker Qdrant upload indexing

## Goal

Uploaded files must be indexed in the configured Qdrant collection so that vector retrieval can use them. The investigation must explain the current process boundary and prevent a configuration that silently indexes uploads in SQLite while only the worker is configured for Qdrant.

## Background

- The API handles the upload and calls `ingestFile` in `apps/api/src/routes.ts:284-297`.
- `ingestSource` indexes the snapshot immediately through `uow.vectors.indexSnapshot` in `packages/domain/src/ingestion.ts:76-84`.
- The API creates its own `SqliteUnitOfWork` and resolves `TRACHEX_VECTOR_BACKEND` in `apps/api/src/context.ts:18-33`.
- The worker creates a separate unit of work in `packages/worker/src/worker.ts:21-34`, but receives an already-created `sourceId` and does not ingest or index it again (`packages/worker/src/worker.ts:65-85`).
- Consequently, setting `TRACHEX_VECTOR_BACKEND=qdrant` only in the worker cannot make the upload appear in Qdrant; the API process must receive the setting, or indexing must be explicitly moved/repeated in the worker.

## Requirements

- Make the upload-to-vector-backend ownership explicit in code and operational configuration.
- Ensure an upload handled by the API reaches Qdrant when the API process has `TRACHEX_VECTOR_BACKEND=qdrant` and valid Qdrant settings.
- Preserve SQLite as the default and preserve lexical fallback behavior when vector indexing fails.
- Add focused regression coverage for the process/configuration boundary and Qdrant indexing path.
- Do not redesign the queue or introduce duplicate indexing unless required by the verified defect.

## Acceptance Criteria

- [x] The documented or runtime configuration clearly identifies that the API process, not only the worker, must have `TRACHEX_VECTOR_BACKEND=qdrant`, `QDRANT_URL`, `QDRANT_COLLECTION`, and optional `QDRANT_API_KEY` for upload-time indexing.
- [x] With the API configured for Qdrant, ingesting an uploaded source invokes the Qdrant vector repository and upserts points for its chunks.
- [x] The worker continues processing the queued source without relying on a second ingestion/indexing pass.
- [x] Existing SQLite/default and indexing-failure fallback tests continue to pass.
- [x] Focused tests demonstrate the corrected behavior and the relevant package typechecks.

## Out Of Scope

- Migrating existing SQLite vectors into Qdrant.
- Changing embedding model dimensions or Qdrant query semantics.
- Making the worker the sole owner of upload indexing.

## Open Questions

None blocking. The minimal corrective direction is to configure the API process consistently and add a regression test; implementation may additionally improve startup diagnostics if the existing configuration surface makes this easy.
