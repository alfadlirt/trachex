# Phase 7: Packaging and Optional Infrastructure — Design

## Composition package

Create `packages/trachex` as the publishable composition package:

- `package.json`: `name: "trachex"`, `bin: { "trachex": "./bin/trachex.mjs" }`, `files: ["bin", "dist"]`, `type: "module"`.
- `bin/trachex.mjs` — thin executable that imports `@trachex/cli` `runCli`, calls it with `process.argv.slice(2)`, and `process.exit(code)`. Also handles `dashboard`/`mcp`/`infra` subcommands by delegating to the respective packages.
- The package bundles the built dashboard assets: a build step copies `apps/dashboard/dist` into `packages/trachex/dist/dashboard`, and the API's `dashboardDist` option points there when running from the published package.
- Depends on `@trachex/cli`, `@trachex/api`, `@trachex/mcp`, `@trachex/domain`, `@trachex/storage-sqlite` (workspace `*`).

## CLI wiring for packaged commands

- `trachex dashboard` already calls `startDashboard` (Phase 6). In the published package, `startDashboard` must resolve the bundled `dist/dashboard` path (fall back to the workspace path in dev). Add a `dashboardDist` resolution: if `packages/trachex/dist/dashboard/index.html` exists, use it; else the workspace `apps/dashboard/dist`.
- `trachex mcp` already calls `runMcpServer`.
- `trachex infra up|down` — new: shells out to `docker compose -f <repo>/docker-compose.dev.yml up -d` / `down`. Resolves the compose file from the package location (dev: repo root).

## Platform/data-dir checks

- The CLI already creates the app dir on open (`openApp`). Add an explicit `trachex doctor`-style check? Keep minimal: `trachex project list` on a fresh install prints an empty list (app dir auto-created). Document this.

## Studio runner (optional)

- Add a root script `runner:dev` that starts Anvia Studio with the Trachex agent (packages/agent). Since Studio requires Docker sandbox, mark it optional and document it; do not wire into the published CLI for MVP.

## Documentation

- `docs/usage.md`: install (`npm i -g trachex`), provider setup (env vars), project creation, ticket workflow, dashboard, MCP config, backup (archive export).

## Tests

- `packages/trachex/src/index.test.ts` — verify the bin entry resolves and `runCli` returns 0 for `--help`; verify the packaged dashboard dist path resolution helper.
- `infra` command: unit-test the compose file path resolution (no Docker in CI).

## Rollout / rollback

- Phase 7 builds on Phases 0-6. Failure = revert phase-7 commit(s). Phase 8 uses the packaged CLI.
