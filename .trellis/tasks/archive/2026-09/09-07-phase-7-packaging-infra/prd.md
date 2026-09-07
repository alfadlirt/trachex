# Phase 7: Packaging and Optional Infrastructure

## Goal

Make Trachex installable as one `trachex` package with an executable entry point that composes the CLI, API, MCP server, domain, storage, and built dashboard assets. Add platform-specific startup/data-dir checks, `trachex infra up/down` for optional Qdrant Docker Compose, an optional Anvia Studio runner, and user documentation.

Source of truth: `docs/implementation-plan.md` Phase 7, `docs/architecture.md` Distribution + Global Application Layout + Security.

## Requirements

- Publishable `trachex` package with a `bin` executable entry point.
- The published package composes CLI, API, MCP, domain, storage, and built dashboard assets (docs/architecture.md Package Boundaries).
- Bundled dashboard assets included in package output.
- Platform-specific startup and data-directory checks (app dir resolver already exists in `packages/shared`; ensure the CLI verifies/creates it).
- `trachex infra up|down` for optional Qdrant Docker Compose (`docker-compose.dev.yml`); explicit and reversible; never silently switches canonical DB.
- Optional Studio runner for agent development (`@anvia/studio`).
- Documentation: npm installation, provider setup, project creation, dashboard, MCP, backup.

## Acceptance Criteria

- [ ] A fresh user can install one package and run CLI commands.
- [ ] `trachex dashboard` works without Docker.
- [ ] Optional Qdrant setup is explicit and reversible (`infra up`/`infra down`).
- [ ] No provider credentials are included in archives or package output.

## Dependency order

- Depends on Phases 0-6. Phase 8 (eval/hardening) depends on this phase's packaged CLI for the real-ticket acceptance test.

## Notes

- The published package is a thin composition package (`packages/trachex` or a root-level `trachex` package) that re-exports the CLI entry and wires the built dashboard assets path.
- `infra up/down` shells out to `docker compose -f docker-compose.dev.yml`.
- Docs live in `docs/` (e.g. `docs/usage.md` or a README section) — no separate site.
