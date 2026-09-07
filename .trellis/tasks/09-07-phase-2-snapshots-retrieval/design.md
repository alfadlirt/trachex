# Phase 2: Source Snapshots and Retrieval — Design

## Where the code lives

- `packages/domain`:
  - `src/ingestion.ts` — domain service `ingestSource` (file or note) that orchestrates snapshot + chunks + FTS5 via the UnitOfWork. Returns the created `Source` + `Snapshot` + chunk count. Keeps domain free of filesystem specifics except paths passed in.
  - Add `SnapshotRepository.findByProjectAndHash` (dedup/change detection) and `SnapshotRepository.listByProject`.
- `packages/storage-sqlite`:
  - `src/ingest.ts` — SQLite-backed ingestion implementation: writes snapshot content to `sources/`, inserts snapshot row, chunks content, inserts chunk rows (FTS5 triggers fire), returns ids.
  - `src/search.ts` — already has `SqliteSearchRepository` (FTS5). Keep as the default adapter.
  - `src/qdrant.ts` — optional `QdrantSearchRepository` implementing the same `SearchRepository` contract, plus `rebuildQdrantFromSnapshots(db, qdrant)`.
- `packages/shared`:
  - `src/hash.ts` — `sha256(text)`.
  - `src/chunk.ts` — deterministic chunker: split content into chunks of ~N chars/paragraphs, each with a stable id (hash of snapshotId + index) and location metadata (relPath:lineStart-lineEnd).
- Root: `docker-compose.dev.yml` for optional Qdrant (`qdrant/qdrant:v1.18.2`).

## Ingestion flow

```text
ingestSource(uow, { projectId, ticketId?, type, attribution?, content | filePath, sourceEventAt?, location? })
  1. read content (file or note)
  2. hash = sha256(content)
  3. if a snapshot with same projectId + hash exists → reuse it (dedup), still record a Source row
  4. else: write content to sources/<snapshotId>.<ext>, insert snapshot row
  5. chunk content → chunk rows (stable ids), FTS5 triggers index them
  6. create Source row (ticketId, type, attribution, snapshotId, location)
  7. optionally enqueue Qdrant indexing (if adapter configured)
```

Re-ingesting a changed file → new hash → new snapshot; the old snapshot row + file remain (immutable).

## Chunking

- `chunkText(content, { maxChars, overlap })`: split on paragraph/line boundaries; each chunk keeps `location` = `relPath:startLine-endLine` when line info is available (note: line tracking is approximate; for pasted notes location is `note` or a label).
- Stable chunk id: `sha256(relPath:index:text)` — content-addressed, deterministic, so identical content re-ingestion and Qdrant rebuilds produce the same chunk ids.

## Search contract (unchanged from Phase 1)

`SearchRepository.search(query, projectId, limit)` returns `{ chunkId, snapshotId, projectId, content, location, relPath, score }`. FTS5 is the default; Qdrant adapter implements the same interface. Qdrant is rebuilt from snapshots via `rebuildQdrantFromSnapshots` (reads snapshot files, chunks with the same `chunkText` chunker, embeds each chunk, and upserts into Qdrant with the same chunk ids as FTS5).

## Qdrant adapter (optional, not run in CI)

- `QdrantSearchRepository` wraps `@qdrant/js-client-rest` (or the Anvia qdrant package if available) — but to keep Phase 2 dependency-light and avoid a hard dependency, the adapter is implemented behind the interface and constructed only when `QDRANT_URL` is set. Embeddings are deferred to Phase 3 (Anvia/transformers); for Phase 2 the Qdrant adapter is a stub that is wired and tested only if Docker is present, otherwise skipped.
- Decision: Phase 2 implements the Qdrant *contract + rebuild scaffolding* and the Compose file, but actual embedding/indexing is completed in Phase 3 when Anvia is pinned. This keeps Phase 2 verifiable without Docker while satisfying "Qdrant can be rebuilt from project snapshots" at the code level.

## Tests

- `packages/shared`: hash determinism; chunker stability + location metadata.
- `packages/storage-sqlite`: ingest file → snapshot + chunks + FTS5 search returns provenance; re-ingest changed content → new snapshot, old preserved; pasted note ingestion; dedup on identical content.
- Qdrant rebuild: unit-tested against a fake adapter (no Docker in CI).

## Rollout / rollback

- Phase 2 builds on Phase 1. Failure = revert phase-2 commit(s). Phase 3 depends on the search contract + ingestion service.
