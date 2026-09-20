# Implementation Plan

1. Inspect runtime composition, repositories, migrations, adjustment API tests, and dashboard state.
2. Add BullMQ/Redis configuration, Compose Redis service, queue boundary, and worker command.
3. Add adjustment-job persistence, active-job uniqueness, status transitions, and proposal linkage.
4. Refactor adjustment submission to persist/enqueue and return `202`.
5. Implement idempotent worker processing, retries/backoff, success, and failure transitions.
6. Add job list/status/retry API endpoints with ticket scoping and conflict behavior.
7. Update dashboard composer/canvas with processing cards, polling, completed proposal links, failure messages, and retry action.
8. Add deterministic API/storage/worker tests for acceptance, duplicate blocking, success, failure, retry, idempotency, and Redis-unavailable behavior.
9. Run focused lint, typecheck, API/storage/worker/dashboard tests, Compose config validation, and dashboard build.

## Validation

```bash
pnpm exec biome check apps/api/src apps/dashboard/src packages/domain/src packages/storage-sqlite/src packages/worker/src
pnpm typecheck
pnpm --filter @trachex/api test
pnpm --filter @trachex/storage-sqlite test
pnpm --filter @trachex/dashboard test
pnpm --filter @trachex/dashboard build
docker compose config
```

## Risky Files

- `apps/api/src/routes.ts`
- `apps/api/src/context.ts`
- `apps/api/src/routes.test.ts`
- `apps/dashboard/src/lib/api.ts`
- `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx`
- `packages/domain/src/repositories.ts`
- `packages/storage-sqlite/src/migrations.ts`
- `docker-compose.yml`
- workspace/package manifests

## Explicitly Not Doing

- No WebSockets/SSE.
- No hosted Redis or queue orchestration.
- No concurrent adjustment jobs per ticket.
- No automatic proposal approval or canonical requirement mutation.
