# Phase 6: Local API and Bundled Dashboard — Implement

## Execution order

1. `apps/api` deps: `hono`, `@hono/node-server`, `zod`, `@trachex/domain`, `@trachex/storage-sqlite`, `@trachex/agent`.
2. `apps/api/src/validation.ts` + `src/errors.ts` + `src/routes.ts` + `src/chat.ts` + `src/index.ts` (`createApp`, `startDashboard`).
3. `apps/api/src/routes.test.ts` — route tests (create project/ticket, canvas, approve/reject/check, export, chat JSONL).
4. `apps/dashboard` — Vite + React 19 + TanStack Router + Tailwind v4 scaffold; `src/lib/api.ts`, `src/lib/utils.ts`, `src/modules/*`, `src/components/ui/*`.
5. Ticket canvas page (checklist + proposals + panels + adjustment + chat drawer + export).
6. Wire CLI `dashboard` command to `startDashboard`.
7. Build dashboard (`pnpm --filter @trachex/dashboard build`) and verify API serves it.
8. Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test` green.

## Validation commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @trachex/dashboard build
```

## Acceptance review checklist

- [ ] Dashboard works with SQLite and no Docker.
- [ ] Browser never accesses SQLite directly (only /api).
- [ ] Dashboard and CLI run concurrently (WAL).
- [ ] Completion is a deliberate human action (confirm dialog).
- [ ] Chat changes appear as pending proposals.
- [ ] API routes validate + structured errors.
- [ ] API tests pass.

## Review gate

Run trellis-check; then finish (spec update + commit + archive).

## Rollback

Revert phase-6 commit(s); Phases 1-5 base stays.
