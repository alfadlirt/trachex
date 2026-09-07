# Phase 0: Repository Bootstrap

## Goal

Stand up the Trachex monorepo foundation so every later phase builds on a working, verifiable workspace: pnpm workspace + Turborepo 2, TypeScript ESM for Node packages, root Biome, the package skeleton from `docs/architecture.md`, Node 20+ engine check, `.env.example`, and basic build/typecheck/lint/test scripts.

Source of truth: `docs/implementation-plan.md` Phase 0 and `docs/architecture.md` Package Boundaries.

## Requirements

- pnpm 11 workspace (`pnpm-workspace.yaml`, `apps/**` + `packages/**`).
- Turborepo 2 task runner config (`turbo.json`) covering build, typecheck, lint, test, dev.
- TypeScript ESM configuration for Node packages (`"type": "module"`, `NodeNext`), with a per-package tsconfig setup appropriate to each workspace.
- Root Biome 2 configuration (lint + format) applied repo-wide.
- Package skeleton per `docs/architecture.md`:
  - `apps/dashboard`, `apps/api`
  - `packages/domain`, `packages/storage-sqlite`, `packages/agent`, `packages/mcp`, `packages/cli`, `packages/shared`
  - Workspace packages import each other by source/workspace protocol (`workspace:*`) without generated-code path hacks.
- Node.js 20+ engine check enforced (package `engines` and/or `packageManager` fields).
- `.env.example` documenting provider, Lens, optional Qdrant, and dashboard settings.
- Basic build, typecheck, lint, and test scripts that pass on a clean checkout.
- Anvia packages pinned to one verified v1 release line (verified current: `@anvia/*@1.1.2`, peer `zod ^4.4.0`).
- Root `.gitignore` for node_modules, build output, env files, and Trachex runtime data.
- Root `package.json` naming the published `trachex` package and wiring turbo scripts.

## Acceptance Criteria

- [ ] `pnpm install`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` work on a clean checkout.
- [ ] Workspace packages can import shared source without generated-code path hacks (workspace protocol resolves TypeScript source).
- [ ] Anvia package versions are aligned to one verified v1 release line (1.1.2).
- [ ] The package skeleton for all apps/packages from `docs/architecture.md` exists with minimal compilable entrypoints.
- [ ] A trivial cross-package import (e.g. `packages/cli` importing `packages/shared`) typechecks.
- [ ] Node engine >= 20 is declared; tooling versions (pnpm, turbo, biome) match docs.
- [ ] `.env.example` covers provider, Lens, optional Qdrant, and dashboard settings without real secrets.

## Dependency order

- Nothing depends on Phase 0. Every later phase (1-8) depends on this task's acceptance criteria passing.

## Notes

- Reference the sibling course repo `reference_stack.md` for concrete tooling patterns, but the trachex docs are the contract where they conflict.
- No Anvia integration code yet; Phase 0 only pins versions and proves the toolchain works.
