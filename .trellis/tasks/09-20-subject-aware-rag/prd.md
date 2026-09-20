# Add subject-aware RAG retrieval

## Goal

Make RAG results aware of the subject they came from. Subject-scoped agent work should prefer evidence attached to the current subject, while project-wide and legacy evidence remains available through an explicit or fallback project search.

## Confirmed Technical Facts

- Qdrant currently stores and filters only `project_id` in `packages/storage-sqlite/src/qdrant.ts:50-59`.
- The agent `vectorSearch` tool currently accepts only `query`, `projectId`, and `limit` in `packages/agent/src/factory.ts:22-34`.
- A subject creates a backing ticket with the same immutable ID in `packages/domain/src/services.ts:64-76`; the current subject scope key is therefore the ticket/subject ID.
- Snapshots are deduplicated by project and content hash in `packages/domain/src/ingestion.ts:40-50`, so one snapshot may have sources attached to multiple tickets/subjects.
- Existing project-only and legacy sources must remain searchable.

## Requirements

- Add `subject_ids` metadata to each indexed vector point. It must contain every subject ID whose source references the snapshot; it may be empty for legacy/project-only sources.
- Extend semantic and SQLite fallback search contracts with an optional subject scope while preserving project scoping.
- Make subject-scoped retrieval the default for reconciliation and subject/ticket chat when a subject ID is available.
- Use project-scoped retrieval as the fallback when subject-scoped results are empty or insufficient, and for callers without subject context.
- Keep one Qdrant collection; do not create collections per project or subject.
- Preserve existing ingestion, SQLite defaults, lexical fallback, and worker ownership boundaries.
- Add regression coverage for payload metadata, subject filtering, project fallback, and the agent retrieval contract.

## Acceptance Criteria

- [x] New Qdrant points include `project_id` and a `subject_ids` array containing all subject IDs linked to the snapshot's sources.
- [x] A search with `projectId` and `subjectId` returns matching subject evidence before project-only evidence and never returns evidence from an unrelated subject when subject results are available.
- [x] Project-wide search still returns shared and legacy evidence, including snapshots whose `subject_ids` array is empty.
- [x] SQLite semantic and lexical fallback paths apply the same project/subject behavior as Qdrant.
- [x] Reconciliation and subject/ticket agent retrieval pass the current subject ID; callers without subject context remain project-scoped.
- [x] Existing storage, API, agent, and worker tests plus relevant typechecks pass.

## Out Of Scope

- Separate Qdrant collections per project or subject.
- Backfilling vectors through a new user-facing command; existing points may be rebuilt using the established rebuild path or a follow-up task.
- Changing embedding models, chunking, ranking algorithms, or project isolation semantics.

## Open Questions

None blocking. The subject identifier is the existing subject/ticket ID, and array-valued metadata is required because snapshot deduplication permits multiple subject references.
