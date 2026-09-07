# Phase 2: Source Snapshots and Retrieval

## Goal

Implement source ingestion (files and pasted notes), immutable snapshot storage with content hashes, chunking with source-location metadata, SQLite FTS5 indexing + search repository, and an optional Qdrant adapter (derived) with a Compose file.

Source of truth: `docs/implementation-plan.md` Phase 2, `docs/architecture.md` Retrieval + Storage Adapters, ADR 001.

## Requirements

- Source ingestion for files (from a path) and pasted notes (raw text).
- Immutable snapshot storage: content written under the global project `sources/` dir; DB stores metadata + content hash + relative path + size. Re-ingestion of a changed file creates a NEW snapshot and preserves the old one (immutability).
- Content hashing (e.g. SHA-256) for dedup/detection of change.
- Chunking with stable chunk IDs and source-location metadata (rel path + line/offset where available).
- SQLite FTS5 indexing of chunks (schema already exists from Phase 1) and a search repository returning chunk text + provenance (already implemented in Phase 1; verify + extend as needed).
- Optional Qdrant adapter implementing the same search contract as FTS5; Qdrant is a derived index rebuildable from snapshots. Docker Compose file for Qdrant. Local mode must work without Docker.
- Ingestion service that ties snapshot -> chunks -> FTS5 rows (synchronously) and optionally enqueues Qdrant indexing.

## Acceptance Criteria

- [ ] Re-ingesting a changed file creates a new snapshot and preserves the old one (both queryable).
- [ ] Search results include source and location provenance (rel path, location, content).
- [ ] Local mode works without Docker (FTS5 only).
- [ ] Qdrant can be rebuilt from project snapshots (adapter + rebuild function; not required to run in CI without Docker).
- [ ] Pasted-note ingestion works (no file on disk required).
- [ ] Content hash is stored per snapshot and used to detect change.

## Dependency order

- Depends on Phase 1 (schema, repositories, FTS5 table). Phase 3 (agent) depends on this task's search/retrieval contract.

## Notes

- Qdrant integration is optional and must not silently switch the canonical DB. The search contract (`SearchRepository`) is the seam; FTS5 is the default adapter.
- No embeddings/LLM in this phase; chunking is deterministic text chunking (e.g. by lines/paragraphs with a max size). Embeddings arrive with the agent phase if needed.
- Docker Compose file lives at repo root (`docker-compose.dev.yml`) for optional Qdrant.
