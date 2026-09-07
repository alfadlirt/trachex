# Phase 1: Global Registry and SQLite Foundation — Design

## Driver choice

`better-sqlite3` (synchronous API, WAL, `busy_timeout`, foreign keys). Chosen over `node:sqlite` (built-in) because `node:sqlite` requires Node >= 22.5 and the documented engine floor is Node 20+. Native build is pre-approved in `pnpm-workspace.yaml` (`allowBuilds: better-sqlite3`).

## Package responsibilities

- `packages/domain` (new real content):
  - `src/entities.ts` — Project, Repository, RepositoryPath, Ticket, Source, Snapshot, Chunk, Requirement, RequirementRelationship, Impact, Scenario, Proposal, ProposalVersion, CompletionAudit, Session, Message, ErrorRecord, ExportArtifact.
  - `src/ids.ts` — id generation (UUID) + typed id helpers.
  - `src/repositories.ts` — repository interfaces (ProjectRepository, RepositoryRepository, TicketRepository, SourceRepository, SnapshotRepository, RequirementRepository, ProposalRepository, CompletionAuditRepository, SessionRepository, ExportRepository, SearchRepository).
  - `src/services.ts` — domain service interfaces + command functions (project/ticket/source creation, proposal lifecycle, requirement append-only + supersession, completion, export).
  - `src/errors.ts` — domain error types (NotFound, Conflict, InvalidOperation, ScopingError).
  - No SQLite or platform types here.
- `packages/storage-sqlite`:
  - `src/connection.ts` — open DB, apply pragmas (WAL, foreign_keys, busy_timeout), run migrations.
  - `src/migrations.ts` — versioned migration list (schema version 1), idempotent.
  - `src/repositories/*.ts` — SQLite implementations of domain interfaces.
  - `src/search.ts` — FTS5 table + search repository (schema + basic query; full ingestion is Phase 2).
  - `src/archive.ts` — export/import with manifest + schema version.
  - `src/index.ts` — barrel + `openTrachexDatabase(appDir)`.
- `packages/shared`:
  - `src/paths.ts` — `trachexAppDir(env?)` platform resolver + `projectDir(appDir, projectId)`.

## Schema (v1) — key tables

