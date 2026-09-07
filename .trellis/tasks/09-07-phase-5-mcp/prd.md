# Phase 5: MCP

## Goal

Implement the stdio MCP server launched by `trachex mcp --project <slug>`, exposing the read and mutation tools from the architecture contract over the same domain services as the CLI. Tools have narrow Zod schemas, return structured JSON, and enforce explicit confirmation for human-intent mutations (ADR 003, ADR 005).

Source of truth: `docs/implementation-plan.md` Phase 5, `docs/architecture.md` MCP Contract + Security, ADR 003/005.

## Requirements

- Stdio server launched by `trachex mcp --project <slug>` (wired into the CLI in Phase 5).
- Read tools: `get_checklist(ticketKey)`, `get_baseline(ticketKey)`, `get_history(ticketKey)`, `list_tickets()`, `get_requirement(requirementId)`.
- Mutation tools: `create_ticket(input)`, `add_adjustment(input)`, `approve_proposal(input)`, `reject_proposal(input)`, `check_item(input)`, `export_summary(input)`.
- Zod input/output schemas for every tool.
- Explicit confirmation: `check_item` requires `confirm: true`; `approve_proposal`/`reject_proposal`/`add_adjustment` create pending proposals or require confirmation where human intent is asserted.
- Structured errors and stable tool descriptions for coding agents.
- MCP cannot cross the selected project boundary (all tools scoped to the `--project` slug; any ticket/requirement/proposal id must belong to that project).

## Acceptance Criteria

- [ ] An MCP client can retrieve a complete baseline for a ticket (`get_baseline`).
- [ ] An agent can create an adjustment proposal and inspect its status (`add_adjustment` → pending; `get_history`/`get_checklist` shows it).
- [ ] An agent cannot mark an item complete without explicit confirmation (`check_item` without `confirm: true` fails).
- [ ] MCP cannot cross the selected project boundary (scoping enforced).
- [ ] All tools have Zod schemas; structured errors returned.
- [ ] Contract tests pass (schemas, scoping, confirmation, serialization).

## Dependency order

- Depends on Phases 1-4 (domain, storage, agent pipeline, CLI wiring). Phase 6 (dashboard) does not depend on MCP but shares services.

## Notes

- Use the standard `@modelcontextprotocol/sdk` (stdio transport) for protocol correctness; tools map to domain services.
- The MCP server is scoped to exactly one project at startup (ADR 005).
