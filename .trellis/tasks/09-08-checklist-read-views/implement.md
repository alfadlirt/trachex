# Read views — Implement

## Execution order

1. `packages/domain`: add `displayOrder` to `Requirement`; add `listSupersededByTicket` to the repository interface.
2. `packages/storage-sqlite`: migration v2 (column + backfill), `SCHEMA_VERSION` 2; update `requirementFromRow`; order active/superseded reads by `display_order`; implement `listSupersededByTicket`. Integration test: v2 backfill preserves order + idempotent re-migrate.
3. `packages/domain`: `buildProjectStatus` + `buildChecklistView` services; domain unit tests.
4. `packages/cli`: `src/commands/status.ts`, `src/commands/checklist.ts`; wire `status` and `checklist list` in the router + `--help`; CLI tests (default render + `--json`).
5. Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm eval` green.

## Validation commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm eval
pnpm run trachex status --project <slug>            # or after project use
pnpm run trachex checklist list TICKET-X --project <slug>
```

## Acceptance review checklist

- [ ] Migration v2 additive + backfills; re-migrate idempotent.
- [ ] Ordered reads (active + superseded) via `display_order`.
- [ ] `trachex status` rollup correct (default + `--json`).
- [ ] `trachex checklist list` grouped tree + chips + struck-through superseded (default + `--json`).
- [ ] Full test/lint/typecheck/eval green.

## Review gate

Run trellis-check; then finish (spec update + commit + archive). Edit-commands child starts after this.

## Rollback

Revert child commit(s); MVP base stays.
