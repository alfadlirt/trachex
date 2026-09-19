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
- Eval harness (`packages/agent/src/evals/`): fixture-based (no real LLM),
  deterministic in CI. `pnpm eval` runs the harness + the real-ticket
  acceptance test (`packages/cli/src/evals/acceptance.ts`) and exits non-zero
  on failure. Release gate: one real ticket completes the full flow; all
  adjustments have source + timestamps; direct conflicts require approval;
  human completion is never inferred; export includes timeline, checklist,
  impacts, scenarios, history.

---

## Code Review Checklist

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all green.
- [ ] Workspace imports use `workspace:*` + exports map, no path hacks.
- [ ] No SQLite/Anvia types leak across layer boundaries.
- [ ] No secrets or machine-specific absolute paths.
- [ ] New cross-layer contracts are reflected in `docs/` or spec files.

## Static Dashboard Serving Contract

### 1. Scope / Trigger

The API process serves the Vite dashboard in production, so static asset responses are a browser-facing deployment contract.

### 2. Signatures

- `createApp(options?: DashboardOptions)` serves `/api/*` and the dashboard distribution.
- `DashboardOptions.dashboardDist` identifies the built dashboard directory used by tests and production.

### 3. Contracts

- Existing non-HTML dashboard assets return `200` with a MIME type derived from their extension.
- JavaScript modules return `text/javascript`; stylesheets return `text/css`.
- Unknown client-side dashboard paths return `index.html` with `text/html; charset=UTF-8`.
- `/api/*` routes remain JSON/API responses and are registered before the dashboard fallback.

### 4. Validation & Error Matrix

| Condition | Response |
|---|---|
| Existing known asset | `200` with its mapped MIME type |
| Existing unmapped asset | `200 application/octet-stream` |
| Missing dashboard path | `200` with the dashboard HTML fallback |
| API health request | `200 application/json`, never SPA HTML |

### 5. Good/Base/Bad Cases

- Good: serve `main.js` as `text/javascript` and `main.css` as `text/css`.
- Base: use the SPA fallback for `/projects/:id`.
- Bad: return raw asset bytes without `Content-Type`; browsers may refuse the module and render a blank page.

### 6. Tests Required

- Assert the dashboard shell content type and body.
- Assert JavaScript and CSS asset content types.
- Assert a client-side route receives the HTML fallback.
- Assert `/api/health` remains JSON.

### 7. Wrong vs Correct

#### Wrong

```ts
return c.body(readFileSync(candidate));
```

#### Correct

```ts
return c.body(readFileSync(candidate), 200, { 'Content-Type': contentType });
```
