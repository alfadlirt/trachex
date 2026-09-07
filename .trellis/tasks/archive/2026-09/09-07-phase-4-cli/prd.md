# Phase 4: CLI

## Goal

Implement the `trachex` CLI so a user can complete the entire MVP workflow from the terminal, consuming the same domain services as MCP and the dashboard. Includes global project selection + active-project shortcut, project/repository/context commands, ticket creation/inspection/adjustment, proposal review (interactive + `--json` + non-interactive), check, and Markdown/JSON export.

Source of truth: `docs/implementation-plan.md` Phase 4, `docs/architecture.md` CLI Contract + Security, ADR 002.

## Requirements

- Command surface per `docs/architecture.md` CLI Contract:
  - `trachex project create <slug> --name <name>`
  - `trachex project use <slug>`
  - `trachex project list`
  - `trachex project repo add <project> --name <slug> --path <path>`
  - `trachex context ingest <project> --repo <slug> --include <paths>`
  - `trachex ticket new <key> --project <slug> --fsd <file>`
  - `trachex ticket show <key> --project <slug>`
  - `trachex adjustment <key> --project <slug> --source <type> --from <actor> --note <text>`
  - `trachex proposal list --project <slug>`
  - `trachex proposal approve <id> --project <slug>`
  - `trachex proposal reject <id> --project <slug>`
  - `trachex check <key> <requirement-id> --project <slug>`
  - `trachex export <key> --project <slug> --format markdown|json`
  - `trachex dashboard [--project <slug>]` (stub in Phase 4; real in Phase 6)
  - `trachex mcp --project <slug>` (stub in Phase 4; real in Phase 5)
  - `trachex infra up|down` (stub; real in Phase 7)
  - `trachex project export <slug> --out <archive>`
- Global project selection: active-project shortcut stored in global config; explicit `--project` always wins (ADR 002).
- No command requires a repository current working directory; explicit `--project` works from any directory.
- Interactive proposal review plus `--json` and non-interactive modes (`--yes`/`--no`).
- Consistent exit codes and machine-readable errors (typed domain errors → exit codes; `--json` emits structured errors).
- Markdown export matches the PRD structure (Timeline, Current Checklist, Services Impacted, APIs Changed, Pages Impacted, Test Scenarios, Requirement History); JSON export contains equivalent structured info.

## Acceptance Criteria

- [ ] A user can complete the entire MVP workflow without the dashboard (project → repo → ticket new → proposal approve → check → export).
- [ ] No command requires a repository current working directory.
- [ ] Explicit `--project` works from any directory; active-project shortcut works when set.
- [ ] Markdown output matches the PRD structure; JSON output contains equivalent structured information.
- [ ] Proposal review supports interactive, `--json`, and non-interactive modes.
- [ ] Consistent exit codes (0 success, non-zero typed errors) and machine-readable errors.
- [ ] `ticket new` snapshots the source, runs extraction, stores pending proposals — never silently approves (ADR 003).

## Dependency order

- Depends on Phases 1-3 (domain, storage, agent pipeline). Phase 5 (MCP) and Phase 6 (dashboard) consume the same services.

## Notes

- CLI arg parsing: use Node's built-in `node:util` `parseArgs` per command (no new CLI framework) to keep the package light; a small command router in `packages/cli`.
- Export serializers live in `packages/cli/src/export.ts` (Markdown + JSON) so MCP/API can reuse them later.
- The CLI wires the real agent pipeline for `ticket new`/`adjustment`; if no provider key is configured, it should fail with a clear, machine-readable error (or accept a `--no-agent` fixture path for offline use).
