# Phase 3: Anvia Agent and Proposal Pipeline — Implement

## Execution order

1. `packages/agent` deps already added: `@anvia/core@1.1.2`, `@anvia/openai@1.1.2`, `@anvia/memory-sqlite@1.1.2` (will NOT be used — see design), `@anvia/lens@1.1.2`, `@anvia/logger@1.1.2`, `zod`. Add `@trachex/domain`, `@trachex/shared`, `@trachex/storage-sqlite` workspace deps + `better-sqlite3` for the memory store.
2. `src/provider.ts` + `src/provider.test.ts`.
3. `src/schemas.ts` + `src/schemas.test.ts` (Zod extraction/reconciliation schemas).
4. `src/prompts.ts`.
5. `src/memory.ts` + `src/memory.test.ts` (BetterSqliteMemoryStore).
6. `src/observability.ts`.
7. `src/factory.ts` (createTrachexAgent with search_context tool).
8. `src/pipeline.ts` + `src/pipeline.test.ts` (runExtraction/runReconciliation with injectable runAgent; failure handling writes ErrorRecord).
9. `src/index.ts` barrel.
10. Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test` green.

## Validation commands

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Acceptance review checklist

- [ ] runExtraction creates source + pending extraction proposal.
- [ ] runReconciliation creates source + pending reconciliation proposal.
- [ ] Agent has no approve/check/apply tools; proposals persisted by pipeline only.
- [ ] Malformed/failed output writes ErrorRecord, ticket intact, no requirements created.
- [ ] Provider config env override works.
- [ ] Contract tests with mocked agent pass.

## Review gate

Run trellis-check; then finish (spec update + commit + archive).

## Rollback

Revert phase-3 commit(s); Phase 2 base stays.
