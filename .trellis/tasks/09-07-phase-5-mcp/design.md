# Phase 5: MCP — Design

## Stack

- `@modelcontextprotocol/sdk` (v1.x) — `Server`, `StdioServerTransport`, `ListToolsRequestSchema`, `CallToolRequestSchema`, `ToolSchema`.
- Zod for tool input/output schemas.
- Same domain services as CLI: `packages/mcp` depends on `@trachex/domain`, `@trachex/storage-sqlite`, `@trachex/agent` (for `add_adjustment` reconciliation).

## Package layout (`packages/mcp`)

- `src/server.ts` — `createMcpServer({ appDir, projectSlug })`: opens the app, resolves the project, builds a `Server` with `tools/list` and `tools/call` handlers. Every tool resolves ids against the scoped project; anything outside → structured error.
- `src/tools.ts` — tool registry: name, description, inputSchema, handler(uow, ctx, input). Each handler enforces project scoping.
- `src/run.ts` — `runMcpServer({ appDir, projectSlug })`: `new StdioServerTransport()`, `server.connect(transport)`.
- `src/index.ts` — barrel + `main(argv)` used by the CLI `mcp` command.

## Tools (per architecture contract)

Read tools:
- `get_checklist(ticketKey)` → active requirements for the ticket (scoped).
- `get_baseline(ticketKey)` → `buildExportSummary`-style context pack: current checklist, history, impacts, scenarios, timeline, open proposals.
- `get_history(ticketKey)` → superseded requirements + timeline events.
- `list_tickets()` → tickets in the scoped project.
- `get_requirement(requirementId)` → single requirement (must belong to scoped project).

Mutation tools:
- `create_ticket({ key, title, description? })` → `createTicket`; returns ticket.
- `add_adjustment({ ticketKey, source, attribution?, note })` → ingests note + `runReconciliation` → returns pending proposal id/status. (Creates pending proposal; does NOT apply.)
- `approve_proposal({ proposalId })` → `approveProposal` (proposal must belong to scoped project).
- `reject_proposal({ proposalId })` → `rejectProposal`.
- `check_item({ requirementId, confirm })` → requires `confirm === true`; else structured error `CONFIRMATION_REQUIRED`. Records human completion audit.
- `export_summary({ ticketKey, format })` → returns Markdown or JSON summary string.

## Scoping

- Server is constructed with exactly one `projectSlug` (ADR 005).
- Each handler resolves the project by slug; ticket lookups use `findByProjectAndKey(project.id, key)`; requirement/proposal lookups verify `requirement.projectId === project.id` / `proposal.ticketId` belongs to a ticket in the project.
- Any violation → `{ isError: true, content: [{ type: 'text', text: JSON.stringify({ code: 'SCOPING', message }) }] }`.

## Confirmation

- `check_item` schema: `{ requirementId: string, confirm: z.literal(true) }` — if `confirm` is not `true`, the schema rejects or the handler returns `CONFIRMATION_REQUIRED`.
- `approve_proposal`/`reject_proposal`/`add_adjustment` create pending proposals or require the agent to explicitly call the mutation; no generic command-execution tool.

## Errors / serialization

- Tool results: `{ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }`.
- Errors: `{ isError: true, content: [{ type: 'text', text: JSON.stringify({ code, message }) }] }` with stable codes (NOT_FOUND, CONFLICT, SCOPING, CONFIRMATION_REQUIRED, INTERNAL).

## Tests

- `src/tools.test.ts` — contract tests against a temp app dir + SQLite:
  - get_baseline returns checklist + history + proposals.
  - add_adjustment creates a pending reconciliation proposal (fixture runAgent).
  - check_item without confirm → CONFIRMATION_REQUIRED; with confirm → checked + audit.
  - scoping: a requirement from another project is rejected.
  - export_summary returns markdown/json.
- `src/server.test.ts` — `tools/list` returns all 11 tools; `tools/call` dispatches.

## Rollout / rollback

- Phase 5 builds on Phases 1-4. Failure = revert phase-5 commit(s). CLI `mcp` command wires `runMcpServer`.
