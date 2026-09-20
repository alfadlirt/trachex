# Worker Agentic 502 Investigation Design

## Boundaries And Data Flow

```text
Dashboard adjustment upload
  -> API parses upload and writes source + adjustment_jobs(queued)
  -> API creates BullMQ queue connection using TRACHEX_REDIS_URL
  -> Redis accepts { adjustmentJobId }
  -> worker claims job and marks processing
  -> worker reads shared SQLite/source snapshot
  -> runReconciliation -> createTrachexAgent
  -> OpenAI-compatible POST {OPENAI_BASE_URL}/chat/completions
  -> gateway response / Cloudflare 502
  -> retryTransientAgentCall (3 attempts)
  -> proposal + completed job, or failed job after BullMQ retries
  -> dashboard polls job status
```

Chat follows a different path:

```text
Dashboard chat POST -> API ReadableStream -> runAgent synchronously
  -> provider gateway -> stream error or completion -> NDJSON response
```

## Key Diagnoses

The adjustment request has a deployment risk before the worker reaches the gateway. `docker-compose.yml` sets the API Redis URL to the internal hostname `redis`, but the Redis service and worker are both under the `local` profile. A deployment that starts only the app has no Redis listener and no consumer. `Queue.add()` can remain pending because the Redis connection uses `maxRetriesPerRequest: null`, allowing Cloudflare to observe an incomplete/failed origin response. A healthy LLM gateway does not validate this API-to-Redis boundary.

If the reported JSON was emitted by the LLM provider, it belongs to the second path: the worker reached the configured gateway, received a Cloudflare 502, and retries it. In that case the adjustment HTTP request should already have returned `202`; the observable failure should be the job's `failed` state after queue retries. If the JSON was returned by the browser's upload request, inspect Redis/service reachability first. If it was returned by chat, inspect the synchronous chat timeout/stream path and provider request.

The parent `assignment-w6d2-final` is useful evidence that the base URL and key convention are not inherently wrong. However, it exercises a materially simpler request: a streaming agent session using the same OpenAI-compatible client. This worker uses the SDK's non-streaming completion path with tools, strict JSON-schema output, and multiple agent turns. A gateway can be healthy for the parent request while returning a Cloudflare/origin 502 for this larger or unsupported request shape. Gateway logs for Ray ID `a3defec24bc44094` and the exact request route/body are required to distinguish this from the Redis failure.

## Remediation Shape

- Make Redis availability explicit at deployment: run a Redis endpoint reachable by the API and a worker process using the same queue name/database and shared canonical storage.
- Bound queue connection/command waiting so the API returns a deterministic service error rather than hanging until Cloudflare terminates the request.
- Preserve the current `202` contract; do not call the agent synchronously from the upload route.
- Compare the worker request against the parent example at the gateway boundary before changing model/provider configuration. If structured output plus tools is unsupported, use a gateway-supported response strategy while preserving local schema validation.
- Add correlation identifiers and stage-specific logs for enqueue, worker claim, provider attempt, and terminal job failure. Do not log source content or secrets.
- Keep provider retries in the worker, but include status/code/cause and attempt number in the terminal job error.
- Normalize proposal impacts at the agent pipeline boundary: preserve source-supported service impacts, require source substring evidence for API/page impacts, and deduplicate kind/value pairs case-insensitively before storing proposal JSON.

## Compatibility And Rollback

The queue payload and SQLite job schema remain unchanged. Configuration-only deployment correction can be rolled back independently. Application changes should be limited to queue timeout/error handling and diagnostics; reverting them must not affect proposal approval or canonical requirement state.
