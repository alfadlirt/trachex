# Phase 7: Packaging and Optional Infrastructure — Implement

## Execution order

1. Create `packages/trachex` (composition package): `package.json` (name `trachex`, bin), `bin/trachex.mjs`, `src/index.ts` (re-export runCli + dashboardDist resolution + infra helpers).
2. Add `infra up|down` to the CLI router (delegates to `packages/trachex` or a small helper in cli).
3. Add `docs/usage.md`.
4. Add a build step that copies `apps/dashboard/dist` → `packages/trachex/dist/dashboard` (root turbo `build` or a script).
5. Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` green; `node packages/trachex/bin/trachex.mjs --help` works.

## Validation commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node packages/trachex/bin/trachex.mjs --help
```

## Acceptance review checklist

- [ ] One installable `trachex` package with bin entry.
- [ ] `trachex dashboard` works without Docker (bundled dist).
- [ ] `infra up/down` explicit and reversible.
- [ ] No provider credentials in package output/archives.
- [ ] Docs cover install/provider/project/dashboard/MCP/backup.

## Review gate

Run trellis-check; then finish (spec update + commit + archive).

## Rollback

Revert phase-7 commit(s); Phases 0-6 base stays.
