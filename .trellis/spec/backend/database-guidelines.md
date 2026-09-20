# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

Canonical storage is **SQLite via `better-sqlite3`** (ADR 001), implemented in
`packages/storage-sqlite`. Domain code (`packages/domain`) defines repository
interfaces and never sees SQLite types. A future PostgreSQL adapter must
implement the same domain contract; SQLite and PostgreSQL are never dual
authorities.

Connection manager (`src/connection.ts`):

- WAL journal mode (`journal_mode = WAL`) — concurrent CLI/dashboard access.
- `foreign_keys = ON`.
- `busy_timeout` (default 5000ms).
- Versioned migrations applied on open (`migrate(db)`), idempotent.

## Query Patterns

- Synchronous `better-sqlite3` prepared statements; never string-concatenate
  user input into SQL.
- Repository methods return domain entities via `*FromRow` mappers
  (`src/repositories.ts`); column names snake_case, entity fields camelCase.
- Batch writes use a single `db.transaction(...)` (e.g. `SqliteChunkRepository.insertMany`).
- No transaction is ever held across an LLM call; domain services call
  repositories per step (short transactions).

## Migrations

- `src/migrations.ts` exports an ordered `Migration[]` (`{ version, name, sql }`)
  and `SCHEMA_VERSION`.
- The runner creates `schema_migrations` itself — **do not** create that table
  inside a migration's SQL (duplicate-table error).
- Each migration is applied once; `migrate()` skips already-applied versions.
- FTS5 virtual tables (`chunks_fts`) are created in migrations and kept in sync
  with triggers (`chunks_fts_ai` / `chunks_fts_ad`).

## Naming Conventions

- Tables: plural snake_case (`projects`, `repository_paths`, `completion_audits`).
- Columns: snake_case (`created_at`, `lifecycle_status`, `dev_status`).
- IDs: `TEXT PRIMARY KEY` UUIDs (`crypto.randomUUID()`).
- Timestamps: ISO-8601 UTC strings (`TEXT`), not `DATETIME`.
- Uniqueness: `projects.slug` globally unique; `tickets.key` unique per
  `(project_id, key)`; `subjects.name` unique per `(project_id, name)`;
  `repositories.slug` unique per `(project_id, slug)` with `project_id` nullable
  for global per-user entries (migration v6); `proposal_versions(proposal_id, version)`.
- Subjects (migration v5): `subjects` rows have a generated immutable ID and a
  display name. `createSubject` also creates the backing checklist ticket with
  `ticket.id = subject.id`, `key = subject.id`, `title = subject.name` so the
  subject and its checklist share one identity.
- Checklist tree (migration v5): `requirements.parent_id` references another
  `requirements(id)`; the domain validates the parent belongs to the same ticket
  and is `active`. `display_order` (migration v2) is the explicit sibling order,
  backfilled by `(created_at, id)`; reads order by `display_order, created_at`.
  New requirements append via `nextDisplayOrder` (max + 1).
- Subject↔repository assignment (migration v6): `subject_repositories` is a
  many-to-many join keyed `(subject_id, repository_id)`. Repositories are a
  global per-user registry (`repositories.project_id` nullable) reusable across
  projects/subjects. Deleting a repository first clears its `subject_repositories`
  rows, `repository_paths`, and nulls `snapshots.repository_id` because
  `foreign_keys = ON`.
- Provenance: `completion_audits.action` (migration v3) distinguishes
  `check` | `uncheck`; `sources.note` (migration v4) records the human's
  reason for a manual add/edit. Human edits are direct but append-only:
  `editRequirementContent` supersedes the old requirement and creates a new one
  at the same `display_order` with a fresh `manual` source; content is never
  rewritten in place.
- `SCHEMA_VERSION` is bumped with each migration (current: 11).

## Project/Subject Edit, Delete, and Adjustment Queue Metadata (Phase 7)

### 1. Scope / Trigger

The dashboard edits project/subject names and slugs, deletes them behind
exact-name confirmation, and shows a rich adjustment queue. This requires
code-spec depth because it spans domain services, API validation, a schema
migration, and FK-safe cascade deletion.

### 2. Signatures

