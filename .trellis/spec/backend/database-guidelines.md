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
  `(project_id, key)`; `repositories.slug` unique per `(project_id, slug)`;
  `proposal_versions(proposal_id, version)`.

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
