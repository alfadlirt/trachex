# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

Toolchain (verified in Phase 0): pnpm 11, Turborepo 2, TypeScript 7 (native),
Biome 2 at repo root, `tsx` for running TS in tests/dev. Node engine floor is
`>=20`.

---

## Forbidden Patterns

- **No generated-code path hacks.** Workspace packages are consumed via
  `workspace:*` + `exports` pointing at TypeScript source, never via relative
  `../` paths into another package.
- **No SQLite types in `@trachex/domain`** (ADR 001). Domain repositories are
  interfaces; storage adapters implement them.
- **No direct canonical mutation by agent output** (ADR 003). Agent output is
  persisted as pending proposals; approval is the only apply path.
- **No enums / namespaces / parameter properties in TS.** `erasableSyntaxOnly`
  is enforced so Node/tsx can strip types at runtime.
- **No secrets in code, logs, or archives.** Provider keys live in the OS
  keychain or env overrides (CI); never browser local storage.

---

## Required Patterns

- Root scripts delegate to turbo: `pnpm lint` = `biome check .` (repo-wide),
  `pnpm typecheck` = `turbo run typecheck`, `pnpm test` = `turbo run test`.
- Every package exposes `typecheck` (`tsc --noEmit`) and `test`
  (`tsx --test src/index.test.ts`).
- `tsconfig.base.json` is the single source of strictness: `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`, `NodeNext`.
- Tests use `node:test` + `node:assert/strict`, run through `tsx --test` so the
  documented Node 20+ floor holds (native Node type-stripping requires
  >=22.18).

---

## Testing Requirements

- Every package has at least one passing test in `pnpm test`.
- Domain unit tests: append-only rules, proposal approval, supersession,
  completion, project scoping, export determinism (Phase 1+).
- SQLite integration tests: migrations, concurrent access, FTS5, archive round
  trips (Phase 1+).

---

## Code Review Checklist

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all green.
- [ ] Workspace imports use `workspace:*` + exports map, no path hacks.
- [ ] No SQLite/Anvia types leak across layer boundaries.
- [ ] No secrets or machine-specific absolute paths.
- [ ] New cross-layer contracts are reflected in `docs/` or spec files.
