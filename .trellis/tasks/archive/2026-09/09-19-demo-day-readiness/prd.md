# Assess demo day readiness and remaining implementation work

## Goal

Analyze the current codebase and project requirements, identify completed and missing demo-day capabilities, and produce a prioritized implementation roadmap.

## Background

The project is a local-first requirements traceability product. Its core demo story is: ingest a source document, generate a pending AI proposal, require human approval, show the active checklist and preserved superseded history, accept a later adjustment, and export a development summary. The repository also contains a separate reference architecture describing PostgreSQL, Qdrant, Lens, and a broader agent stack; that architecture is not the current Trachex MVP contract.

## Confirmed Repository Facts

- The core domain, CLI, MCP server, local Hono API, React dashboard, SQLite persistence, FTS5 retrieval, proposal lifecycle, supersession history, completion audits, exports, and fixture scenario are implemented.
- A ticket canvas UI already renders the checklist, completion controls, pending proposal approval/rejection, adjustment submission, impacts, scenarios, timeline, chat, and Markdown/JSON export in `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx`.
- The ticket canvas does not currently render proposal contents. Its API response exposes only proposal `id`, `kind`, and `status`; proposal versions and their `modelOutput`/`editedOutput` remain server-side.
- The domain already supports versioned `editProposal`, but there is no dashboard/API route exposing proposal versions, proposal editing, or a structured proposal diff/review experience.
- The dashboard currently has no document-upload control or document-ingestion endpoint. The visible adjustment flow creates a text-based reconciliation proposal; initial document upload and extraction review are not available end-to-end from the dashboard.
- The canonical storage decision is SQLite. PostgreSQL is explicitly a future adapter in `docs/architecture.md`; it is not required for the MVP or the current release gate.
- Qdrant has configuration, Docker Compose, and an adapter/rebuild seam in `packages/storage-sqlite/src/qdrant.ts`, but no production client, embedding implementation, command wiring, or end-to-end Qdrant retrieval path is present. SQLite FTS5 is the current working retrieval path.
- Evals exist in `packages/agent/src/evals/`, and `pnpm eval` is wired. They are provider-free deterministic harness checks using fixture agent outputs, not a representative live-model dataset with measured prompt/guardrail quality.
- Current quality gates pass: `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- Active work remains around the realistic demo fixture, supersede cause visibility/evals/model/runbook, CLI feedback, MCP lifecycle, and the landing page. These should be completed or explicitly excluded from the demo scope before presentation.

## Requirements

- Identify what is already demoable versus incomplete, using file-backed evidence rather than memory alone.
- Define the smallest credible demo-day vertical slice around the existing Trachex product, not the unrelated broader reference stack.
- Prioritize remaining work into release blockers, recommended polish, and post-demo infrastructure.
- Explicitly assess the remembered PostgreSQL, Qdrant, checklist UI, and eval/guardrail/data-set concerns.
- Record dependencies and observable completion criteria for the recommended demo scope.

## Recommended Demo Scope

- Use SQLite + FTS5 as the canonical demo setup; do not add PostgreSQL unless the demo rubric explicitly requires a server database.
- Treat Qdrant as optional enrichment. Only include it in the demo if an end-to-end rebuild, search, provenance, fallback, and runbook path can be verified; otherwise demonstrate the working FTS5 path honestly.
- Present the existing dashboard ticket canvas as the checklist UI, while improving its demo polish and verifying the full click path rather than rebuilding it.
- Use the deterministic subscription-billing fixture for the reproducible product story, then add a small representative model-eval corpus for extraction, contradiction/supersession, grounding, abstention, and impact classification.
- Keep guardrails centered on typed output validation, pending proposals, explicit human approval, same-ticket supersession, evidence-bound answers, and no inferred completion.

## P0 UI Review Gap

Before demo day, the dashboard must support an inspect-before-approve workflow. A pending proposal should show proposed requirement additions or changes, source attribution, impacts, scenarios, and supersession targets, with current requirement context where applicable. Approval and rejection must remain explicit human actions. Proposal editing is recommended for the full product contract because the domain already supports it, but read-only proposal inspection is the minimum demo requirement.

## Acceptance Criteria

- [ ] The assessment names implemented capabilities and missing capabilities with repository evidence.
- [ ] PostgreSQL, Qdrant, checklist UI, and eval/guardrail/data-set status are each classified as required, optional, or deferred for demo day.
- [ ] The roadmap has P0 demo blockers, P1 recommended improvements, and post-demo items with dependencies.
- [ ] The final recommendation includes one end-to-end demo script and a release gate that can be run on a clean local environment.
- [ ] The assessment does not claim PostgreSQL or Qdrant support that the current code does not provide.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
