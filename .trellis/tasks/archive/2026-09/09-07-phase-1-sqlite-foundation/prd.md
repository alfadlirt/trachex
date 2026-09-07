# Phase 1: Global Registry and SQLite Foundation

## Goal

Implement the storage foundation: platform-specific application-directory resolver, SQLite connection manager (WAL, foreign keys, enabled, busy timeout, versioned migrations), the full schema from `docs/architecture.md`, domain repository interfaces + SQLite implementations, uniqueness constraints, and archive export/import.

Source of truth: `docs/implementation-plan.md` Phase 1, `docs/architecture.md` Domain Model + Storage Adapters + Global Application Layout, ADR 001/002.

## Requirements

- Platform-specific application-directory resolver (macOS `~/Library/Application Support/trachex`, Linux `~/.local/share/trachex`, Windows `%APPDATA%/trachex`), with a test/CI override (e.g. `TRACHEX_HOME`).
- SQLite connection manager:
  - WAL journal mode
  - foreign keys enabled
  - busy timeout configured
  - versioned migrations applied on startup / explicit command
  - no transaction held while waiting for an LLM (enforced by API shape, not a DB feature)
- Schema covering: projects, repositories (+ path history), tickets, sources, snapshots, chunks, requirements, requirement relationships, impacts, scenarios, proposals, proposal versions, completion audits, sessions, messages, errors, export artifacts.
- Domain repository interfaces (in `packages/domain`) and SQLite implementations (in `packages/storage-sqlite`). Domain never exposes SQLite types (ADR 001).
- Project slug and ticket-key uniqueness constraints (project slug globally unique; ticket key unique within project).
- Domain service interfaces for the vertical slice: project/ticket/source creation, proposal lifecycle, requirement append-only + supersession, human completion, export.
- Archive export/import with manifest and schema version, excluding secrets (ADR 001/002 portability).
- Unit + integration tests: migrations, project/ticket persistence across a process restart (reopen), concurrent read/write (two connections), archive round-trip without secrets.

## Acceptance Criteria

- [ ] A project can contain multiple repositories.
- [ ] A project and ticket survive process restart (reopen the DB and read them back).
- [ ] Two processes/connections can read/write safely under normal short transactions (WAL + busy timeout).
- [ ] Project archive round-trips without secrets (export -> import -> identical data; no secret material in archive).
- [ ] Project slug uniqueness and ticket-key-per-project uniqueness enforced.
- [ ] Domain repository interfaces are implemented by SQLite; no SQLite types appear in `packages/domain`.
- [ ] Migrations are versioned and idempotent (applying twice is safe).

## Dependency order

- Depends on Phase 0 (workspace, toolchain). Phase 2+ depend on this task's acceptance criteria passing.

## Notes

- SQLite driver: `better-sqlite3` (synchronous, WAL, busy_timeout, Node 20+ compatible). Native build is allowed via `pnpm-workspace.yaml` `allowBuilds`.
- Snapshot content files live under the global project directory (`projects/<id>/sources/`); the DB stores metadata + content hash + relative path. Immutable snapshots: re-ingestion creates a new row/file (Phase 2 owns ingestion; Phase 1 owns the schema + repositories).
- No provider secrets are stored in the DB; archive excludes anything secret-shaped by construction.
