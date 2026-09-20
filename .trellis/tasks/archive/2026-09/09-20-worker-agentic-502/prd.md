# Investigate worker agentic pipeline 502

## Goal

Explain the reported Cloudflare `origin_bad_gateway` response end to end, distinguish an API/Redis origin failure from an LLM gateway failure, and prepare the smallest safe fix that keeps adjustment requests asynchronous and observable.

## Background And Confirmed Facts

- Adjustment uploads are handled by `POST /api/projects/:projectId/tickets/:ticketKey/adjustments` in `apps/api/src/routes.ts:122`.
- The API persists the source and an `adjustment_jobs` row, then calls `enqueueAdjustment` before returning `202` (`apps/api/src/routes.ts:179-230`).
- `apps/api/src/index.ts:84-90` creates a BullMQ queue using `TRACHEX_REDIS_URL`; `packages/worker/src/index.ts:13-20` creates a new Redis connection and queue for each enqueue.
- The Compose API environment always sets `TRACHEX_REDIS_URL=redis://redis:6379` (`docker-compose.yml:27`), while both `redis` and `worker` are restricted to the `local` profile (`docker-compose.yml:34-66`).
- The worker is not an HTTP origin. It consumes `{ adjustmentJobId }`, loads the shared SQLite record/source, and calls the agent pipeline (`packages/worker/src/worker.ts:51-106`).
- Agent requests use the configured OpenAI-compatible `OPENAI_BASE_URL` through `@anvia/openai` (`packages/agent/src/factory.ts:43-65`). The client calls `chat.completions.create` at the provider boundary (`packages/agent/node_modules/@anvia/openai/dist/index.js:157-177`).
- The parent `assignment-w6d2-final` uses the same `OpenAIClient({ apiKey, baseUrl })` configuration (`../assignment-w6d2-final/packages/agents/src/providers/openai.ts:1-9`) and successfully runs the agent through `.session().prompt().stream()` (`../assignment-w6d2-final/apps/api/src/modules/chat/router.ts:24-45`). This confirms the gateway URL/key wiring pattern is valid, but does not prove all request shapes are accepted.
- This project uses `agent.generate()` (`packages/agent/src/factory.ts:61-69`), which invokes the non-streaming `model.completion()` path. Its request includes tools, strict JSON-schema `response_format`, and up to five turns (`packages/agent/src/factory.ts:48-58`; `packages/agent/node_modules/@anvia/openai/dist/index.js:157-164`, `221-229`). The parent example streams a plain conversational request and does not establish compatibility with this structured multi-turn request shape.
- Provider errors matching `502`, `503`, `504`, Cloudflare, or gateway text are retried three times (`packages/agent/src/retry.ts:1-18`). Exhausted worker failures are persisted as failed jobs; they are not returned from the upload request (`packages/worker/src/worker.ts:95-105`).
- Dashboard chat is a separate synchronous streamed HTTP path (`apps/api/src/chat.ts:73-145`) and can expose provider latency/failure directly to Cloudflare.

## Requirements

- Produce a stage-by-stage diagnosis covering dashboard request, API persistence, Redis enqueue, BullMQ worker execution, agent/tool calls, provider gateway response, retry behavior, and dashboard polling.
- Identify the deployment conditions under which the API can block or fail before returning `202`, especially Redis/worker profile and hostname availability.
- Identify the conditions under which a provider Cloudflare 502 is expected to appear only in worker logs/job state versus the synchronous chat response.
- Keep the investigation scoped to `packages/worker`, its API queue boundary, and the shared agent/provider boundary. Do not redesign the agent or replace the gateway without evidence.
- If code changes are approved, make failures bounded and diagnosable without falsely reporting a queued job or mutating canonical requirements.
- Agent-generated impact claims must be source-grounded: API/page values are allowed only when their exact value appears in the uploaded source, and repeated kind/value pairs must be removed before proposal persistence.

## Out Of Scope

- Proving gateway health from this repository alone; that requires gateway access/logs and the exact request payload.
- Changing provider/model selection, prompt content, or vector retrieval behavior without a reproduced provider-level failure.
- Adding a new queue technology or synchronous fallback for adjustment reconciliation.

## Acceptance Criteria

- [ ] The final diagnosis names the exact request path and boundary responsible for the reported 502, or clearly separates multiple plausible paths with evidence and required runtime checks.
- [ ] The end-to-end sequence includes file/line anchors and explains why a worker-side provider 502 should not normally become the adjustment upload HTTP response.
- [ ] The diagnosis explicitly checks whether Redis and the worker are running in the deployed environment, not only whether the gateway is healthy.
- [ ] The diagnosis compares the successful parent gateway call with this worker's non-streaming structured-output/tool request and identifies whether the gateway supports that request shape.
- [ ] The plan includes bounded Redis connection/enqueue failure behavior and actionable logs/job state if remediation is needed.
- [ ] Typecheck and focused API/worker tests are identified for verification; no implementation starts until the planning summary is approved.
- [ ] Deterministic evals reject inferred API/page impacts and duplicate impact values while accepting unique source-supported impacts.
