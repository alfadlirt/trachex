// @trachex/mcp
//
// Phase 5 implements the stdio MCP server here, launched by `trachex mcp
// --project <slug>` (ADR 005). Read tools (get_checklist, get_baseline,
// get_history, list_tickets, get_requirement) and mutation tools
// (create_ticket, add_adjustment, approve_proposal, reject_proposal,
// check_item, export_summary) with narrow Zod schemas, explicit project
// scoping, and confirmation for human-intent mutations.
