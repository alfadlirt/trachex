# Phase 5: MCP — Implement

## Execution order

1. `packages/mcp` deps: `@modelcontextprotocol/sdk`, `zod`, `@trachex/domain`, `@trachex/storage-sqlite`, `@trachex/agent`.
2. `src/tools.ts` — tool registry (schemas + handlers) with scoping + confirmation.
3. `src/server.ts` — `createMcpServer` wiring tools/list + tools/call.
4. `src/run.ts` — `runMcpServer` stdio transport.
5. `src/index.ts` — barrel + `main`.
6. Wire CLI `mcp` command (replace stub) to `runMcpServer`.
7. `src/tools.test.ts` + `src/server.test.ts`.
8. Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test` green.

## Validation commands

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Acceptance review checklist

- [ ] get_baseline returns complete ticket context.
- [ ] add_adjustment creates pending reconciliation proposal.
- [ ] check_item requires confirm: true.
- [ ] Project scoping enforced (no cross-project access).
- [ ] All 11 tools registered with Zod schemas.
- [ ] Structured errors.

## Review gate

Run trellis-check; then finish (spec update + commit + archive).

## Rollback

Revert phase-5 commit(s); Phases 1-4 base stays.
