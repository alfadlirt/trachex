# Trachex Architecture

## Purpose

Trachex is a local-first development traceability layer. It turns source documents and later adjustments into an append-only, agent-readable checklist for a project that may contain multiple repositories or services.

The MVP has three equal clients:

- `trachex` CLI for automation and terminal workflows.
- `trachex mcp` for local MCP-compatible coding agents.
- A bundled dashboard started by `trachex dashboard`.

All clients call the same application/domain services. None owns a second implementation of requirement history, proposal approval, checklist completion, or export.

## Decisions At A Glance

| Concern | MVP decision |
| --- | --- |
| Distribution | One installable `trachex` package with CLI and bundled dashboard assets |
| Runtime | Node.js 20+, TypeScript ESM, pnpm, Turborepo |
| Canonical store | SQLite in the global Trachex application directory |
| Agent memory | SQLite-backed Anvia memory adapter when compatible with the pinned Anvia release |
| Retrieval | SQLite FTS5 by default; optional Qdrant through Docker |
| Relational server | Not required for MVP; PostgreSQL is a future adapter |
| Agent runtime | Anvia Core and provider adapters |
| API | Hono local API, also serving dashboard assets |
| MCP | Stdio, explicitly scoped with `--project` |
| UI | React, Vite, TanStack Router, Tailwind v4, selective shadcn/Radix primitives |
| Rich editor | BlockNote for adjustment/source notes, not canonical checklist records |
| Observability | Anvia Lens and Pino when configured; local operation without either |

## Runtime Topology

```text
trachex CLI ───────────────┐
trachex mcp (stdio) ───────┼──> application services ──> SQLite
dashboard browser ─> Hono ┘          │                    │
                                     │                    ├── source snapshots
                                     │                    ├── FTS5 index
                                     │                    └── chat memory
                                     │
                                     └── Anvia agent
                                           ├── LLM provider
                                           ├── extraction/reconciliation tools
                                           ├── FTS5 or Qdrant search
                                           └── Lens/Pino observers
```

`trachex dashboard` starts one local Hono process. The browser never opens SQLite directly. CLI and dashboard may run concurrently; SQLite uses WAL mode and application writes are short-lived.

## Global Application Layout

Projects are global rather than tied to one repository. A project can register many repository/service roots.

```text
macOS:   ~/Library/Application Support/trachex/
Linux:   ~/.local/share/trachex/
Windows: %APPDATA%/trachex/

trachex/
├── trachex.db
├── config.json
├── projects/
│   └── <project-id>/
│       ├── project.json
│       ├── sources/
│       ├── exports/
│       └── attachments/
└── logs/
```

SQLite stores metadata, canonical domain data, chat memory, proposals, and artifact metadata. Immutable source snapshots and generated export files remain inspectable in the project directory. Provider secrets belong in the OS keychain; non-secret settings belong in global config.

## Package Boundaries

```text
apps/
├── dashboard/                 # React/Vite bundled UI
└── api/                       # Hono local server and static asset serving

packages/
├── domain/                    # entities, commands, repositories, invariants
├── storage-sqlite/            # SQLite schema, migrations, repositories, FTS5
├── agent/                     # Anvia agent, prompts, typed tools, retrieval
├── mcp/                       # stdio MCP server and tool schemas
├── cli/                       # command parsing and terminal presentation
└── shared/                    # schemas, IDs, config, serialization
```

The published `trachex` package composes the CLI, API, MCP server, domain, storage, and built dashboard assets. Internal workspace packages are not public contracts unless explicitly exported later.

## Domain Model

### Project and repositories

- `Project`: internal UUID, unique local slug, name, description, timestamps.
- `Repository`: project-scoped slug, logical service name, current root path, path history, optional URL, timestamps.
- `ContextSnapshot`: immutable file/directory snapshot associated with a project and optionally a repository.

### Tickets and sources

- `Ticket`: project ID, ticket key unique within project, title, description, timestamps.
- `Source`: source type, attribution, source event time, ingestion time, immutable snapshot path/hash, source location metadata.
- Supported source types: `document`, `fsd` (legacy), `brd`, `chat`, `meeting`, `clarification`, `uat`, `manual`, `context`.

### Requirements

Each requirement is a structured record, never a BlockNote document:

- title and description
- source reference and precise location where available
- project/repository/service scope
- lifecycle status: `active` or `superseded`
- development status: `unchecked` or `checked`
- creation and update timestamps
- optional parent/group label
- typed impacts for services, APIs, and pages
- generated or reviewed test scenarios

Requirement relationships are stored in a separate table. The initial relation type is `supersedes`; the relationship model allows future `clarifies`, `splits`, and `merges` without changing the requirement table.

### Proposals

AI output is not canonical data until approved:

```text
pending -> approved | rejected
```

Proposal versions are immutable. Editing a proposal creates a new reviewed version retaining the original model output. Approval creates or updates canonical append-only requirements through a domain command. Rejection leaves the source and prior requirements unchanged.

### Completion audit

Checking an item is a direct human action. Store actor type, optional identity, timestamp, and optional note. An agent may request a check only through an MCP tool requiring explicit confirmation; it cannot infer completion from code or conversation.

## Storage Adapters

The application layer depends on domain-level repositories and services, not SQL. SQLite is the only implemented canonical adapter in the MVP.

Required capabilities:

- project, repository, ticket, source, context snapshot persistence
- append-only requirements and relationships
- proposal/version lifecycle
- checklist completion audit
- chat sessions/messages/errors
- export artifact metadata
- full-text document search

SQLite configuration:

