# Deterministic supersede eval

## Goal

Provider-free evals that lock supersede mechanics and the human-controlled agentic proposal lifecycle so LLM variance can never silently mutate canonical state.

## Confirmed Facts

- Eval harness already patches `__supersede_target__` to the real requirement ID (`packages/agent/src/evals/harness.ts:134-147`).
- Approval creates `supersedes` relations and marks targets superseded (`packages/domain/src/services.ts:481-510`).
- `buildChecklistView` exposes `superseded[]` with `supersededByTitle` (`packages/domain/src/views.ts:218-240`).

## Requirements

- Eval case mirrors the demo exactly: seed 2 requirements → check req-1 (audit with actor + note) → reconcile with fixed output `create[{supersedes:[req-1]}]` → approve.
- Assert: exactly 1 superseded (= req-1), 1 `supersedes` relation (new → req-1), req-1 check audit preserved, replacement active + unchecked with clarification source + attribution, view groups exclude req-1, `superseded[]` has 1 entry.
- Second case repeats with a UAT source (idempotency item).
- Both cases run provider-free via the fixture/harness patch mechanism.
- Assert the reconciliation result is a pending proposal, not an applied checklist mutation.
- For the core timezone clarification, assert the LLM output identifies the original seven-day requirement in `supersedes`; an output that only adds requirements is a failed reasoning result for this scenario.
- Assert a reviewer can edit the proposal output, including `supersedes`, before approval.
- Assert approval requires explicit confirmation in MCP and that missing confirmation leaves requirements unchanged.
- Assert rejection leaves requirements, relationships, and audits unchanged.
- Add an evidence-bound answer case: the agent reports initial-to-current drift counts, superseded replacement source/attribution/date, and refuses to answer an unsupported cause or count.
- Assert the refusal response tells the user to ask the BA immediately and add the clarification with `subject add-doc`.

## Acceptance Criteria

- [ ] Eval fails if the proposal carries no `supersedes` (no silent all-create pass).
- [ ] Eval fails if the check audit is lost on supersede.
- [ ] Eval fails if the view omits the superseded entry.
- [ ] `pnpm eval` or the agent test command runs both cases green.
- [ ] Drift answers are derived from stored requirements, relationships, sources, and audits rather than model invention.
- [ ] Missing evidence produces the exact escalation guidance instead of an inferred answer.
- [ ] The human gate fails closed: no confirmation means no supersede, no additions, and no checklist mutation.
- [ ] Edited proposal content, not the original model output, is what approval applies.

## Out Of Scope

- Prompt tuning to make the live LLM emit `supersedes` (runbook covers the repair branch instead).

## Provider-free seam limitation

The agent package currently exposes provider-free extraction and reconciliation
pipelines, but no answer-generation/MCP question seam that can be invoked by
this eval harness. The drift-summary case therefore asserts the complete
stored-evidence counts and the exact required escalation wording in the
harness. A future answer seam should consume the same requirements,
relationships, sources, audits, and checklist view and move this contract
from a wording assertion to an end-to-end unsupported-question test.
