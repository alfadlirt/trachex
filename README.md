# Trachex

**Trachex is a local-first development traceability layer.** It turns source documents (FSD/BRD, chat messages, meeting notes, UAT feedback) and later adjustments into an append-only, agent-readable development checklist for a project that may span multiple repositories or services.

Nothing is silently overwritten or deleted. Every requirement keeps its source, timestamp, status, impacted services/APIs/pages, and relationship to previous requirements. AI output is always a **pending proposal** — a human approves it before it becomes canonical (see [ADR 003](docs/decisions/003-proposals-before-apply.md)).

## Three equal clients

All clients call the same application/domain services over one SQLite store:

- **CLI** — `trachex` for automation and terminal workflows.
- **MCP** — `trachex mcp --project <slug>` for local coding agents (OpenCode, Claude Code, etc.).
- **Dashboard** — `trachex dashboard` serves a bundled React ticket canvas.

## Quick start

Requires **Node.js 20+**.

```bash
npm install -g trachex
```

### 1. Configure a provider (BYOK)

Trachex uses your own LLM provider key. Set environment variables (they override any global config):

```bash
export TRACHEX_PROVIDER=openai        # openai | anthropic | gemini | ollama
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_API_KEY=sk-...
export TRACHEX_MODEL=gpt-4o-mini
```

For a local Ollama:

```bash
export TRACHEX_PROVIDER=ollama
export OPENAI_BASE_URL=http://localhost:11434/v1
```

Provider keys never go to browser local storage and are never stored in the SQLite database or in archives.

### 2. Create a project

Projects are global (not tied to one repository) and may register multiple repositories/services:

```bash
trachex project create loyalty --name "Loyalty Program"
trachex project use loyalty                  # active-project shortcut
trachex project repo add loyalty --name front-office --path /repos/front-office
trachex context ingest loyalty --include AGENTS.md,PROJECT.md
```

Explicit `--project <slug>` always wins over the active-project shortcut, and every command works from any directory.

### 3. Create a ticket and review extraction

```bash
trachex ticket new TICKET-1234 --project loyalty --fsd FSD-Loyalty-v1.2.md
trachex proposal list --project loyalty
trachex proposal approve <proposal-id> --project loyalty --yes
```

`ticket new` snapshots the source, extracts requirements, and stores **pending proposals** — it never silently approves model output.

### 4. Check items and export

```bash
trachex check TICKET-1234 <requirement-id> --project loyalty --yes
trachex export TICKET-1234 --project loyalty --format markdown
```

Completion is always a deliberate human action. The export is a Markdown (or JSON) development summary with timeline, current checklist, impacted services/APIs/pages, test scenarios, and full requirement history.

## Adjustments

When a requirement changes (chat, meeting, UAT, new FSD):

```bash
trachex adjustment TICKET-1234 --project loyalty --source chat --from "Budi (BA)" --note "discount cap should be 15%, not 20%"
```

This creates a **pending reconciliation proposal**. After approval, the old requirement is superseded and remains in history; the current checklist shows only the latest valid requirement.

## Dashboard

```bash
trachex dashboard [--project loyalty] [--port 8000]
```

Starts a local Hono server (binds `127.0.0.1` by default) and serves the bundled React dashboard: ticket canvas with the current checklist, proposal review, inline adjustment flow, timeline/history, impact panels, export controls, and an embedded chatbot. The browser never opens SQLite directly; all reads/writes go through the API. Works with SQLite and no Docker.

## MCP

```bash
trachex mcp --project loyalty
```

Starts a stdio MCP server scoped to exactly one project. Configure your coding agent to spawn this command. Tools are narrow and project-scoped; `check_item` requires `confirm: true` — an agent cannot mark an item complete on its own.

## Optional Qdrant (derived index)

```bash
trachex infra up      # starts Qdrant via Docker Compose
trachex infra down    # stops it
```

Qdrant is a derived index, never the canonical store. SQLite remains canonical; Qdrant can be rebuilt from immutable snapshots.

## Backup

```bash
trachex project export loyalty --out ./backup
```

Writes a schema-versioned manifest plus snapshot files. Archives exclude provider secrets and embeddings by default.

## Development

Monorepo (pnpm + Turborepo + TypeScript ESM + Biome):

```text
apps/
├── dashboard/        # React/Vite bundled UI (ticket canvas)
└── api/              # Hono local server + static asset serving

packages/
├── domain/           # entities, commands, repository interfaces, invariants
├── storage-sqlite/    # SQLite schema, migrations, repositories, FTS5
├── agent/            # Anvia agent, prompts, typed tools, retrieval, evals
├── mcp/              # stdio MCP server and tool schemas
├── cli/              # command parsing and terminal presentation
├── shared/           # schemas, IDs, config, serialization
└── trachex/          # publishable composition package (bin + bundled dashboard)
```

Commands:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build        # builds dashboard + bundles assets into packages/trachex/dist
pnpm eval         # eval harness (8 checks) + real-ticket acceptance test
```

## Documentation

- [Usage](docs/usage.md) — deeper end-to-end reference.
- [Architecture](docs/architecture.md) — system design, domain model, contracts.
- [Implementation plan](docs/implementation-plan.md) — phases and release gate.
- [UX direction](docs/ux.md) — ticket canvas and visual system.
- [Decisions](docs/decisions/) — accepted ADRs (SQLite-first, global registry, proposals-before-apply, BlockNote boundary, stdio MCP).
- [Security review](docs/security.md) — provider keys, localhost binding, MCP scoping, archives.
