# Phase 1: Global Registry and SQLite Foundation — Implement

## Execution order

1. Add `better-sqlite3` (+ `@types/better-sqlite3`) to `packages/storage-sqlite`; `pnpm install`.
2. `packages/shared/src/paths.ts` — `trachexAppDir(env?)` + `projectDir(appDir, projectId)`; unit tests.
3. `packages/domain`:
   - `src/entities.ts`, `src/ids.ts`, `src/errors.ts`
   - `src/repositories.ts` (interfaces)
   - `src/services.ts` (domain service interfaces + commands)
   - unit tests for invariants (append-only supersession, proposal lifecycle, completion audit, uniqueness via a fake repo).
4. `packages/storage-sqlite`:
   - `src/connection.ts` + `src/migrations.ts` (v1 schema)
   - `src/repositories/*.ts` (all domain interfaces)
   - `src/search.ts` (FTS5 schema + search repo)
   - `src/archive.ts` (export/import)
   - `src/index.ts` barrel
5. Integration tests in `packages/storage-sqlite` (temp dir via `TRACHEX_HOME`/tmp): migrations idempotent, restart survival, two-connection concurrency, uniqueness, archive round-trip.
6. Wire `packages/cli` minimal smoke? Not required — CLI is Phase 4. Keep Phase 1 to domain+storage.
7. Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test` green.

## Validation commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

## Acceptance review checklist

- [ ] Multi-repo project persists and reloads.
- [ ] Ticket survives restart.
- [ ] Two connections read/write under WAL.
- [ ] Archive round-trips without secrets.
- [ ] Slug/ticket-key uniqueness enforced.
- [ ] No SQLite types in `packages/domain`.

## Review gate

Run trellis-check after implementation; then finish (spec update + commit + archive).

## Rollback

Revert the phase-1 commit(s); Phase 0 base stays.
