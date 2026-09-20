# Semantic Vector RAG Design

## Data Flow

```text
source ingestion
  -> immutable snapshot + chunks + FTS5
  -> local Anvia embedding
  -> sqlite-vec or Qdrant upsert
agent vectorSearch(query, projectId, limit)
  -> selected SearchRepository
  -> ranked SearchResult provenance
  -> agent context
```

The existing `SearchRepository` remains the backend-neutral boundary. The
agent does not know which repository is selected. FTS5 remains a separate
lexical fallback and must be observable in configuration/status rather than
being mislabeled as semantic retrieval.

## Embeddings

Use `loadTransformersEmbeddingModel` from `@anvia/transformers` without
overriding its default model. The model identifier is owned by Anvia. The
embedding lifecycle must be lazy or explicitly initialized so local CLI/API
startup does not download a model before retrieval is needed.

## SQLite Vector Store

Load `sqlite-vec` into `better-sqlite3` when supported. The checked-in
implementation uses a regular `vector_chunks` BLOB table and application-level
cosine search as the portable fallback, while opportunistically maintaining a
sqlite-vec virtual table when the native extension accepts the schema. Add a migration or
idempotent initialization for a vector table keyed by chunk identity and
partitioned/scoped by project. Store the embedding and enough provenance to
return `SearchResult`; canonical chunk content remains owned by the existing
chunks/snapshots tables.

Ingestion must upsert vectors after chunk persistence. Re-ingestion creates new
snapshot/chunk identities and must not delete historical source records. A
rebuild operation should be deterministic from snapshots/chunks.

## Qdrant

Keep the existing Qdrant adapter shape, add a concrete configuration-selected
client path, and expose the existing Compose `vector` profile. Docker probing
and user opt-in belong to setup/configuration, not to the agent tool. The
Runtime selection uses `TRACHEX_VECTOR_BACKEND=sqlite|qdrant`. Qdrant uses
`QDRANT_URL`, optional `QDRANT_API_KEY`, and `QDRANT_COLLECTION`. If Qdrant is
unavailable, the local path must continue using sqlite-vec, the cosine table,
or FTS5.

## Tool Contract

```ts
vectorSearch({ query, projectId, limit? }) -> SearchResult[]
```

The tool description says it searches indexed project context and returns
provenance. It must not expose backend-specific fields.

## Failure And Compatibility

- Snapshot/chunk persistence succeeds independently of vector indexing.
- Vector failures are recorded or returned as an explicit retrieval status;
  they never mutate requirements.
- Existing JSON adjustments, FTS5 search tests, and fixture agent runs remain
  valid without native vector support.
- No database transaction spans embedding model calls or network Qdrant calls.
