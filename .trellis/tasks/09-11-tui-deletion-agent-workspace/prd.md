# TUI lifecycle, deletion, and agent workspace

## Goal

Keep the TUI alive with empty-state navigation, add safe project/subject/checklist deletion, and define agentic RAG/chat capabilities for the checklist workspace.

## Requirements

- `trachex tui` must remain in a persistent workspace loop when projects, subjects, or checklist items are absent. Empty states expose actions such as create/select project, create/select subject, add checklist item, settings, and quit.
- Cancelling a prompt returns to the previous menu or workspace. The TUI exits only through an explicit Quit action or Ctrl+C; empty data and cancelled forms must not terminate it.
- Normal delete actions archive/deactivate projects, subjects, and checklist items while preserving their history, sources, proposals, audits, and relationships. Permanent deletion is a separate destructive operation requiring explicit confirmation and a force-style safeguard.
- Deleting a checklist item archives its entire active descendant subtree by default. Superseded and archived items remain visible in a clearly separated history section with readable status, replacement/parent relationships, and no misleading active checklist markers.
- Add a first agentic workspace flow in the TUI: users can ingest an FSD, requirement description, local document, note, or URL as subject evidence; the agent retrieves the relevant evidence and produces a proposed checklist with source references, impacts, scenarios, and open questions.
- Proposed checklist output remains pending until a human reviews and approves it. After approval, users can add/edit/supersede/reorder/check/uncheck items in the same TUI and export a structured baseline for a coding agent.
- The agentic workspace must distinguish source evidence, agent reasoning/proposals, canonical checklist items, and human completion state. Agent output must never directly mark work complete or silently mutate canonical requirements.
- The TUI intake form supports local files, multiline pasted content, requirement descriptions/notes, URLs, and optional repository selection. Intake records source type, attribution, location/link, timestamp, and selected repository scope before extraction.
- Agent checklist proposals support approve all, reject all, and per-item selection before applying accepted items. Rejected items remain in proposal history with their evidence and decision status.
- During proposal review, users can edit proposed titles, descriptions, parent placement, impacts, and scenarios before approval. These human edits are recorded as proposal edits and the final accepted checklist remains traceable to both the original agent output and the human revision.
- Each proposed item shows a compact source citation in the tree and an evidence panel with source excerpts, retrieval metadata, related documents, and selected repository scope. URL evidence is snapshotted with fetch time/status rather than treated as a live untracked reference.
- The agentic roadmap in this task includes: TUI source intake and editable proposal generation; a read-only assistant in TUI, dashboard, and MCP; a structured coding-agent baseline/context pack; and agent challenge/review that produces pending findings or checklist proposals. Cross-repository implementation verification against source code and Git history remains future work and must not be claimed as implemented.
- Agent challenge/review findings are split into read-only reports for informational observations and editable pending proposals when a finding implies a checklist change. Each finding includes severity, evidence citations, affected subject/item/repository, confidence, and suggested action; no finding becomes canonical automatically.
- Persist subject-scoped chat and agent review activity as traceable history: messages, retrieved evidence references, agent run metadata, findings, proposal links, and human approval/rejection/edit decisions. Never persist provider secrets or unnecessary raw prompts.

## Acceptance Criteria

- [ ] `trachex tui` remains open in a persistent workspace loop when there are no projects, subjects, or checklist items; empty-state menus offer create/select/add/settings/quit actions.
- [ ] Cancelling any TUI prompt returns to the previous menu or workspace; only explicit Quit or Ctrl+C exits.
- [ ] Normal project, subject, and checklist deletion archives/deactivates data while preserving traceability; permanent deletion is separate, explicit, and force-protected.
- [ ] Deleting a checklist item archives its entire active descendant subtree, and active, superseded, and archived history render in clearly separated sections with accurate statuses and relationships.
- [ ] TUI intake supports local file, multiline text, description/note, URL, and optional repository selection, recording source provenance and URL snapshot status.
- [ ] Agent extraction produces an editable pending checklist proposal grounded in retrieved evidence; users can edit fields, approve all, reject all, or selectively approve items.
- [ ] Approved proposal items become canonical only after human action; rejected items and proposal edits remain auditable.
- [ ] Read-only assistant is available through shared services for TUI, dashboard, and MCP with evidence citations and no direct canonical mutation.
- [ ] MCP exposes a structured subject baseline/context pack suitable for coding agents, including current checklist, evidence, history, impacts, repository scope, open questions, and scenarios.
- [ ] Agent challenge/review produces both informational reports and editable pending proposals with severity, confidence, affected scope, evidence, and suggested action.
- [ ] Chat and review-run history persist subject-scoped metadata and decisions without provider secrets or unnecessary raw prompts.
- [ ] Cross-repository implementation verification against source code and Git history is explicitly deferred and not represented as available behavior.

## Scope

In scope: persistent TUI lifecycle, archive/destructive deletion controls, history rendering, evidence intake, editable proposal review, shared read-only assistant, coding-agent baseline, challenge/review findings, and traceable agent activity.

Out of scope: reliable source-code/Git implementation verification across repositories, automatic completion, silent proposal application, and provider-secret persistence.

## Constraints

- SQLite remains canonical; Qdrant/FTS are derived retrieval indexes.
- Agent output remains pending until human approval.
- TUI and other clients use domain/application services rather than direct SQLite mutation.
- Existing dummy data may be reset if schema changes require it.

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
