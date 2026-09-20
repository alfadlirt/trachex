# Error Handling

> How errors are handled in this project.

---

## Overview

Domain errors are typed (`packages/domain/src/errors.ts`):

- `DomainError` base with a `code`.
- `NotFoundError` (`NOT_FOUND`), `ConflictError` (`CONFLICT`), `InvalidOperationError` (`INVALID_OPERATION`), `ScopingError` (`SCOPING`).

Pipeline errors (`packages/agent/src/pipeline.ts`) wrap agent failures as
`PipelineError` with an optional `cause`. Agent/model failures never corrupt
canonical data: the pipeline writes an `ErrorRecord` (via
`uow.sessions.recordError`) and rethrows.

---

## Propagation

- Domain services throw typed errors; callers (CLI/MCP/API) map them to exit
  codes / structured responses.
- MCP startup errors are process errors and must be written to stderr; stdout
  is the MCP JSON-RPC channel and must not contain human-readable or JSON error
  envelopes before a valid protocol session exists.
- The agent layer (`runExtraction`/`runReconciliation`) catches model failures,
  records an error row, and rethrows `PipelineError`. The already-created
  `Source` row is kept; no requirement rows are touched.
- No transaction is ever held across an LLM call (ADR 001 / architecture).

---

## Validation & Error Matrix

| Condition | Error |
| --- | --- |
| Project slug already exists | `ConflictError` |
| Ticket key already exists in project | `ConflictError` |
| Project/subject slug or key rename collides | `ConflictError` |
| Delete confirmation name does not match | `InvalidOperationError` |
| Entity not found | `NotFoundError` |
| Proposal not pending (approve/reject/edit) | `InvalidOperationError` |
| Ticket belongs to another project (ingest) | `ScopingError` |
| Agent threw / malformed output | `ErrorRecord` written + `PipelineError` |
| Unsupported archive schema version | `Error` (archive.ts) |

---

## Common Mistakes

- **Catching agent errors and swallowing them**: always record an `ErrorRecord`
  and rethrow a typed `PipelineError` so failures are auditable.
- **Holding a DB transaction across a model call**: never wrap an LLM run in a
  `db.transaction`; keep transactions short and per-repository.
- **Returning from the stdio runtime after `server.connect()`**: the
  composition executable then exits cleanly and the MCP host reports a
  disconnected server. Keep the runtime pending until stdin/transport close.

## Async Agent And Queue Boundaries

### Contract

- Agent calls that cross an OpenAI-compatible gateway use the streaming agent
  path and fully drain the returned `AgentStream` before reading `stream.result`.
  Draining is required for tool execution and structured-output validation.
- The API-side BullMQ connection is short-lived and must use bounded Redis
  connection/command timeouts, `maxRetriesPerRequest: 1`, and
  `enableOfflineQueue: false`. This prevents an unavailable Redis service from
  leaving an HTTP request pending until the edge proxy returns 502.
- The long-lived BullMQ worker connection keeps `maxRetriesPerRequest: null`,
  because the worker must remain available for queue recovery.

### Error Matrix

| Condition | Result |
| --- | --- |
| Gateway/provider failure during an adjustment worker call | Agent/pipeline error is recorded; BullMQ retries; terminal job becomes `failed` |
| Redis unavailable during API enqueue | `Queue.add` rejects within the Redis timeout; the SQLite job is not reported as queued |
| Empty or incomplete agent stream | `stream.result` rejects and the pipeline records/rethrows the failure |

### Good / Bad

```ts
const stream = agent.stream({ prompt });
for await (const _event of stream) {
  // Drain tool calls and the final structured response.
}
const outcome = await stream.result;
```

Do not replace the drain with `agent.generate()` when the configured gateway
has only been validated through its streaming integration, and do not use an
unbounded offline Redis queue for a request-scoped enqueue connection.

### Tests Required

- Verify structured agent output still completes through the streaming path.
- Verify tool calls are executed before `stream.result` resolves.
- Verify worker/provider failures remain job failures rather than synchronous
  upload responses.
- Verify queue connection cleanup completes after Redis is unavailable.

## Vector Backend Boundary

### 1. Scope / Trigger

Upload ingestion and semantic indexing cross the API, embedding runtime, and
Qdrant process boundary. The API owns upload-time indexing; the worker receives
an already-ingested source and must not perform a second indexing pass.

### 2. Signatures

- `resolveVectorBackend(env)` selects `sqlite` by default or creates a Qdrant
  client for `TRACHEX_VECTOR_BACKEND=qdrant`.
- `createLazyLocalEmbedder().embedTexts(texts)` lazily loads the local Anvia
  embedding model.
- `QdrantClient.upsert(points)` ensures the configured collection exists before
  writing points.

### 3. Contracts

- The API process must receive `TRACHEX_VECTOR_BACKEND`, `QDRANT_URL`,
  `QDRANT_COLLECTION`, and optional `QDRANT_API_KEY`; worker-only configuration
  does not affect upload-time indexing.
- The Anvia Transformers adapter must call
  `loadTransformersEmbeddingModel({ modelId })`, using the package's
  `DEFAULT_TRANSFORMERS_EMBEDDING_MODEL`.
- A successful upload creates or updates the configured Qdrant collection with
  384-dimensional vectors and provenance payload fields.

### 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Backend unset or not `qdrant` | SQLite vector backend is used |
| API Qdrant config is valid and embedding succeeds | Collection is ensured and points are upserted |
| Embedding loader or Qdrant request fails during ingestion | Canonical source persistence succeeds; semantic retrieval falls back to lexical search |
| Worker has Qdrant config but API does not | Upload is not indexed in Qdrant; worker configuration cannot move an existing source |

### 5. Good / Base / Bad Cases

- Good: configure Qdrant in the API environment and let the client lazily
  ensure the collection on the first successful embedding.
- Base: leave the backend unset and use the SQLite vector index without Docker.
- Bad: call the Anvia loader without its required `{ modelId }` option or
  configure Qdrant only on the worker.

### 6. Tests Required

- Assert configured Qdrant ingestion calls `upsert` with uploaded snapshot and
  path provenance.
- Assert SQLite remains the default backend.
- Assert the embedding adapter passes the Anvia package default model ID.
- Assert worker processing does not re-ingest or re-index an existing source.

### 7. Wrong vs Correct

#### Wrong

```ts
loadTransformersEmbeddingModel();
```

#### Correct

```ts
loadTransformersEmbeddingModel({
  modelId: module.DEFAULT_TRANSFORMERS_EMBEDDING_MODEL,
});
```
