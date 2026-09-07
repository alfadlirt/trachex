# Phase 4: CLI — Implement

## Execution order

1. `packages/cli` deps: add `@trachex/domain`, `@trachex/storage-sqlite`, `@trachex/agent` workspace deps.
2. `src/errors.ts` (CliError + exit codes) + `src/io.ts` (print/printJson/prompt).
3. `src/args.ts` (parseArgs helpers) + `src/context.ts` (active project) + tests.
4. `src/export.ts` (Markdown + JSON serializers) + tests.
5. `src/commands/*.ts` (project, context, ticket, adjustment, proposal, check, export, infra/dashboard/mcp stubs).
6. `src/index.ts` router wiring everything.
7. `src/commands.test.ts` end-to-end workflow test (temp app dir + SQLite + `--no-agent` fixture).
8. Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test` green.

## Validation commands

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Acceptance review checklist

- [ ] Full MVP workflow via CLI (project → repo → ticket new → approve → check → export).
- [ ] No command requires repo CWD; `--project` from any dir; active shortcut works.
- [ ] Markdown matches PRD structure; JSON equivalent.
- [ ] Proposal review interactive/`--json`/non-interactive.
- [ ] Consistent exit codes + machine-readable errors.
- [ ] `ticket new` never silently approves.

## Review gate

Run trellis-check; then finish (spec update + commit + archive).

## Rollback

Revert phase-4 commit(s); Phases 1-3 base stays.
