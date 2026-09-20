# Technical Design

## Boundary

Upload persistence and vector indexing occur in the API process. The worker only reconciles an existing source. Both processes currently construct independent unit-of-work instances, so environment variables are process-local.

## Data Flow

1. API parses the upload and calls `ingestFile`.
2. Ingestion writes the snapshot/chunks, then calls `uow.vectors.indexSnapshot`.
3. API context selects `createQdrantVectorRepository` when its environment resolves to `qdrant`.
4. The Qdrant repository embeds chunk content, ensures the collection, and upserts points.
5. API queues a job containing the source ID.
6. Worker loads that source and runs reconciliation; it does not ingest it again.

## Change Shape

Keep API-owned indexing as the single indexing pass. Add or update operational configuration/documentation and focused tests so the API's environment is verified, rather than duplicating indexing in the worker. If a code change is needed for observability, keep it limited to making the selected backend visible at API startup or upload diagnostics.

## Compatibility

No schema or vector format migration. `sqlite` remains the fallback for unset/unknown backend values, and ingestion continues to tolerate vector backend failures.

## Risks

Existing uploads created while only the worker had Qdrant configured will remain absent from Qdrant; backfill is explicitly out of scope. A separate rebuild/backfill command may be needed later.