- Domain: `updateProject(uow, { projectId, name?, slug? })`,
  `deleteProject(uow, { projectId, confirmName })`,
  `updateTicket(uow, { ticketId, title?, key? })`,
  `deleteSubjectByTicket(uow, { ticketId, confirmName })`.
- Repository: `TicketRepository.permanentDelete?(id, force)` (optional, like
  the project/subject variants).
- SQLite cascade helpers in `packages/storage-sqlite/src/repositories.ts`:
  `deleteSessionRows`, `deleteAdjustmentJobRows`, `deleteRequirementRows`,
  `deleteProposalRows`, plus `deleteAgentScopedRows` for subject-scoped
  `review_findings` / `agent_runs` / `evidence_references`.
- Migration 11 `adjustment-job-file-metadata`: `ALTER TABLE adjustment_jobs
  ADD COLUMN file_name TEXT` and `ADD COLUMN file_kind TEXT` (nullable, so
  existing rows upgrade without data loss).
- API canvas projection: `adjustmentJobDetails` joins each job to its
  `sources` row; `adjustmentJobs` is kept unchanged for compatibility.

### 3. Contracts

- Update requests accept partial `{ name?, slug? }` / `{ title?, key? }` and
  return the updated row; slug/key renames check uniqueness and raise
  `ConflictError` on collision.
- Delete requests carry `{ confirmName }` matching the exact displayed name.
  A mismatch raises `InvalidOperationError` (mapped to HTTP 400), never a
  silent delete.
- `deleteSubjectByTicket` prefers the subject cascade when a subject row
  shares the ticket id, and falls back to the ticket-level cascade so both
  dashboard-created tickets and CLI/TUI-created subjects delete cleanly.
- Cascade order inside one transaction: agent-scoped rows, session rows
  (messages, then session- and proposal-linked errors, then sessions),
  adjustment jobs, requirements (audits/impacts/scenarios, then
  relationships, then requirements), proposals (versions, then proposals),
  sources, export artifacts, ticket, subject where applicable.
- Canvas response keeps `checklist` active-only and adds `superseded` plus
  `adjustmentJobDetails`; old proposals without order data stay reviewable.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Slug/key rename collides | `ConflictError` (HTTP 409) |
| Delete `confirmName` mismatches | `InvalidOperationError` (HTTP 400) |
| Delete target missing | `NotFoundError` (HTTP 404) |
| `permanentDelete` without `force` | storage throws before touching rows |
| Stale/unknown agent order ids | filtered to still-active seen rows; approval proceeds on the valid subset |

### 5. Good/Base/Bad Cases

- Good: delete chats/messages before sessions in one transaction so
  `foreign_keys = ON` never trips on orphaned `messages.session_id`.
- Base: nullable `file_name`/`file_kind` columns; old jobs render "No file
  attached" instead of failing.
- Bad: deleting sessions before messages, or sources before adjustment jobs
  that reference them; both violate declared FK references.

### 6. Tests Required

- Domain: exact-name delete rejection, rename uniqueness, approval applies
  the agent order before appending new rows.
- Agent schema: `proposedOrder` parses with rationale/uncertainty; missing
  rationale is rejected.
- API: PATCH/DELETE project and ticket, reorder persistence, canvas returns
  `superseded` and `adjustmentJobDetails`, multipart upload records
  `fileName`/`fileKind`.
- SQLite: migrations apply idempotently; cascade leaves no orphaned
  messages, errors, jobs, or agent-scoped rows.

### 7. Wrong vs Correct

#### Wrong

```typescript
await db.prepare('DELETE FROM sessions WHERE ticket_id = ?').run(ticketId);
```

#### Correct

```typescript
deleteSessionRows(db, ticketId); // messages, then errors, then sessions
```

The correct path clears every dependent row before its parent inside the
same transaction, so the FK pragma enforces intent instead of failing it.

## Common Mistakes

- **Duplicate `schema_migrations` in a migration**: the runner already creates
  it; including it in migration SQL fails with "table schema_migrations already
  exists".
- **Parameter properties in classes**: `constructor(private readonly db) {}`
  is rejected by `erasableSyntaxOnly`; declare the field explicitly.
