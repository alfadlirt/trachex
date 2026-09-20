# Technical Design

## Scope Model

Use one Qdrant collection with payload filtering:

```text
project_id: string
subject_ids: string[]
snapshot_id: string
chunk_id: string
```

`subject_ids` is an array because snapshots are deduplicated at project/content level and may be referenced by multiple sources. A source's `ticket_id` is included only when it has the corresponding subject identity; legacy tickets without a subject remain project-level evidence.

## Data Flow

1. Ingestion persists or reuses a project snapshot and creates a source attached to the current subject/ticket.
2. Vector indexing queries each snapshot's source subject IDs and writes them into Qdrant payloads.
3. The search contract receives `projectId` plus an optional `subjectId`.
4. Subject-scoped search filters points whose `subject_ids` contains the requested ID.
5. If subject results do not fill the requested limit, search adds project-scoped results, deduplicated by chunk ID. Project-only evidence with an empty `subject_ids` array is eligible in this fallback.
6. Agent callers pass the current ticket/subject ID as retrieval context. Calls without it remain project-scoped.

## Contracts

Extend search without breaking the project boundary:

```ts
search(query: string, projectId: string, limit?: number, subjectId?: string): Promise<SearchResult[]>;
```

The exact parameter shape may be an options object if required by existing conventions, but project ID remains mandatory and subject ID remains optional. The agent tool exposes optional `subjectId` and the agent prompt identifies the current subject when available.

## Storage Behavior

- Qdrant payloads use `subject_ids: string[]`; Qdrant's array payload matching handles subject membership.
- SQLite vector and FTS paths use the same subject membership semantics. FTS metadata must be joined through `sources` and `subjects`, not duplicated as a second source of truth.
- Search results are deduplicated by `chunkId` when combining subject and project queries.

## Compatibility and Rollout

Existing Qdrant points without `subject_ids` remain project-searchable but are not eligible for subject filtering until rebuilt. Existing SQLite data remains valid. A rebuild/backfill of existing Qdrant points is a follow-up operational step; new ingestion writes the new payload field.

## Trade-offs

- One collection avoids collection proliferation and simplifies embedding/model migrations.
- Array payloads preserve shared snapshots without assigning a misleading single subject.
- Subject-first plus project fallback may return broader evidence when a subject has little indexed context, but avoids empty retrieval for shared project documentation.

## Risks

- A subject query against stale Qdrant points may miss subject metadata until those points are rebuilt.
- Combining two ranked result sets requires deterministic deduplication and must not let project fallback displace subject results before the subject scope is exhausted.
