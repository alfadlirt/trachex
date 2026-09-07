# Phase 4: CLI — Design

## Package layout (`packages/cli`)

- `src/index.ts` — entrypoint: parse `process.argv`, route to command handlers, map errors to exit codes, wire `--json`.
- `src/args.ts` — small helper wrapping `node:util` `parseArgs` for each command's options.
- `src/context.ts` — resolve the active project: read `config.json` in the app dir for `activeProject`; explicit `--project` wins; helpers `requireProject(appDir, { project?, cwd })`.
- `src/commands/*.ts` — one module per command group: `project.ts`, `context.ts`, `ticket.ts`, `adjustment.ts`, `proposal.ts`, `check.ts`, `export.ts`, `infra.ts` (stub), `dashboard.ts` (stub), `mcp.ts` (stub).
- `src/export.ts` — Markdown + JSON serializers over `buildExportSummary`.
- `src/errors.ts` — exit-code mapping (0 ok, 1 generic, 2 usage, 3 not-found/conflict typed domain errors) + `CliError`.
- `src/io.ts` — output helpers: `print`, `printJson`, interactive prompt via `node:readline/promises`.

## Active project / config

- `config.json` in `trachexAppDir()` holds `{ activeProject?: string }`. `project use <slug>` writes it; every command resolves `--project` else `activeProject` else error "no project selected".

## Command behaviors

- `project create <slug> --name <name>` → `createProject`; prints id/slug.
- `project use <slug>` → validate exists, write config.
- `project list` → table of projects.
- `project repo add <project> --name <slug> --path <path>` → `registerRepository`.
- `context ingest <project> --repo <slug> --include <paths>` → read files under include paths, ingest as `context` sources (Phase 2 `ingestFile`).
- `ticket new <key> --project <slug> --fsd <file>` → read file, `createTicket`, `runExtraction` (real agent) → print source + pending proposals. If no provider key: fail with clear error; `--no-agent` flag reads a fixture path for offline/dev use.
- `ticket show <key> --project <slug>` → print ticket + checklist + pending proposals.
- `adjustment <key> --project <slug> --source <type> --from <actor> --note <text>` → `runReconciliation` → pending proposal.
- `proposal list --project <slug>` → pending proposals with versions.
- `proposal approve <id> --project <slug>` → `approveProposal`; `--json` structured; interactive confirmation unless `--yes`.
- `proposal reject <id> --project <slug>` → `rejectProposal`.
- `check <key> <requirement-id> --project <slug>` → `checkRequirement` with actor `human`; requires explicit confirmation unless `--yes`.
- `export <key> --project <slug> --format markdown|json` → `buildExportSummary` → serialize; write to stdout or `--out <file>`.
- `project export <slug> --out <archive>` → `exportProjectArchive`.
- `dashboard` / `mcp` / `infra` → stubs printing "not yet implemented" with exit 0 (real in Phases 5-7).

## Error handling / exit codes

- Domain errors → exit 3 (not found/conflict) with `{ error: { code, message } }` on `--json`.
- Usage errors → exit 2.
- Pipeline/provider errors → exit 1.
- Success → exit 0.

## Tests

- `src/export.test.ts` — Markdown contains PRD sections; JSON round-trips.
- `src/context.test.ts` — active project resolution + `--project` precedence.
- `src/commands.test.ts` — end-to-end workflow against a temp app dir + SQLite: project create → repo add → ticket new (with `--no-agent` fixture) → proposal list → approve → check → export. Assert exit codes and outputs.

## Rollout / rollback

- Phase 4 builds on Phases 1-3. Failure = revert phase-4 commit(s). Phase 5 (MCP) and Phase 6 (dashboard) reuse the same domain services.
