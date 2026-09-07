# Phase 3: Anvia Agent and Proposal Pipeline — Design

## Verified Anvia v1.1.2 API (checked against installed .d.ts)

- `Agent` (`@anvia/core`): `new Agent({ id, name, model, instructions, tools, outputSchema, maxTurns, memory, observability })`; `agent.generate({ input })` → `AgentOutcome<Output>` where `type === 'response'` carries `.output`.
- `OpenAIClient` (`@anvia/openai`): `.completionModel({ modelId, ... })` → `StreamingCompletionModel`. Provider-agnostic via `OPENAI_BASE_URL`/`OPENAI_API_KEY`.
- `createTool` (`@anvia/core`): `{ name, description, inputSchema, execute(args, ctx) }`.
- `MemoryStore` interface (`@anvia/core/memory`): `load`, `append`, `clear`, optional `recordError`.
- `LensClient.observer()` (`@anvia/lens`) → `AgentObserver`; `@anvia/logger` → pino `AgentObserver`.
- `AgentObservabilityOptions = { observers, primaryTrace, errorPolicy }`.

## Package layout (`packages/agent`)

- `src/provider.ts` — provider config resolver:
  - `resolveProviderConfig(env)` → `{ provider, baseUrl, apiKey, modelId }`.
  - Precedence: env override (`OPENAI_BASE_URL`/`OPENAI_API_KEY`/`TRACHEX_PROVIDER`/`TRACHEX_MODEL`) > global config file (non-secret) > defaults. Keychain-backed profiles are a documented stub (`loadKeychainProfile` returns null unless a future adapter is present); MVP uses env + global config.
- `src/schemas.ts` — Zod schemas for extraction/reconciliation output (mirror domain `ProposalOutput`), impact kinds, scenarios.
- `src/prompts.ts` — extraction and reconciliation prompt builders (system + user).
- `src/factory.ts` — `createTrachexAgent({ provider, search, memory?, observers? })` building one `Agent` with narrow tools: `search_context` (typed, calls the active `SearchRepository`), plus the extraction/reconciliation behaviors driven by instructions + outputSchema.
- `src/pipeline.ts` — pipeline functions:
  - `runExtraction(uow, { appDir, projectId, ticketId, sourceInput, content })` → ingests source (Phase 2 `ingestFile`), runs agent with extraction outputSchema, persists the result as a **pending** extraction proposal via domain `createProposal`. Returns `{ source, proposal }`.
  - `runReconciliation(uow, { appDir, projectId, ticketId, sourceInput, content })` → ingests source, runs agent with reconciliation outputSchema, persists a **pending** reconciliation proposal. Returns `{ source, proposal }`.
  - On agent failure / malformed output: catch, write an `ErrorRecord` (via `uow.sessions.recordError`), and rethrow a typed error; the ticket/source remain intact.
- `src/memory.ts` — `BetterSqliteMemoryStore` implementing Anvia `MemoryStore` over better-sqlite3 using the existing `sessions`/`messages`/`errors` tables (Node 20+ compatible; `@anvia/memory-sqlite` is skipped because it needs `node:sqlite`).
- `src/observability.ts` — optional observers: Lens (`LensClient.observer()`) when `ANVIA_LENS_ENABLED`, pino logger observer otherwise; assembled into `AgentObservabilityOptions`.

## Agent behavior

- One Trachex agent, narrow tools: `search_context(query, projectId, limit)` returns chunks + provenance.
- Extraction: instructions + `outputSchema` = `ExtractionOutput` (`{ kind: 'extraction', requirements: [...] }`). maxTurns bounded (e.g. 5).
- Reconciliation: instructions + `outputSchema` = `ReconciliationOutput` (`{ kind: 'reconciliation', create: [...] }` with `supersedes` targets).
- The agent NEVER calls approve/check/apply tools — no such tools are exposed. Persistence of proposals is done by the pipeline after the run (domain `createProposal`), never by the agent.

## Failure handling

- Agent throws or returns malformed output → pipeline writes `ErrorRecord` (session_id/proposal_id null-safe) and throws `PipelineError`. The already-created Source row is kept; no requirement rows are touched. This satisfies "failed/malformed output retained as error without corrupting the ticket."

## Contract tests (no real LLM)

- `src/pipeline.test.ts` uses a fake `Agent`/provider: inject a `runAgent` function returning fixed structured output; assert:
  - extraction → source created + pending proposal with 1 version;
  - reconciliation → source + pending proposal;
  - malformed output → ErrorRecord written, ticket intact, no requirements created;
  - agent failure → ErrorRecord written, no requirements.
- `src/schemas.test.ts` — zod parse of sample outputs.
- `src/memory.test.ts` — BetterSqliteMemoryStore load/append/clear round-trip against a temp DB.
- `src/provider.test.ts` — env override precedence.

## Rollout / rollback

- Phase 3 builds on Phase 2. Failure = revert phase-3 commit(s). Phase 4 (CLI) consumes `runExtraction`/`runReconciliation`.
