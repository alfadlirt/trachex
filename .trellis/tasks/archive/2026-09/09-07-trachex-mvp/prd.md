# Trachex MVP (docs implementation plan)

## Goal

Build the Trachex local-first development traceability layer per `docs/` (architecture.md, implementation-plan.md, ux.md, decisions/). Parent task owns the source requirement set, the phase map, cross-phase acceptance criteria, and the final integration review. It is not the implementation target; the phase children own the deliverables.

## Source of truth

- `docs/architecture.md` — system design, package boundaries, domain model, API/MCP/CLI contracts, security, testing strategy.
- `docs/implementation-plan.md` — phases 0-8, each with deliverables and acceptance criteria, plus execution order, risks, and release gate.
- `docs/ux.md` — dashboard information architecture, ticket canvas, proposal review, adjustment flow, visual system, accessibility.
- `docs/decisions/*.md` — settled ADRs (SQLite-first, global project registry, proposals-before-apply, BlockNote boundary, stdio MCP). Do not re-question these.

## Requirements

### Product

- Trachex is a local-first development traceability layer turning source documents and later adjustments into an append-only, agent-readable checklist for a project that may span multiple repositories/services.
- Three equal clients over the same application/domain services: `trachex` CLI, `trachex mcp` (stdio), and a bundled dashboard via `trachex dashboard`. No second implementation of requirement history, proposal approval, checklist completion, or export.

### Canonical storage (ADR 001)

- SQLite in the global Trachex application directory is canonical for the MVP.
- WAL mode, foreign keys enabled, busy timeout, versioned migrations applied on startup/explicit command, no transaction held across an LLM call.
- Domain repositories must not expose SQLite-specific types; a future PostgreSQL adapter must implement the same contract.
- Qdrant (optional, Docker) is a derived index rebuildable from immutable snapshots; it must never silently switch the canonical database.

### Global registry (ADR 002)

- Projects live in a global application directory and may register multiple repositories/services.
- CLI supports explicit `--project` and an optional active-project shortcut; explicit always wins.
- Repository paths are metadata, not project identity; users must explicitly register context scope; project archives required for portability.

### Proposals before apply (ADR 003)

- All model-generated output ( extraction, reconciliation, impact, scenarios) is persisted as a pending proposal; canonical requirements change only after explicit approval.
- Human completion is a separate direct action; an agent may request a check only via an MCP tool requiring explicit confirmation; completion is never inferred from code or conversation.
- Proposal versions are immutable; editing creates a new reviewed version; rejection leaves source and prior requirements unchanged.

### BlockNote boundary (ADR 004)

- BlockNote is used only for adjustment/source-note editing, never for canonical checklist records. Requirements are structured domain records rendered with custom components.

### Stdio MCP (ADR 005)

- MCP is a local stdio process launched as `trachex mcp --project <slug>`, explicitly project-scoped, with stable narrow tool schemas.

### Domain model

- Project (UUID, unique local slug, name, description, timestamps), Repository (project-scoped slug, service name, root path + history, optional URL), ContextSnapshot (immutable file/dir snapshot).
- Ticket (project ID, ticket key unique within project, title, description, timestamps); Source types: fsd, brd, chat, meeting, clarification, uat, manual, context.
- Requirement: structured record (title, description, source reference + location, scope, lifecycle status active|superseded, dev status unchecked|checked, timestamps, optional parent/group label, typed impacts for services/APIs/pages, generated or reviewed test scenarios). Relationships in a separate table; initial type `supersedes`.
- Proposal lifecycle: pending -> approved | rejected; versions immutable.
- Completion audit: actor type, optional identity, timestamp, optional note.

### Agent (Anvia)

- Pin all Anvia packages to one compatible v1 release line (verified: `@anvia/*` 1.1.2, zod ^4.4.0 peer) and verify APIs during setup.
- Anvia for bounded agent runs/streaming, typed model clients, typed tool validation, SQLite agent memory (where supported), retrieval adapter integration, Lens traces/eval, optional Studio.
- Application code owns identity, project selection, authorization, secrets, canonical persistence + append-only invariants, proposal approval, human completion, snapshot lifecycle, CLI/MCP/dashboard routing.
- Initial agent: one Trachex agent with narrow tools (extract requirements, reconcile adjustments, classify impacts, generate test scenarios, search context, explain baselines). Tools return typed proposals/evidence; domain services decide persistence.

