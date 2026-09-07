# Phase 2: Source Snapshots and Retrieval

## Goal

Source ingestion for files and pasted notes; immutable snapshot storage with content hashes; chunking with source location metadata; SQLite FTS5 indexing and search repository; optional Qdrant adapter + Compose (derived). Acceptance: re-ingest creates new snapshot preserves old; search results carry provenance; local mode works without Docker; Qdrant rebuildable from snapshots.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
