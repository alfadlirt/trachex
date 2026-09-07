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
