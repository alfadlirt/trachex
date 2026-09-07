# Trachex MVP — Design (parent)

Source of truth for design is `docs/architecture.md` and `docs/ux.md`. This file records the cross-cutting design decisions that bind the phase children together. Child tasks hold their own phase-specific design in their `design.md`.

## Package boundaries (from docs/architecture.md)

```text
apps/
├── dashboard/                 # React/Vite bundled UI
└── api/                       # Hono local server + static asset serving

packages/
├── domain/                    # entities, commands, repositories, invariants
├── storage-sqlite/            # SQLite schema, migrations, repositories, FTS5
├── agent/                     # Anvia agent, prompts, typed tools, retrieval
├── mcp/                       # stdio MCP server and tool schemas
├── cli/                       # command parsing and terminal presentation
└── shared/                    # schemas, IDs, config, serialization
```

The published `trachex` package composes CLI, API, MCP, domain, storage, and built dashboard assets. Internal workspace packages are not public contracts.

## Layering contract

- `domain` defines entities, repository interfaces, and domain services. It depends on nothing platform-specific.
- `storage-sqlite` implements domain repository interfaces over SQLite. Domain code never sees SQLite types.
- `agent` depends on `domain` + `shared` + retrieval; returns typed proposals/evidence only.
- `cli`, `mcp`, `api` are transports over the same domain services.
- `dashboard` (browser) talks only to the Hono API; never to SQLite.

## Data flow (vertical slice)

```text
project -> ticket/source -> extraction proposal -> approval
       -> checklist -> adjustment proposal -> approval
       -> human check -> Markdown/JSON export
```

## Cross-cutting contracts

- **IDs**: UUIDs for internal entities; project slug and ticket key are unique local identifiers with uniqueness constraints.
- **Proposals**: `pending -> approved | rejected`; immutable versions; approval is the only path that mutates canonical requirements.
- **Completion audit**: actor type + optional identity + timestamp + optional note; `check_item` requires explicit confirmation.
- **Snapshots**: immutable; re-ingestion creates a new snapshot and preserves the old; content hashes.
- **Retrieval**: FTS5 canonical; Qdrant derived and rebuildable.
- **Serialization**: shared Zod schemas for API/MCP/CLI payloads and export formats.

## Compatibility / rollout

- All phases build in one repo; no external deployment target for MVP.
- Optional infra (Qdrant, Studio) is opt-in via `trachex infra up/down` and never required for the basic workflow.
- Rollback shape: a phase failing acceptance is rolled back to its last green commit; dependencies are ordered so later phases never start on a red foundation.

## Security invariants

- Provider keys: keychain-backed profiles for interactive use; env override for CI; never browser local storage.
- Dashboard binds localhost; MCP stdio + explicit project scope.
- Logs and archives exclude raw source, secrets, and embeddings by default.

## Testing strategy (from docs/architecture.md)

- Domain unit tests (append-only, approval, supersession, completion, scoping, export determinism).
- SQLite integration tests (migrations, concurrent access, FTS5, archive round trips).
- Agent contract tests (mocked provider, fixed structured outputs).
- MCP contract tests (schemas, scoping, confirmation, serialization).
- API tests (route validation, JSONL events).
- UI tests (proposal review, completion, drawers, adjustment flow).
- Lens eval cases (extraction, contradiction, impact, grounding, abstention).