### API surface

- Hono local API serving dashboard assets; routes per `docs/architecture.md` table; JSONL streaming acceptable for chat; handlers validate, call domain services, serialize results.

### MCP contract

- Read tools: get_checklist, get_baseline, get_history, list_tickets, get_requirement. Mutation tools: create_ticket, add_adjustment, approve_proposal, reject_proposal, check_item, export_summary. Mutations assert human intent (check_item requires confirm: true). No generic command-execution tool.

### CLI contract

- Commands per `docs/architecture.md` CLI table (project create/use/list/repo add, context ingest, ticket new/show, adjustment, proposal list/approve/reject, check, export, dashboard, mcp, infra up/down, project export). `ticket new` snapshots source, extracts requirements, stores pending proposals — never silently approves.

### Security and privacy

- Provider keys never in browser local storage; env vars may override for CI; keychain-backed profiles for interactive use; dashboard binds localhost by default; MCP stdio + project-scoped; logs avoid raw source and secrets; export archives exclude provider secrets and embeddings by default.

### UX (docs/ux.md)

- Ticket canvas is the primary object; current checklist is the main artifact; proposal review, inline adjustment flow, timeline/history, impact panels, export, embedded chatbot; responsive mobile layout with drawers/tabs; checklist completion always a deliberate human action; chat changes appear as pending proposals.

## Cross-phase acceptance criteria

- A user can complete the entire MVP workflow (project -> ticket/source -> extraction proposal -> approval -> checklist -> adjustment proposal -> approval -> human check -> Markdown/JSON export) via CLI alone.
- CLI, MCP, and dashboard consume the same completed domain operations.
- Dashboard works with SQLite and no Docker; browser never accesses SQLite directly; dashboard and CLI run concurrently.
- Agent output cannot directly mutate canonical requirements; failed/malformed model output is retained as an error without corrupting the ticket.
- MCP cannot cross the selected project boundary; no item is marked complete without explicit human confirmation.
- [x] One real ticket completes the full flow; all adjustments have source and timestamps; direct conflicts are detected and require approval; export includes timeline, current checklist, impacts, scenarios, and history. (Verified: `pnpm eval` → 8/8 harness + ACCEPTANCE PASS)

## Release gate (docs/implementation-plan.md Phase 8)

- One real ticket completes the full flow.
- All adjustments have source and timestamps.
- Direct conflicts are detected and require approval.
- Human completion is never inferred.
- Export includes timeline, current checklist, impacts, scenarios, and history.

## Task map

| Task | Phase | Deliverable |
| --- | --- | --- |
| 09-07-phase-0-bootstrap | 0 | pnpm/Turbo workspace, TS ESM, Biome, package skeleton, env example, build/typecheck/lint/test |
| 09-07-phase-1-sqlite-foundation | 1 | app-dir resolver, SQLite manager + migrations, full schema, repositories, archive export/import |
| 09-07-phase-2-snapshots-retrieval | 2 | source ingestion, immutable snapshots, chunking, FTS5, optional Qdrant |
| 09-07-phase-3-agent-proposals | 3 | provider config, Anvia agent factory, extraction/reconciliation, impacts/scenarios, search tool, memory, observers |
| 09-07-phase-4-cli | 4 | full CLI per contract |
| 09-07-phase-5-mcp | 5 | stdio MCP server + tools |
| 09-07-phase-6-api-dashboard | 6 | Hono API + React dashboard |
| 09-07-phase-7-packaging-infra | 7 | publishable package, infra up/down, Studio runner, docs |
| 09-07-phase-8-eval-hardening | 8 | eval corpus, Lens eval CLI, security review, release gate |

Dependency ordering (written into child artifacts, not implied by tree position): 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8. Each phase builds on the previous; a phase may be planned before its predecessor is complete but must not be started until the predecessor's acceptance criteria pass.

## Constraints

- Node.js 20+, TypeScript ESM, pnpm 11, Turborepo 2, root Biome.
- Anvia pinned to one verified v1 release line (1.1.2).
- No Docker required for the basic workflow; Qdrant/Studio optional and explicit.
- No provider credentials in archives, logs, or package output.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Complex tasks: add `design.md` and `implement.md` before `task.py start`.
