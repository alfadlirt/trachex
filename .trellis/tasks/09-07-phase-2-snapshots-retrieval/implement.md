# Phase 2: Source Snapshots and Retrieval — Implement

## Execution order

1. `packages/shared`: `src/hash.ts` (sha256) + `src/chunk.ts` (deterministic chunker with location metadata); unit tests.
2. `packages/domain`:
   - `src/ingestion.ts` — `ingestSource` domain service orchestrating snapshot/chunks/source via UnitOfWork; add `SnapshotRepository.findByProjectAndHash`.
   - unit tests with the memory UoW (reuse pattern from Phase 1).
3. `packages/storage-sqlite`:
   - `src/ingest.ts` — SQLite ingestion (write file, snapshot row, chunk rows, source row).
   - `src/search.ts` — confirm FTS5 search works (already present); add `findByProjectAndHash` impl.
   - `src/qdrant.ts` — Qdrant search adapter (same contract) + `rebuildQdrantFromSnapshots`; constructed only when configured.
   - integration tests: file ingest → search provenance; re-ingest changed → new snapshot, old preserved; note ingest; dedup.
4. Root `docker-compose.dev.yml` for optional Qdrant.
5. Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test` green.

## Validation commands

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Acceptance review checklist

- [ ] Changed-file re-ingest creates a new snapshot and preserves the old.
- [ ] Search results carry rel path + location + content.
- [ ] Local mode (FTS5) works without Docker.
- [ ] Qdrant rebuild scaffolding exists behind the search contract.
- [ ] Pasted-note ingestion works.
- [ ] Content hash stored and used for change detection.

## Review gate

Run trellis-check; then finish (spec update + commit + archive).

## Rollback

Revert phase-2 commit(s); Phase 1 base stays.
