# Supersede cause visibility for mid-development adjustments

## Goal

When an adjustment supersedes a previously-checked checklist item, Trachex lets the LLM propose what changed, why (cause), from which source, by whom, what replaced it, and what work is now stale. A human can inspect and edit the complete proposal before explicitly confirming it. Only then does canonical checklist state change. The demo runbook reproduces this flow and the eval suite locks it.

## Background

- `adjustment` → `runReconciliation` lets the LLM decide `supersedes`; the demo often produces no superseded items at all.
- `subjectChecklist` (`packages/cli/src/commands/subject.ts:93-101`) prints only `~~old~~ (superseded by new)` with no source, attribution, note, or audit.
- The static fixture models 3 tickets, but approval enforces same-ticket supersede (`packages/domain/src/services.ts:496`) and the checklist view is per-ticket — fixture and runbook disagree.
- `runReconciliation` already creates a pending proposal, and `approveProposal` applies `supersedes` only during approval.
- `editProposal` exists in the domain but is not exposed through the CLI/MCP review workflow.
- MCP `approve_proposal` currently approves without a required `confirm: true` gate.

## Requirements

- Single-ticket adjustment model: clarification and UAT are sources on the subject's own ticket.
- Deterministic demo path plus documented repair branch when a proposal lacks `supersedes`.
- Agentic proposal path: the LLM may identify additions, clarifications, contradictions, and supersession candidates, but must never mutate canonical requirements directly.
- Core demo contract: this clarification explicitly changes the original trial-conversion meaning, so the LLM is expected to propose a supersession. The deterministic eval must fail if it omits the original requirement from `supersedes`; this tests agent reasoning, not a forced direct mutation.
- Human review path: expose proposal details and a review/edit operation so a user can change titles, descriptions, scenarios, impacts, and `supersedes` targets before approval.
- Human confirmation gate: CLI and MCP approval require explicit confirmation; rejecting or leaving a proposal pending leaves the current checklist unchanged.
- Superseded entries render cause: old item + check audit, replacement, source type/attribution/location/note.
- Provider-free evals lock approval mechanics, relation rows, audit preservation, and view shape.
- Runbook asserts expected outputs instead of prose verification.
- MCP/AI answers summarize requirement drift from the initial baseline through the current state and refuse to invent missing facts.
- When evidence is insufficient or contradictory, the answer directs the user to ask the BA immediately and add the missing context with `subject add-doc`.

## Acceptance Criteria

- [ ] Following the runbook always yields a visible `# Superseded` entry with cause, or a documented repair step that gets there.
- [ ] A reader can answer what/when/why/from-whom/replaced-by/what-is-stale from checklist output alone.
- [ ] Eval suite fails if supersede mechanics regress (no supersedes → no silent pass).
- [ ] Fixture shape is reproducible by the runbook (same-ticket rule holds).
- [ ] A user can ask for the requirement drift count and receive a source-backed initial/current/superseded/added/unchecked summary without rereading all requirements.
- [ ] An unsupported drift or cause question produces the documented BA escalation response rather than speculation.
- [ ] An LLM-generated supersession remains pending and editable until explicit human approval.
- [ ] Approval without explicit human confirmation is rejected, and rejected/unapproved proposals do not alter checklist state.
- [ ] Manual and MCP proposal review expose the source, attribution, note, affected old requirements, proposed new requirements, and supersession links.

## Out Of Scope

- Cross-ticket subject timeline views.
- Provider/LLM prompt tuning beyond the deterministic fixture path.

## Task Map

- `09-12-supersede-model` — single-ticket model + fixture alignment (first).
- `09-12-supersede-eval` — provider-free evals (second).
- `09-12-supersede-rendering` — cause rendering in view + CLI (third).
- `09-12-supersede-runbook` — assertion-style runbook (last).
