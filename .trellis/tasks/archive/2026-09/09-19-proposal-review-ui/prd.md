# Human-controlled developer checklist proposals

## Goal

Turn agent output into an environment-agnostic developer checklist proposal that a human can inspect, edit, reset, and approve before it becomes canonical.

## Background

The domain already persists immutable proposal versions containing the original model output and optional edited output. The ticket canvas now exposes a read-only review projection, but it does not yet allow the human reviewer to edit the proposed result or reset edits to the original model output.

Trachex is not a Git/repository scanner in this MVP and is not a QA test-management tool. Its checklist should translate a business requirement into environment-agnostic developer work that remains useful across different repository designs. For example:

```text
Business requirement: Customers can pause an active subscription.

Developer checklist:
- Add the pause operation to the subscription application flow.
- Validate that only active subscriptions can be paused.
- Persist the paused state and the pause timestamp.
- Update affected user-facing subscription state and error handling.
- Cover repeated pause requests and invalid state transitions.

Success criteria:
- An active subscription can be paused.
- A paused subscription cannot be charged as active.
- Repeating the operation is handled safely.
- The user can see the resulting paused state.
```

## Requirements

- Extend the ticket canvas API projection with a safe, structured view of each proposal's effective output and source metadata.
- Show pending extraction and reconciliation proposals in the dashboard with their proposed requirements, descriptions, impacts, test scenarios, and supersession targets.
- For supersession targets, show the current requirement title and status so the reviewer can understand the proposed change in context.
- Show proposal source type, attribution, location, and ingestion time when available.
- Keep approval and rejection as explicit human actions; inspecting a proposal must not mutate canonical requirements.
- Preserve the existing approval/rejection endpoints and existing checklist behavior.
- Handle malformed or unavailable proposal output as a visible review error rather than crashing the ticket page.
- Allow the reviewer to edit proposed checklist content and success criteria before approval.
- Allow the reviewer to reset the current edits to the original model output before approval.
- Preserve the original model output, edited version, and approval decision as separate proposal history.
- Put checklist-generation rules and guardrails in the agent system prompt: remain environment-agnostic, distinguish business requirements from implementation work, avoid inventing repository-specific paths or technologies, keep success criteria concise, and return uncertainty when context is insufficient.
- Add deterministic eval cases for checklist usefulness, environment agnosticism, business-to-developer decomposition, success-criteria quality, unsupported implementation assumptions, and human-edit/reset behavior. Keep the cases compatible with later Anvia Lens reporting.
- Add API/domain-facing tests for the projection and dashboard-facing tests for the rendered review data where the existing test setup supports them.

## Out Of Scope

- Initial document-upload UI or a new document-ingestion endpoint.
- PostgreSQL, Qdrant, or changes to canonical storage.
- Git history, repository scanning, implementation verification, or branch compliance.
- QA test-case management. Success criteria are concise verification outcomes, not a full test-plan system.
- Automatically marking checklist items complete.

## Acceptance Criteria

- [x] A pending extraction proposal displays each proposed requirement before approval.
- [x] A pending reconciliation proposal displays the proposed replacement and the requirement(s) it supersedes.
- [x] Proposal source attribution and timestamps are visible when present.
- [x] Impacts and test scenarios are visible for each proposed requirement.
- [x] Approve and reject remain available only after the proposal content is inspectable.
- [x] Inspecting or refreshing the page does not create checklist requirements.
- [x] Malformed proposal output produces a review error state and leaves approval/rejection behavior safe.
- [x] A reviewer can edit proposed checklist items and success criteria before approval.
- [x] A reviewer can reset edits to the original model output without mutating canonical requirements.
- [x] Approved output uses the edited version, while proposal history preserves the original output.
- [x] The system prompt requires environment-agnostic developer work, concise success criteria, explicit uncertainty, and no invented repository-specific implementation details.
- [x] Deterministic eval cases fail proposals that invent technology/path assumptions or omit useful developer work, and pass grounded checklist decomposition and concise success criteria.
- [x] Existing `pnpm test`, `pnpm typecheck`, and `pnpm build` remain green.

## Verification Note

The provider-free eval harness passes 20/20 metrics across Basic eval, Contains, Relevancy, Faithfulness, G-Eval, and Prompt alignment, including negative technology/path assumptions, insufficient-context uncertainty, and edit/reset history cases. The aggregate `pnpm eval` command still fails in its separate legacy CLI acceptance phase because `packages/cli/src/evals/acceptance.ts` invokes removed `ticket` commands while the current CLI is subject-based; that failure is outside this feature's changed behavior.

## Resolved Product Decision

Success criteria belong to the parent business requirement by default, not to every developer checklist item. This keeps Trachex focused on developer planning instead of becoming a QA test-case manager. The canonical proposal shape is:

```text
Business requirement
├── developer checklist items
└── overall success criteria
```

The proposal editor must support editing the business requirement, checklist items, and overall success criteria, plus reset-to-original for the whole pending proposal.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
