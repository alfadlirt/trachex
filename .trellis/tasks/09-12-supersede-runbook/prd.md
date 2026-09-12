# Assertion-style demo runbook and drift-aware MCP answers

## Goal

Rewrite `demo-checklist-step-by-step.md` steps 9–12 as copy-pasteable commands with expected outputs and a repair branch. Demonstrate that a user can ask an MCP/AI agent how requirements drifted from the initial baseline to the current state without rereading every source document.

## Confirmed Facts

- Step 9 sends free-text `--note`; nothing forces `supersedes` in the proposal.
- Step 10 says "verify old is superseded" with no expected output.
- No `--fixture` deterministic path is documented.
- The user needs a concise history answer covering the initial requirement count, additions, supersessions, current active requirements, and remaining unchecked work.
- Answers must distinguish confirmed repository evidence from unknowns; the agent must not invent a cause, owner, or requirement change.

## Requirements

- Step 9 offers the deterministic `--fixture` reconciliation path as the primary flow.
- Each assert step pastes expected output (proposal JSON with `supersedes`, `checklist --json` fields: `lifecycleStatus`, `supersededByTitle`, source attribution).
- Repair branch: if `view.superseded` is empty, inspect proposal output, re-run with explicit replacement note or `proposal edit`, then approve.
- Assertions mirror the supersede-eval cases 1:1 so demo and eval cannot drift.
- Add MCP/AI questions for drift history, superseded count, source/author/date of each change, and current-vs-original meaning.
- Define an explicit uncertainty response: when the stored checklist, source, relationship, or audit evidence cannot confirm an answer, respond that it cannot be confirmed, advise asking the BA immediately, and instruct the user to add the clarification with `subject add-doc` before relying on the answer.
- Include a final timeline summary showing how many requirements were present initially, how many were added by clarification/UAT, how many were superseded, and how many remain active/unchecked.

## Acceptance Criteria

- [ ] A fresh reader following steps 9–12 sees the `# Superseded` entry with cause or reaches it via the repair branch.
- [ ] Every "verify" step names the exact command and fields to check.
- [ ] Runbook references the single-ticket model (no 3-ticket confusion).
- [ ] The final demo questions can be answered from stored evidence with a requirement-drift count from initial baseline through final state.
- [ ] The runbook demonstrates source/author/date attribution for each confirmed adjustment and identifies the superseded replacement chain.
- [ ] The runbook contains the exact escalation response for missing or contradictory evidence: "We can't confirm that from the available context. Please ask your BA immediately, then add the clarification with `subject add-doc` before relying on this answer."
- [ ] The AI/MCP prompt pack and eval expectations reject unsupported answers and require the escalation response when evidence is insufficient.

## Out Of Scope

- Code changes (covered by sibling children).
- New cross-ticket history views; drift answers must use the existing single-ticket checklist, sources, relationships, audits, and documents.