- **`node --test` on raw `.ts`**: needs Node >= 22.18; use `tsx --test` so the
  Node 20+ floor holds.
- **Platform-specific path assertions**: `node:path` `join` uses the host
  separator; assert `startsWith`/`endsWith` for cross-platform tests.

## Source ingestion & retrieval (Phase 2)

- `ingestSource` (domain) orchestrates snapshot + chunks + source via the
  UnitOfWork; it takes a `writeSnapshotFile` callback so the domain stays free
  of filesystem specifics. `ingestFile` (storage-sqlite) writes snapshot
  content under `sources/<snapshotId>` and delegates to it.
- Immutability: re-ingesting changed content creates a NEW snapshot (new hash)
  and preserves the old; identical content reuses the snapshot via
  `findByProjectAndHash` (dedup) but still records a new `Source` row.
- Chunk ids are content-addressed: `sha256(relPath:index:text)` — deterministic
  and stable across re-ingestion and Qdrant rebuilds.
- Search contract: `SearchRepository.search(query, projectId, limit)` returns
  `{ chunkId, snapshotId, projectId, content, location, relPath, score }`.
  FTS5 is the default adapter; Qdrant is derived and rebuilt per-chunk with the
  same chunk ids (`rebuildQdrantFromSnapshots`). Never let Qdrant become the
  canonical store (ADR 001).

## Evidence References & Baselines (Phase 3)

### 1. Scope / Trigger

Cross-layer evidence intake and coding-agent context require a persisted,
subject-scoped reference that can be read by the domain, SQLite adapter, TUI,
and MCP without exposing provider details or making retrieval indexes
canonical.

### 2. Signatures

- Domain repository: `evidenceReferences.create(reference)` and
  `evidenceReferences.listBySubject(subjectId)`.
- SQLite table: `evidence_references` stores `id`, `subject_id`, `source_id`,
  `source_type`, `attribution`, `location`, `excerpt`, `retrieval_metadata`,
  `repository_scope`, and `created_at`.
- Baseline projection: `buildSubjectBaseline(subjectId, projectId)` returns
  the scoped checklist, active/history records, sources, evidence references,
  repository scope, pending proposals, impacts, scenarios, open questions, and
  review findings.
- MCP read tool: `get_subject_baseline` accepts a subject identifier and
  project scope, then returns the structured baseline without mutation tools.

### 3. Contracts

- Evidence references are append-only provenance records. `source_id` points
  to the canonical source when available; URL content is represented by its
  fetched snapshot metadata, not by a live URL lookup.
- `repository_scope` is the selected repository scope at intake time and must
  not be inferred from the caller's current working directory.
- Baseline responses are read-only projections. They may include archived and
  superseded history, but must distinguish it from active checklist state.
- MCP handlers enforce project ownership before returning a baseline and use
  the existing structured tool-result/error envelope.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Subject is missing | `NOT_FOUND` domain/MCP error |
| Subject belongs to another project | `SCOPING` error |
| Evidence reference has no subject | reject before persistence |
| URL evidence has no fetch/snapshot metadata | reject as incomplete provenance |
| Baseline read | no canonical mutation |

### 5. Good/Base/Bad Cases

- Good: persist the fetched URL snapshot status and retrieval timestamp, then
  cite the evidence reference from the baseline.
- Base: persist a note or local-file reference with its attribution and
  location, even when no source row exists yet.
- Bad: store only a live URL or return evidence from a subject selected without
  validating its project ownership.

### 6. Tests Required

- Migration/integration test asserts the evidence-reference table is created
  and survives a write/read round trip.
- Repository test asserts `listBySubject` does not return another subject's
  references.
- MCP test asserts baseline registration, project scoping, and read-only
  response shape.
- Baseline test asserts active checklist, history, evidence, and repository
  scope remain separate fields.

### 7. Wrong vs Correct

#### Wrong

```typescript
return fetch(reference.location);
```

#### Correct

```typescript
return evidenceReferences.listBySubject(subjectId);
```

The correct path reads the persisted snapshot/provenance record and keeps the
baseline deterministic, auditable, and independent of a live remote resource.
