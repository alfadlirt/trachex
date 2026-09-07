# Phase 3: Anvia Agent and Proposal Pipeline

## Goal

Implement the AI pipeline behind the vertical slice: provider configuration resolver, Anvia agent factory with typed schemas and bounded turns, extraction + reconciliation prompts/output schemas, impact classification + test-scenario generation, a context search tool over the active retrieval adapter, SQLite-backed Anvia memory (Node 20+ compatible), and optional Lens/Pino observers. Agent output is persisted as pending proposals only (ADR 003).

Source of truth: `docs/implementation-plan.md` Phase 3, `docs/architecture.md` Anvia Integration + Proposals, ADR 003.

## Requirements

- Provider configuration resolver: keychain-backed profiles for interactive use, environment-variable override for CI, global non-secret config. No provider keys in browser local storage or in the DB.
- Anvia agent factory with typed schemas and bounded turns (pinned `@anvia/*@1.1.2`, zod ^4).
- Extraction prompt + output schema (turns source content into `ExtractionOutput`).
- Reconciliation prompt + output schema (turns an adjustment into `ReconciliationOutput`).
- Impact classification and test-scenario generation (part of extraction/reconciliation output).
- Context search tool using the active retrieval adapter (FTS5 default; Qdrant optional).
- SQLite-backed Anvia memory integration, verified against the selected Anvia version and compatible with Node 20+ (see design: `@anvia/memory-sqlite` requires node:sqlite / Node 22.5+, so implement a `MemoryStore` over better-sqlite3).
- Optional Lens and Pino observers wired through `observability`.
- Failed or malformed model output is retained as an error record without corrupting the ticket.

## Acceptance Criteria

- [ ] `ticket new` creates a source and pending extraction proposals (via the pipeline; CLI wiring is Phase 4 — here the pipeline function must produce the pending proposal).
- [ ] `adjustment` creates a source and pending reconciliation proposals (pipeline function).
- [ ] Agent output cannot directly mutate canonical requirements — it is persisted as a pending proposal; approval is the only apply path (already enforced by domain; the agent layer must not call approve).
- [ ] Failed or malformed model output is retained as an error record without corrupting the ticket.
- [ ] Provider config resolves from env override and global config; keychain path is stubbed/optional in MVP.
- [ ] Contract tests using mocked provider responses and fixed structured outputs pass.

## Dependency order

- Depends on Phase 2 (ingestion + search contract). Phase 4 (CLI) depends on this task's pipeline functions.

## Notes

- Anvia packages pinned to 1.1.2 (verified). `@anvia/memory-sqlite@1.1.2` depends on `node:sqlite` (Node >= 22.5), which conflicts with the Node 20+ engine floor; the design therefore implements a `MemoryStore` adapter over `better-sqlite3` (already used) to satisfy "SQLite-backed Anvia memory integration."
- No LLM call is required for tests; contract tests mock the provider/agent.
