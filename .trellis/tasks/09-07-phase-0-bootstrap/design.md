# Phase 0: Repository Bootstrap — Design

Source of truth for layout: `docs/architecture.md` Package Boundaries. Tooling baseline mirrors the verified sibling course monorepo (`../assignment-w6d2-final`) adjusted to the trachex contract (Anvia v1, Biome 2 at root).

## Workspace topology

```text
apps/            dashboard (added Phase 6), api (added Phase 6)
packages/        domain, storage-sqlite, agent, mcp, cli, shared
```

All Node packages are ESM (`"type": "module"`), TypeScript, `NodeNext` module resolution for type-checking. Workspace packages that are consumed by other TS packages export their TypeScript source via the `exports` map (`"exports": { ".": "./src/index.ts" }`) and are resolved with the pnpm workspace protocol (`workspace:*`); apps/dev runners use `tsx`. This is the reference-pattern "import shared source without generated-code path hacks."

## Tooling / versions (verified current at planning time)

| Tool | Version | Notes |
| --- | --- | --- |
| pnpm | 11.8.0 | `packageManager` + `devEngines`; corepack not required (installed) |
| turbo | ^2.10.5 | Turborepo 2 task graph |
| typescript | ^7.0.2 | Native compiler, used by sibling repo |
| tsx | ^4.23 | Dev runner for Node packages that export TS source |
| @types/node | ^26 | matches local Node 26; engines allow >=20 |
| @biomejs/biome | ^2.5.0 | root lint + format |
| dotenv-cli | ^11 | optional env loading (not needed until Phase 3) |

Anvia and Zod are NOT installed in Phase 0; they are only confirmed as a pinned release line (`@anvia/*@1.1.2`, zod ^4.x peer) and introduced when first used (Phase 3) at that line.

## Workspace layout details

- `pnpm-workspace.yaml`: `apps/**`, `packages/**`; `hoistWorkspacePackages: false`.
- Root `package.json`: name `trachex`, private, `type: module`, scripts delegating to turbo (`build`, `typecheck`, `lint`, `test`), `packageManager: pnpm@11.8.0`, `engines.node >= 20`, `devEngines` pinning pnpm.
- `turbo.json`: tasks `build`, `typecheck`, `lint`, `test`, `dev`, `start`. `typecheck` depends on `^typecheck`; `test` depends on `^build`; outputs `dist/**`; persistent `dev`.
- `biome.json`: formatter + linter enabled repo-wide; JSON/formatter; organize imports; ignores `dist`, `node_modules`, `.turbo`.
- `tsconfig.base.json` at root: strict, NodeNext, ESM; per-package tsconfigs extend it.
- Each package: `package.json` (name `@trachex/<pkg>`, exports map to source), `tsconfig.json`, minimal `src/index.ts`.
- Per-package scripts (lightweight in Phase 0, refined per phase):
  - `typecheck`: `tsc --noEmit`
  - `test`: `node --test` against compiled/tsx-runnable tests (a trivial passing test proves wiring)
  - `build`: `tsc` (packages that need emit) — refined in the phase that first needs build artifacts.
- `.env.example` documenting future keys: `OPENAI_BASE_URL`, `OPENAI_API_KEY` (provider profile), `TRACHEX_*` dashboard/API port, `ANVIA_LENS_*`, `QDRANT_URL`/`QDRANT_API_KEY` (optional), plus CI overrides.
- `.gitignore`: node_modules, dist, .turbo, .env, *.local, Trachex runtime data dir, coverage.

## Cross-package import proof

`packages/cli` (or a root smoke package) imports a constant from `packages/shared`; root `typecheck` (turbo, dependsOn `^typecheck`) verifies resolution end-to-end. A trivial shared helper + unit test demonstrates `test` wiring.

## Rollout / rollback

- Phase 0 is greenfield. Failure = revert the uncommitted bootstrap changes; no downstream exists yet.
- Once green, it is the base commit for Phase 1.
