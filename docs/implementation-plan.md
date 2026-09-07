# Trachex Implementation Plan

## Delivery Principle

Build one trustworthy vertical slice before broadening infrastructure:

```text
project -> ticket/source -> extraction proposal -> approval
       -> checklist -> adjustment proposal -> approval
       -> human check -> Markdown/JSON export
```

The CLI, MCP server, and dashboard should consume the same completed domain operations rather than being built as separate feature tracks.

## Phase 0: Repository Bootstrap

### Deliverables

- pnpm 11 workspace and Turborepo 2 configuration.
- TypeScript ESM configuration for Node packages.
- Root Biome configuration.
- Package skeleton from `docs/architecture.md`.
- Node.js 20+ engine check.
- `.env.example` with provider, Lens, optional Qdrant, and dashboard settings.
- Basic build, typecheck, lint, and test scripts.

### Acceptance criteria

- `pnpm install`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` work on a clean checkout.
- Workspace packages can import shared source without generated-code path hacks.
- Anvia package versions are aligned to one verified v1 release line.

## Phase 1: Global Registry and SQLite Foundation

### Deliverables

- Platform-specific application-directory resolver.
- SQLite connection manager with WAL, foreign keys, timeout, and migration runner.
- Schema for projects, repositories, tickets, sources, snapshots, chunks, requirements, relationships, impacts, scenarios, proposals, proposal versions, completion audits, sessions, messages, errors, and export artifacts.
- Repository implementations and domain service interfaces.
- Project slug and ticket-key uniqueness constraints.
- Archive export/import with manifest and schema version.

### Acceptance criteria

- A project can contain multiple repositories.
- A project and ticket survive process restart.
- Two processes can read/write safely under normal short transactions.
- Project archive round-trips without secrets.

## Phase 2: Source Snapshots and Retrieval

### Deliverables

- Source ingestion for files and pasted notes.
- Immutable snapshot storage with content hashes.
- Chunking with source location metadata.
- SQLite FTS5 indexing and search repository.
- Optional Qdrant adapter and Compose file; Qdrant remains derived.

### Acceptance criteria

- Re-ingesting a changed file creates a new snapshot and preserves the old one.
- Search results include source and location provenance.
- Local mode works without Docker.
- Qdrant can be rebuilt from project snapshots.

## Phase 3: Anvia Agent and Proposal Pipeline

### Deliverables

- Provider configuration resolver: keychain, environment override, global non-secret config.
- Anvia agent factory with typed schemas and bounded turns.
- Extraction prompt and output schema.
- Reconciliation prompt and output schema.
- Impact classification and test-scenario generation.
- Context search tool using the active retrieval adapter.
- SQLite-backed Anvia memory integration, verified against the selected Anvia version.
- Optional Lens and Pino observers.

### Acceptance criteria

- `ticket new` creates a source and pending extraction proposals.
- `adjustment` creates a source and pending reconciliation proposals.
- Agent output cannot directly mutate canonical requirements.
- Failed or malformed model output is retained as an error/proposal failure without corrupting the ticket.

## Phase 4: CLI

### Deliverables

- Global project selection and active-project shortcut.
- Project/repository/context commands.
- Ticket creation, inspection, adjustment, proposal review, check, and export commands.
- Interactive proposal review plus `--json` and non-interactive modes.
- Consistent exit codes and machine-readable errors.

### Acceptance criteria

- A user can complete the entire MVP workflow without the dashboard.
- No command requires a repository current working directory.
- Explicit `--project` works from any directory.
- Markdown output matches the PRD structure; JSON output contains equivalent structured information.

## Phase 5: MCP

### Deliverables

- Stdio server launched by `trachex mcp --project <slug>`.
- Read and mutation tools from the architecture contract.
- Zod input/output schemas.
- Explicit confirmation for human-completion mutation.
- Structured errors and stable tool descriptions for coding agents.

### Acceptance criteria

- An MCP client can retrieve a complete baseline for a ticket.
- An agent can create an adjustment proposal and inspect its status.
- An agent cannot mark an item complete without explicit confirmation.
- MCP cannot cross the selected project boundary.

## Phase 6: Local API and Bundled Dashboard

### Deliverables

- Hono server started by `trachex dashboard`.
- Static serving of the built React application.
- Project list and ticket navigation.
- Ticket canvas with current checklist as the main artifact.
- Proposal review and approval.
- Inline adjustment flow.
- Timeline/history and impact panels.
- Export controls.
- Embedded chatbot using the same application services and Anvia agent.
- Responsive mobile layout with drawers/tabs.

### Acceptance criteria

- Dashboard works with SQLite and no Docker.
- Browser never accesses SQLite directly.
- Dashboard and CLI can run concurrently.
- Every checklist completion remains a deliberate human action.
- Chat-created changes appear as pending proposals, not silent mutations.

## Phase 7: Packaging and Optional Infrastructure

### Deliverables

- Publishable `trachex` package with executable entry point.
- Bundled dashboard assets included in package output.
- Platform-specific startup and data-directory checks.
- `trachex infra up/down` for optional Qdrant Docker Compose.
- Optional Studio runner for agent development.
- Documentation for npm installation, provider setup, project creation, dashboard, MCP, and backup.

### Acceptance criteria

- A fresh user can install one package and run CLI commands.
- `trachex dashboard` works without Docker.
- Optional Qdrant setup is explicit and reversible.
- No provider credentials are included in archives or package output.

## Phase 8: Evaluation and Hardening

### Deliverables

- Fixed evaluation corpus and Lens eval CLI.
- Golden extraction/reconciliation cases.
- Direct conflict tests such as discount cap changes.
- Impact classification scoring.
- FTS5 grounding and source citation checks.
- Performance measurements for extraction under two minutes on a representative document.
- Security review of source handling, logs, archives, and local API binding.

### Release gate

- One real ticket completes the full flow.
- All adjustments have source and timestamps.
- Direct conflicts are detected and require approval.
- Human completion is never inferred.
- Export includes timeline, current checklist, impacts, scenarios, and history.

## Suggested Execution Order

1. Bootstrap workspace and shared schemas.
2. Implement SQLite schema/migrations and project registry.
3. Implement source snapshots and deterministic export.
4. Implement domain commands without AI using fixtures.
5. Add Anvia extraction/reconciliation behind interfaces.
6. Add CLI and complete the vertical slice.
7. Add MCP over the same services.
8. Add Hono API and dashboard ticket canvas.
9. Add FTS5 agent search, optional Qdrant, and Lens evals.
10. Package, document, and run the real-ticket acceptance test.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Anvia APIs/packages shift | Pin one v1 release line; isolate integration in `packages/agent`; add contract tests |
| Rich editor undermines append-only history | Keep BlockNote outside canonical checklist records |
| AI silently changes requirements | Persist proposals first; domain approval is the only apply path |
| SQLite locking under long agent calls | Never hold DB transactions across model calls; enable WAL |
| Qdrant becomes an accidental source of truth | Rebuild it from snapshots; keep canonical data in SQLite |
| Multi-repository scope becomes noisy | Require explicit repository/context registration and include paths |
| Browser exposes secrets | Use keychain/server-side provider resolution; no local storage keys |
| UI becomes chat-first | Keep checklist center-stage and chat contextual |