- WAL journal mode
- foreign keys enabled
- busy timeout configured
- migrations versioned and applied on startup/explicit command
- no transaction held while waiting for an LLM

An optional future server adapter may use PostgreSQL. It must implement the same domain repository contract and be selected explicitly; SQLite and PostgreSQL are never edited as dual authorities.

## Retrieval

Local mode uses SQLite FTS5 over immutable source/context chunks. Search is exposed to the agent through a typed tool and returns chunk text plus provenance.

Optional Docker mode starts Qdrant and uses an adapter implementing the same search contract. SQLite remains canonical for MVP; Qdrant is a derived index and can be rebuilt from snapshots. Docker must not silently switch the canonical database.

Embedding/index lifecycle:

1. Snapshot source content and calculate its hash.
2. Chunk content with stable chunk IDs.
3. Write FTS5 rows synchronously; optionally enqueue Qdrant indexing.
4. Retain source and chunk provenance.
5. Re-ingestion creates a new snapshot; old snapshots remain queryable for historical context.

## Anvia Integration

Current Anvia documentation describes v1 as a stable TypeScript stack with `@anvia/core`, provider adapters, `@anvia/memory-sqlite`, retrieval adapters, Lens, and Studio. The implementation should pin all Anvia packages to one compatible v1 release line and verify APIs during setup.

Use Anvia for:

- bounded agent runs and streaming
- typed model/provider clients
- typed tool input/output validation
- SQLite agent memory where supported by the pinned package
- retrieval adapter integration
- Lens traces and evaluation reporting when configured
- local Studio as an optional development tool

Use application code for:

- identity, project selection, authorization policy, and secrets
- canonical persistence and append-only invariants
- proposal approval and human completion
- source snapshot lifecycle
- CLI, MCP transport, and dashboard routing

The initial agent is one Trachex agent with narrow tools. It may extract requirements, reconcile adjustments, classify impacts, generate test scenarios, search context, and explain baselines. Tools return typed proposals or evidence; domain services decide what can be persisted.

## API Surface

The local Hono API is an application transport, not a second domain layer.

Suggested routes:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/projects` | List projects |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/:projectId/tickets` | List tickets |
| `POST` | `/api/projects/:projectId/tickets` | Create ticket and source |
| `GET` | `/api/projects/:projectId/tickets/:ticketKey` | Ticket canvas data |
| `POST` | `/api/projects/:projectId/tickets/:ticketKey/adjustments` | Create pending adjustment proposal |
| `POST` | `/api/proposals/:proposalId/approve` | Approve proposal |
| `POST` | `/api/proposals/:proposalId/reject` | Reject proposal |
| `POST` | `/api/requirements/:requirementId/check` | Human completion |
| `GET` | `/api/projects/:projectId/tickets/:ticketKey/export` | Generate/download export |
| `POST` | `/api/chat/:projectId/:ticketKey` | Stream agent interaction |

JSONL streaming is acceptable for the chat route, matching the reference stack. API handlers validate input, call domain services, and serialize domain results.

## MCP Contract

`trachex mcp --project <slug>` starts a stdio server scoped to exactly one project. Tools have narrow Zod schemas and return structured JSON plus concise human-readable text where useful.

Read tools:

- `get_checklist(ticketKey)`
- `get_baseline(ticketKey)`
- `get_history(ticketKey)`
- `list_tickets()`
- `get_requirement(requirementId)`

Mutation tools:

- `create_ticket(input)`
- `add_adjustment(input)`
- `approve_proposal(input)`
- `reject_proposal(input)`
- `check_item(input)`
- `export_summary(input)`

Mutations must include explicit confirmation where the operation asserts human intent. `add_adjustment` and extraction create pending proposals; `check_item` requires `confirm: true`. No generic command-execution MCP tool is exposed.

## CLI Contract

The active project shortcut is optional; explicit `--project` always wins.

```text
trachex project create <slug> --name <name>
trachex project use <slug>
trachex project list
trachex project repo add <project> --name <slug> --path <path>
trachex context ingest <project> --repo <slug> --include <paths>
trachex ticket new <key> --project <slug> --fsd <file>
trachex ticket show <key> --project <slug>
trachex adjustment <key> --project <slug> --source <type> --from <actor> --note <text>
trachex proposal list --project <slug>
trachex proposal approve <id> --project <slug>
trachex proposal reject <id> --project <slug>
trachex check <key> <requirement-id> --project <slug>
trachex export <key> --project <slug> --format markdown|json
trachex dashboard [--project <slug>]
trachex mcp --project <slug>
trachex infra up|down
trachex project export <slug> --out <archive>
```

`ticket new` snapshots the source, extracts requirements, and stores pending proposals. It does not silently approve model output.

## Security and Privacy

- Provider keys never go to browser local storage.
- Environment variables may override provider settings for CI.
- Keychain-backed profiles are used for interactive local operation.
- Dashboard binds to localhost by default.
- MCP is stdio by default and explicitly project-scoped.
- Source snapshots may contain proprietary code; logs must avoid raw source and secrets.
- Export archives exclude provider secrets and embeddings by default.

## Testing Strategy

- Domain unit tests for append-only rules, proposal approval, supersession, completion, project scoping, and export determinism.
- SQLite integration tests for migrations, concurrent CLI/dashboard access, FTS5 retrieval, and archive round trips.
- Agent contract tests using mocked provider responses and fixed structured outputs.
- MCP contract tests for schemas, project scoping, confirmation requirements, and serialization.
- API tests for route validation and JSONL events.
- UI tests for proposal review, checklist completion, responsive drawers, and adjustment flow.
- Anvia Lens eval cases for extraction, contradiction detection, impact classification, grounding, and abstention.
