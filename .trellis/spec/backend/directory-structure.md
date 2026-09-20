# Directory Structure

> How backend code is organized in this project.

---

## Overview

Trachex is a pnpm + Turborepo monorepo. All Node packages are ESM TypeScript
(`"type": "module"`). Workspace packages export their TypeScript source via the
`exports` map and are consumed with the `workspace:*` protocol — no generated
code, no path hacks.

---

## Directory Layout

```
apps/
├── dashboard/                 # React/Vite bundled UI (Phase 6)
└── api/                       # Hono local server + static asset serving (Phase 6)

packages/
├── domain/                    # entities, commands, repository interfaces, invariants
├── storage-sqlite/            # SQLite schema, migrations, repositories, FTS5
├── agent/                     # Anvia agent, prompts, typed tools, retrieval
├── mcp/                       # stdio MCP server and tool schemas
├── cli/                       # command parsing and terminal presentation
└── shared/                    # schemas, IDs, config, serialization
```

Each workspace package has the same shape:

```
<package>/
├── package.json    # "type": "module"; exports: { ".": "./src/index.ts" }
├── tsconfig.json   # extends ../../tsconfig.base.json
└── src/
    ├── index.ts
    └── index.test.ts
```

---

## Module Organization

- **`packages/domain`** owns entities, repository interfaces, and domain
  services. It depends on nothing platform-specific and must never expose
  SQLite types (ADR 001).
- **`packages/storage-sqlite`** implements the domain repository contract over
  SQLite. SQLite-specific types never leak into `@trachex/domain`.
- **`packages/agent`** depends on `domain` + `shared` + retrieval; returns typed
  proposals/evidence only (ADR 003).
- **`cli`, `mcp`, `api`** are transports over the same domain services.
- **`apps/dashboard`** (browser) talks only to the Hono API; never to SQLite.

---

## Naming Conventions

- Workspace package names: `@trachex/<name>`.
- Source entrypoint: `src/index.ts`; tests co-located as `src/index.test.ts`
  (or `<module>.test.ts`).
- ESM: relative imports must include the file extension (`.ts`).

---

## Examples

- Cross-package import proof: `packages/cli/src/index.ts` imports
  `{ isRecord }` from `@trachex/shared` (declared as `"@trachex/shared":
  "workspace:*"` in `packages/cli/package.json`).

## CLI package (`packages/cli`)

- `src/index.ts` — command router: `runCli({ argv, appDir })` returns an exit
  code; maps `CliError`/`DomainError`/`PipelineError` to 0/2/3/1. Handles
  `--help`.
- `src/commands/*.ts` — one module per command group (project, subject, repo,
  info, settings, ticket, adjustment, proposal, check, checklist, export, tui).
  Handlers throw domain `NotFoundError`/`InvalidOperationError` so the router
  maps them to exit 3.
- `src/commands/tui.ts` — `trachex tui` is a styled, form-driven terminal
  workspace built on `@clack/prompts`; it calls the same domain/application
  services as the CLI (no direct SQLite mutation) and honors the `no-color`
  theme from user config.
- `src/args.ts` — wraps `node:util` `parseArgs` (no CLI framework).
- `src/context.ts` — active-project resolution: explicit `--project` wins,
  else `config.json` `activeProject` (ADR 002).
- `src/export.ts` — Markdown/JSON serializers over `buildExportSummary`
  (reused by MCP/API later).
- `src/io.ts` — `print`/`printJson`/`confirm`; `confirm` is injectable via
  `setConfirmImpl` for tests.

Router gotcha: commands whose first positional is NOT a subcommand (`check`,
`adjustment`, `export`) must parse `[sub, ...rest]` — `sub` is the first
positional, not a subcommand.

## MCP package (`packages/mcp`)

- `src/tools.ts` — tool registry: `{ name, description, inputSchema, handler }`.
  All 11 contract tools (5 read, 6 mutation). Every handler enforces project
  scoping via `requireScopedRequirement`/`requireScopedProposal` (throw
  `ScopingError` → stable `SCOPING` code).
- `src/server.ts` — `createMcpServer` wires `ListToolsRequestSchema` +
  `CallToolRequestSchema`; `handleToolCall(ctx, name, args)` is the testable
  dispatch function returning the SDK `CallToolResult`.
- `src/run.ts` — `runMcpServer` uses `StdioServerTransport`; CLI `mcp` command
  defaults to it (`--transport stdio`).
- `src/http.ts` — `runMcpHttpServer` / `startMcpHttpServer` exposes the Streamable HTTP
  transport at `/mcp` (`--transport http`). Requires `TRACHEX_MCP_TOKEN` bearer auth,
  binds `127.0.0.1:8001` by default, enforces Host/Origin validation, and creates
  stateful in-memory sessions per client.
- `check_item` schema requires `confirm: z.literal(true)`; without it the
  schema rejects (`INVALID_INPUT`).
- Results: `{ content: [{ type: 'text', text: JSON.stringify(payload) }] }`;
  errors: `{ isError: true, content: [{ type: 'text', text: JSON.stringify({ code, message }) }] }`.
- The stdio runtime must remain pending after `server.connect(transport)` until
  stdin closes or the transport/server reports a fatal error. The composition
  binary calls `process.exit(code)` after the CLI promise resolves, so returning
  immediately disconnects external MCP clients.
- The runtime closes the SQLite handle in `finally` and routes startup
  diagnostics to stderr. stdout is reserved exclusively for MCP JSON-RPC
  frames.
- Export serializers live in `packages/domain/src/export.ts` (not cli) so
  cli/mcp/api share them without a dependency cycle.

## Packaging (`packages/trachex`)

- `packages/trachex` is the publishable composition package: `name: "trachex"`,
  `bin: { "trachex": "./bin/trachex.mjs" }`, `files: ["bin", "dist", "src"]`.
- `bin/trachex.mjs` calls `runCli({ argv: process.argv.slice(2) })` and exits
  with the code.
- Bundled dashboard: `scripts/build-dashboard.mjs` copies
  `apps/dashboard/dist` → `packages/trachex/dist/dashboard`. `packages/trachex`
  depends on `@trachex/dashboard` so turbo orders the dashboard build first
  (build race otherwise).
- `resolveBundledDashboardDist()` lives in `packages/shared/src/paths.ts` (not
  cli/trachex) to avoid a dependency cycle; the CLI `dashboard` case passes it
  to `startDashboard({ dashboardDist })`.
- `infra up|down` shells out to `docker compose -f <compose> up -d` / `down`
  (packages/cli/src/infra.ts `resolveComposeFile`). Qdrant is derived, never
  canonical (ADR 001).
