# Investigation And Remediation Plan

1. Confirm the failing route from the timestamp/request: adjustment upload, dashboard chat, or a direct provider call.
2. Inspect deployed process topology: API, Redis endpoint, worker process, shared `TRACHEX_HOME`/SQLite volume, `TRACHEX_REDIS_URL`, `OPENAI_BASE_URL`, and queue name.
3. Compare the parent assignment's successful streamed request with this worker's non-streaming structured-output/tool request, including the actual model and endpoint path.
4. Correlate logs by adjustment job id and Ray ID: API enqueue start/end, worker processing start/end, provider status/body metadata, retry attempts, and terminal job state.
5. Reproduce the API boundary with Redis unavailable and with a healthy Redis but stopped worker; verify the upload returns a bounded actionable error or `202` respectively.
6. If approved, implement only the confirmed fix: bounded Redis enqueue behavior, gateway request compatibility, or both. Do not change the gateway URL/model speculatively.
7. Add focused tests for enqueue success, Redis/enqueue failure, provider 502 retry exhaustion, and separation of `202` upload response from worker terminal failure.
8. Run validation:

```bash
pnpm --filter @trachex/worker typecheck
pnpm --filter @trachex/api typecheck
pnpm --filter @trachex/agent test
pnpm --filter @trachex/api test
pnpm exec biome check apps/api/src packages/agent/src packages/worker/src
docker compose config
```

Risky boundaries: `apps/api/src/index.ts`, `apps/api/src/routes.ts`, `packages/worker/src/index.ts`, `packages/worker/src/worker.ts`, `packages/agent/src/retry.ts`, and `docker-compose.yml`.
