# README with end-to-end usage

## Goal

Create a root `README.md` for the Trachex repository that introduces the project and documents how to use it end to end: install, provider setup, project creation, the full ticket workflow, adjustments, dashboard, MCP, optional Qdrant infra, and backup.

Source of truth: `docs/architecture.md`, `docs/implementation-plan.md`, `docs/usage.md`, `docs/ux.md`.

## Requirements

- Root `README.md` at the repository root.
- Project introduction: what Trachex is (local-first development traceability layer), the three equal clients (CLI, MCP, dashboard), and the core idea (append-only, agent-readable checklist per ticket).
- Quick start / install: `npm install -g trachex`, Node 20+ requirement, provider setup (env vars, BYOK, no keys in browser/DB/archives).
- End-to-end usage mirroring `docs/usage.md`:
  - Project creation + active-project shortcut + repo registration + context ingest.
  - Full ticket workflow: `ticket new` → `proposal list` → `proposal approve` → `check` → `export`.
  - Adjustments (reconciliation → pending proposal → approve → supersede).
  - Dashboard (`trachex dashboard`).
  - MCP (`trachex mcp --project <slug>`).
  - Optional Qdrant (`trachex infra up|down`).
  - Backup (`trachex project export`).
- Developer section: monorepo layout (apps/packages), tooling (pnpm, turbo, biome, tsx), and the dev commands (`pnpm install/lint/typecheck/test/build/eval`).
- Link to `docs/` for deeper detail.
- No emojis, no placeholder text, no fabricated features.

## Acceptance Criteria

- [ ] `README.md` exists at the repository root.
- [ ] Covers install, provider setup, project creation, full ticket workflow, adjustments, dashboard, MCP, optional Qdrant, and backup.
- [ ] Developer section documents the monorepo layout and dev commands.
- [ ] Content matches the actual CLI commands and behavior (verified against `docs/usage.md` and the CLI contract).
- [ ] Links to `docs/` for deeper detail.
- [ ] No placeholder text or fabricated features.

## Notes

- Lightweight documentation task; PRD-only is sufficient (no design/implement needed).
- The README complements `docs/usage.md`; it is the entry point, usage.md is the deeper reference.
