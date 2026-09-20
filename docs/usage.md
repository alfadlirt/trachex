# Trachex Usage

Trachex is a local-first development traceability layer. It turns source documents and later adjustments into an append-only, agent-readable checklist for a project that may span multiple repositories.

## Installation

```bash
npm install -g trachex
```

Requires Node.js 20+. The `trachex` executable provides the CLI, the MCP server, and the bundled dashboard.

## Provider setup

Trachex uses your own LLM provider key (BYOK). Set environment variables (they override any global config):

```bash
export TRACHEX_PROVIDER=openai        # openai | anthropic | gemini | ollama
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_API_KEY=sk-...
export TRACHEX_MODEL=gpt-4o-mini
```

For Ollama (local):

```bash
export TRACHEX_PROVIDER=ollama
export OPENAI_BASE_URL=http://localhost:11434/v1
```

Keys never go to browser local storage and are never stored in the SQLite database or archives.

## Project creation

Projects are global (not tied to one repository) and may register multiple repositories/services:

```bash
trachex project create loyalty --name "Loyalty Program"
trachex project use loyalty                 # active-project shortcut
trachex project repo add loyalty --name front-office --path /repos/front-office
trachex context ingest loyalty --include AGENTS.md,PROJECT.md
```

Explicit `--project <slug>` always wins over the active-project shortcut.

## Ticket workflow

```bash
trachex ticket new TICKET-1234 --project loyalty --docs requirements.md
trachex proposal list --project loyalty
trachex proposal approve <proposal-id> --project loyalty --yes
trachex check TICKET-1234 <requirement-id> --project loyalty --yes
trachex export TICKET-1234 --project loyalty --format markdown
```

`ticket new` snapshots the source, extracts requirements, and stores **pending proposals** — it never silently approves model output (ADR 003). Approval is always an explicit human action.

## Adjustments

```bash
trachex adjustment TICKET-1234 --project loyalty --source chat --from "Budi (BA)" --note "discount cap should be 15%, not 20%"
```

This creates a pending reconciliation proposal. After approval, the old requirement is superseded and remains in history.

## Dashboard

```bash
trachex dashboard [--project loyalty] [--port 8000]
```

Starts the local Hono server (binds `127.0.0.1` by default) and serves the bundled React dashboard. The browser never opens SQLite directly; all reads/writes go through the API. Works with SQLite and no Docker.

## MCP

```bash
trachex mcp --project loyalty
```

Starts a stdio MCP server scoped to exactly one project. Configure your coding agent (OpenCode, Claude Code, etc.) to spawn this command. Tools are narrow and project-scoped; `check_item` requires `confirm: true`.

For remote MCP clients, run the explicit Streamable HTTP mode. Set a strong
secret in the environment; the application does not terminate TLS itself:

```bash
export TRACHEX_MCP_TOKEN='replace-with-a-secret'
export TRACHEX_MCP_ALLOWED_HOSTS='mcp.example.com'
export TRACHEX_MCP_ALLOWED_ORIGINS='https://claude.ai'
trachex mcp --transport http --project loyalty --host 127.0.0.1 --port 8001
```

Configure Dokploy to expose `https://mcp.example.com/mcp` and proxy it to the
listener above. Remote Claude, OpenAI, and supported Business or
Enterprise/Edu ChatGPT custom MCP apps use that HTTPS URL and send the bearer
token. A process serves one fixed project; it cannot select another project
per request. The default bind is `127.0.0.1`; a container may use
`--host 0.0.0.0` only with an appropriate network policy and the required
token.

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

Writes a manifest (schema versioned) plus snapshot files. Restore by importing the archive. Archives exclude provider secrets and embeddings by default.
