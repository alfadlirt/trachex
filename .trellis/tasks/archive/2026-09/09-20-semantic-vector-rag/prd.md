# Implement semantic vector RAG

> **Check status:** Local semantic indexing and Anvia embedder wiring are
> implemented. sqlite-vec is loaded opportunistically with a portable cosine
> fallback. Qdrant selection uses `TRACHEX_VECTOR_BACKEND=qdrant` with
> `QDRANT_URL`, optional `QDRANT_API_KEY`, and `QDRANT_COLLECTION`; `sqlite` is
> the default local backend.

## Goal

Add semantic retrieval to Trachex's local-first MVP so uploaded and ingested source chunks can be embedded locally, searched semantically, and supplied to the agent through one backend-neutral `vectorSearch` tool.

## Context

- The completed upload task stores Markdown/PDF evidence locally and feeds it through the existing snapshot/chunk pipeline.
- The verified current retrieval path is SQLite FTS5/BM25 through `search_context`; it is lexical, not semantic vector retrieval.
- The sibling `assignment-w8d2-rag-evals` project uses `@anvia/transformers`, Qdrant, and an agent search tool over top-k embedded document sections.
- `@anvia/transformers` owns the default model (`Xenova/all-MiniLM-L6-v2`); Trachex must not duplicate that model name in configuration.
- `sqlite-vec` is the local embedded vector backend. Qdrant is optional infrastructure exposed through Docker Compose and must never be required for `npx` installation.

## Requirements

- Generate local embeddings through `@anvia/transformers` using its built-in default model without adding a Trachex embedding-model environment variable or duplicate constant.
- Persist chunk embeddings in a sqlite-vec virtual table associated with existing chunk, snapshot, project, and provenance identifiers.
- Upsert or rebuild vector rows whenever source chunks are ingested, while preserving the existing immutable snapshot and FTS5 lifecycle.
- Provide semantic vector search scoped by `projectId`, bounded by a caller limit, and returning the existing `SearchResult` provenance fields.
- Fall back explicitly to FTS5 when sqlite-vec or local embedding initialization is unavailable; do not silently label lexical results as vector results.
- Add optional Qdrant selection through application configuration and Docker Compose's vector profile without auto-starting Docker or changing the agent-facing tool contract.
- Expose one agent tool named `vectorSearch` with `query`, `projectId`, and optional `limit` input. The tool must hide backend URLs, handles, collection names, and implementation details.
- Keep vector indexing failure from mutating canonical requirements or invalidating the source snapshot; record or surface the failure according to existing error handling.
- Preserve local-first behavior: no PostgreSQL, R2/S3, hosted account, or mandatory Docker dependency.

### Current implementation boundary

The checked-in implementation uses `vector_chunks.embedding` and an
application-level cosine scan as the portable local fallback. `sqlite-vec` is
loaded opportunistically and used when its virtual table accepts the schema.
Qdrant is selected through the explicit environment variables above; if it is
unavailable, the local backend remains usable.

## Out Of Scope

- Hosted vector infrastructure, multi-tenant routing, authentication, R2/S3, PostgreSQL, OCR, or background workers.
- Replacing FTS5; it remains the exact-keyword fallback.
- Changing proposal approval or canonical requirement mutation semantics.
- Adding a second configurable embedding model.

## Acceptance Criteria

- [ ] A fresh local database can initialize the vector index when the supported sqlite-vec native package is available.
- [ ] Ingesting a source creates searchable vector rows for its chunks with project and source provenance.
- [ ] Semantic search returns ranked project-scoped chunks with `chunkId`, `snapshotId`, `projectId`, `content`, `location`, and `relPath`.
- [ ] Missing native vector support or embedding initialization produces a documented FTS5 fallback, not a false semantic result.
- [x] Qdrant can be selected explicitly when configured and its Docker profile is present, but local startup never requires Docker.
- [ ] The agent exposes `vectorSearch` with the same input/output contract regardless of backend.
- [ ] Tests cover indexing, project scoping, provenance, fallback, backend selection, and tool invocation.
- [ ] Storage/agent/API typechecks, focused tests, Biome, and relevant builds pass.
