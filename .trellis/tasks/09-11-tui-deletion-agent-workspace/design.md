# Technical Design

## Boundaries

The adjustment spans CLI/TUI presentation, domain lifecycle services, SQLite persistence, source ingestion, agent retrieval/proposal workflows, dashboard/API assistant access, and MCP baseline/review contracts. Shared application services remain the mutation boundary for every client.

## TUI lifecycle

- Replace one-shot empty-state returns with a top-level workspace loop.
- Empty project state offers create project, refresh/select, settings, and quit.
- Empty subject state offers create subject, select/refresh, back, settings, and quit.
- Empty checklist state offers intake, add manual item, refresh, back, and quit.
- Prompt cancellation returns to the caller menu. Quit and Ctrl+C are the only exits.
- Keep an explicit error boundary around each action so a failed mutation returns to the workspace with an error message rather than terminating the process.

## Deletion and history

- Add typed archive/deactivate services for projects, subjects, and requirements.
- Archive a requirement subtree by traversing active `parentId` descendants, preserving sources, relationships, proposals, completion audits, and timestamps.
- Active checklist view excludes archived rows; history view labels superseded versus archived and shows replacement/parent relationships.
- Add separate permanent-delete services/commands guarded by exact-name confirmation plus a force flag. Permanent deletion must clean dependent rows in FK-safe order and be unavailable from ordinary one-click actions.
- Archive subject/project behavior must define dependent scope explicitly and never silently orphan active requirements or source records.

## Evidence intake and proposals

- Add a TUI intake form with source mode: local file, pasted text, description/note, or URL.
- URL ingestion snapshots fetched content with URL, fetch timestamp, status, and failure metadata; live URLs are not used as untracked evidence.
- Optional repository selection is recorded as subject scope before extraction.
- Reuse the existing extraction/reconciliation pipeline to create pending proposals, extending proposal output with evidence references, impacts, scenarios, open questions, and stable proposed-item identifiers.
- Proposal review projects editable drafts over the original model output. Approve-all, reject-all, and per-item selection apply only accepted items; edits and decisions remain auditable.

## Shared assistant and baseline

- Add a shared read-only assistant service that accepts subject/project scope, question, and retrieval limits.
- Retrieval combines active checklist, archived/superseded history, ingested source chunks, project context, repository assignments, proposals, and review findings.
- Responses include evidence citations and explicit uncertainty; assistant tools cannot check items, archive data, or apply proposals.
- Expose the same service to TUI chat, dashboard/API chat, and MCP.
- Add a structured subject baseline/context contract for coding agents: current checklist tree, source evidence, history, repository scope, impacts, scenarios, open questions, pending proposals, and recent review findings.

## Challenge/review

- Add a review run service that asks the agent to inspect the baseline and retrieved evidence for contradictions, uncovered requirements, stale documentation, missing scenarios, and possible gaps.
- Informational findings remain report rows. Findings that imply checklist changes become editable pending proposals.
- Every finding stores severity, confidence, affected subject/item/repository, evidence references, suggested action, run metadata, and human decision state.
- Do not implement source-code/Git verification in this task; keep the review contract extensible for that future capability.

## Persistence and retention

- Persist subject-scoped chat sessions/messages, retrieval references, run metadata, findings, proposal links, and human decisions without provider secrets or unnecessary raw prompts.
- Maintain append-only evidence and decision history. Derived indexes may be rebuilt from snapshots and canonical records.

## Risks and controls

- Accidental TUI exit: centralized loop/action boundary tests for empty states, cancellation, errors, and Ctrl+C.
- Data loss: archive-first default, exact confirmation for permanent deletion, subtree/archive integration tests.
- Unsupported claims: assistant citations and explicit future boundary for source/Git verification.
- Scope leakage: every assistant, proposal, review, and deletion operation validates project/subject ownership.
- Contract drift: TUI, dashboard, and MCP consume shared typed assistant/baseline projections.
