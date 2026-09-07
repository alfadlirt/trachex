# Phase 0: Repository Bootstrap — Implement

## Execution order

1. Root workspace files: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `.npmrc` (if needed).
2. `pnpm install` with the dev toolchain only (turbo, biome, typescript, tsx, @types/node).
3. Create the six package skeletons + two app stubs per `docs/architecture.md` layout. Phase 0 apps are empty stubs (real content in Phase 6); app dirs exist so the workspace globs match the documented layout.
   - App stubs: `apps/dashboard`, `apps/api` each with a package.json marked for later phases; to keep `turbo`/`pnpm install` clean, give them a minimal `src/index.ts` or defer creation until their phase.
   - Packages: `packages/shared` (has real `src/index.ts` with a trivial export), `packages/{domain,storage-sqlite,agent,mcp,cli}` minimal compilable `src/index.ts`.
4. Wire `packages/cli` to import from `packages/shared` (typecheck + runtime via tsx in a test).
5. Per-package scripts + root turbo delegation; add a trivial node:test in `shared` and `cli` to prove `pnpm test`.
6. Validate: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all green; `pnpm -r typecheck` catches the shared import.

## Validation commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
node -e "import('packages/cli/src/index.ts')"  # or via tsx, if a runnable entry exists
```

## Acceptance review checklist

- [ ] All four root commands green on the committed state.
- [ ] Workspace layout matches `docs/architecture.md`.
- [ ] Shared import typechecks via turbo dependency graph (`^typecheck`).
- [ ] Anvia not yet installed; pinned line recorded (1.1.2) for Phase 3.
- [ ] `engines.node >= 20` + `packageManager pnpm@11.8.0`.

## Review gate

Pass gate before `task.py start`: prd/design/implement reviewed. Post-implementation gate: run trellis-check; then finish (spec update + commit).

## Rollback

Revert bootstrap files to the initial commit (`0516d73`) if acceptance fails irrecoverably.
