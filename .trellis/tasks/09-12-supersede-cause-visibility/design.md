# Agentic Supersede Review Design

## Boundary

The LLM may analyze an adjustment and produce a reconciliation proposal. The proposal is an immutable pending review artifact until a human edits, approves, or rejects it. Canonical requirements, supersede relationships, and completion history change only during explicit approval.

## Review Contract

- Reconciliation output remains `ProposalOutput` with `create[]` drafts and optional `supersedes` IDs.
- Proposal review returns the latest effective output plus source metadata and the target requirements referenced by `supersedes`.
- Proposal editing accepts the complete effective output, stores it as an edited proposal version, and never applies it.
- Approval requires an explicit confirmation value at every user-facing boundary. Missing confirmation is a usage/input error and does not call domain approval.
- Approval applies the latest edited output, not the original model output.

## Interfaces

- Domain: retain `editProposal` and `approveProposal`; add no implicit auto-approval.
- CLI: add proposal inspection/edit support and make `proposal approve` require `--yes` for the state-changing operation.
- MCP: expose proposal review/edit and require `confirm: true` on approval. Existing `add_adjustment` remains proposal-only.
- Agent prompt: define evidence-based supersession criteria. Similar wording alone is insufficient; a supersede target requires a changed meaning, behavior, constraint, or acceptance rule grounded in the adjustment source.

## Data Flow

1. Adjustment source is ingested with source type, attribution, note, and snapshot evidence.
2. Agent searches current context and returns reconciliation drafts.
3. Pipeline stores a pending proposal version.
4. Human retrieves the review payload, optionally edits the full output, and re-reviews.
5. Human explicitly approves with confirmation.
6. Domain approval creates requirements and relationships, marks superseded targets, and preserves audits atomically at the unit-of-work level.

## Compatibility

Existing pending proposals remain reviewable. Existing domain callers that explicitly invoke `approveProposal` remain compatible; CLI/MCP are the human confirmation boundaries. No database migration is required because proposal versions already store edited output.

## Rejection And Rollback

Rejecting or leaving a proposal pending does not mutate requirements. If an edited proposal is incorrect, edit it again or reject it and create a new adjustment. No canonical rollback operation is introduced in this scope.