- `projects(id TEXT PK, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `repositories(id TEXT PK, project_id TEXT NOT NULL REFERENCES projects(id), slug TEXT NOT NULL, service_name TEXT, url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_id, slug))`
- `repository_paths(id TEXT PK, repository_id TEXT NOT NULL REFERENCES repositories(id), path TEXT NOT NULL, valid_from TEXT NOT NULL, valid_to TEXT)`
- `tickets(id TEXT PK, project_id TEXT NOT NULL REFERENCES projects(id), key TEXT NOT NULL, title TEXT NOT NULL, description TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_id, key))`
- `snapshots(id TEXT PK, project_id TEXT NOT NULL REFERENCES projects(id), repository_id TEXT REFERENCES repositories(id), rel_path TEXT NOT NULL, content_hash TEXT NOT NULL, content_kind TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL)`
- `sources(id TEXT PK, ticket_id TEXT NOT NULL REFERENCES tickets(id), type TEXT NOT NULL, attribution TEXT, source_event_at TEXT, ingested_at TEXT NOT NULL, snapshot_id TEXT REFERENCES snapshots(id), location TEXT)`
- `chunks(id TEXT PK, snapshot_id TEXT NOT NULL REFERENCES snapshots(id), chunk_index INTEGER NOT NULL, content TEXT NOT NULL, location TEXT, created_at TEXT NOT NULL)`
- `requirements(id TEXT PK, project_id TEXT NOT NULL REFERENCES projects(id), ticket_id TEXT NOT NULL REFERENCES tickets(id), title TEXT NOT NULL, description TEXT, source_id TEXT REFERENCES sources(id), source_location TEXT, lifecycle_status TEXT NOT NULL DEFAULT 'active', dev_status TEXT NOT NULL DEFAULT 'unchecked', parent_label TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `requirement_relationships(id TEXT PK, from_requirement_id TEXT NOT NULL REFERENCES requirements(id), to_requirement_id TEXT NOT NULL REFERENCES requirements(id), type TEXT NOT NULL DEFAULT 'supersedes', created_at TEXT NOT NULL)`
- `impacts(id TEXT PK, requirement_id TEXT NOT NULL REFERENCES requirements(id), kind TEXT NOT NULL, value TEXT NOT NULL, created_at TEXT NOT NULL)`  (kind: service | api | page)
- `scenarios(id TEXT PK, requirement_id TEXT NOT NULL REFERENCES requirements(id), text TEXT NOT NULL, reviewed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`
- `proposals(id TEXT PK, ticket_id TEXT NOT NULL REFERENCES tickets(id), kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', source_id TEXT REFERENCES sources(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `proposal_versions(id TEXT PK, proposal_id TEXT NOT NULL REFERENCES proposals(id), version INTEGER NOT NULL, model_output TEXT NOT NULL, edited_output TEXT, reviewed_at TEXT, created_at TEXT NOT NULL, UNIQUE(proposal_id, version))`
- `completion_audits(id TEXT PK, requirement_id TEXT NOT NULL REFERENCES requirements(id), actor_type TEXT NOT NULL, actor_id TEXT, note TEXT, checked_at TEXT NOT NULL)`
- `sessions(id TEXT PK, project_id TEXT REFERENCES projects(id), ticket_id TEXT REFERENCES tickets(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `messages(id TEXT PK, session_id TEXT NOT NULL REFERENCES sessions(id), role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)`
- `errors(id TEXT PK, session_id TEXT REFERENCES sessions(id), proposal_id TEXT REFERENCES proposals(id), message TEXT NOT NULL, stack TEXT, created_at TEXT NOT NULL)`
- `export_artifacts(id TEXT PK, project_id TEXT NOT NULL REFERENCES projects(id), ticket_id TEXT REFERENCES tickets(id), format TEXT NOT NULL, path TEXT NOT NULL, created_at TEXT NOT NULL)`
- FTS5: `chunks_fts` virtual table over chunks (content + provenance columns), kept in sync with triggers.

Timestamps stored as ISO-8601 UTC strings. All ids are UUIDs (`crypto.randomUUID()`).

## Append-only / invariants (domain enforcement)

- Requirements are never updated in place for content changes; a change is a new requirement + `supersedes` relationship (ADR 003). `lifecycle_status` moves to `superseded` on the old row.
- Proposal `status`: pending -> approved | rejected. Versions immutable; editing inserts a new version row.
- Completion is a `completion_audits` insert; `dev_status` flips to `checked` only via the domain command that also writes the audit.

## Archive format

- Export writes `manifest.json` (schema_version, exported_at, project record, repositories, tickets, sources, requirements, relationships, impacts, scenarios, proposals + versions, completion audits, export artifacts) plus snapshot content files copied under `sources/`.
- Import validates `schema_version`, restores rows, and writes snapshot files back.
- Secrets: none are stored in the DB, so the archive contains none by construction. Archive import is a fresh insert (ids preserved).

## Concurrency

- WAL mode + `busy_timeout` (e.g. 5000ms). Each domain service call opens short transactions. No transaction is held across an LLM call (agent phase will call services per step, not inside a transaction).

## Tests

- `connection`/`migrations`: applying migrations twice is safe; pragmas set.
- `project`/`ticket`: create project with 2 repos, create ticket, close DB, reopen, read back (restart survival).
- concurrency: two connections write/read under WAL.
- uniqueness: duplicate project slug fails; duplicate ticket key within a project fails; same ticket key in another project succeeds.
- archive: export -> import -> compare; assert no secret-shaped content.

## Rollout / rollback

- Phase 1 adds real code on top of the Phase 0 base commit. Failure = revert the phase-1 commit(s); no later phase depends yet.
