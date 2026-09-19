# Human-controlled proposal design

## Boundary

The scope now includes the complete human review loop: persisted original model output, editable draft, reset-to-original, and explicit approval. The domain remains the source of truth; the API exposes a typed proposal editor contract; React renders and edits the proposal without directly mutating canonical requirements.

## Data Flow

```text
Proposal + latest ProposalVersion + Source + Requirement targets
  -> domain review projection
  -> GET ticket canvas JSON
  -> typed dashboard API model
  -> pending proposal review/editor
  -> save edited proposal version or reset editor
  -> existing approve/reject mutation
```

## API Contract

The ticket canvas response will retain `proposalReviews`. Each review must expose original output, effective output, whether the effective output is edited, source metadata, resolved same-ticket supersession targets, and a safe error field. Mutation routes should support saving a validated edited output and resetting the pending proposal to the original model output by creating a new immutable version rather than rewriting history.

Extraction `requirements` and reconciliation `create` drafts are normalized to one UI list. Each draft contains the business requirement context, developer checklist items, and overall success criteria. The effective output uses the latest proposal version's `editedOutput` when present, otherwise `modelOutput`. Only safe structured fields are returned; raw JSON is not rendered as the primary review surface.

## Domain Projection

Add a read-only service function near the existing export/view projections. It will load proposals for one ticket, load each latest version, parse and validate the effective JSON with existing validation, resolve source metadata, resolve same-ticket supersession targets, and return an error string for malformed output instead of failing the whole canvas request.

The existing proposal-version table is sufficient. Reset means append a new version whose `editedOutput` is null and whose effective output is the original `modelOutput`, not delete or rewrite prior versions.

## UI Behavior

- Keep the current checklist as the primary artifact.
- Replace opaque pending proposal rows with expandable review cards.
- Put proposed changes before Approve/Reject controls.
- Use explicit copy that approval mutates the canonical checklist.
- Render missing optional fields as omitted sections.
- Render projection errors with a visible review error and disable approval for that proposal.
- Render an editor for developer checklist items and success criteria, with Save edits and Reset to original actions.
- Label the original AI draft, current edited draft, and the fact that approval applies the current draft.

## Canonical Proposal Output

Each requirement draft uses this shape:

```ts
{
  title: string; // business requirement
  description?: string | null;
  sourceLocation?: string | null;
  implementationItems?: string[] | null;
  successCriteria?: string[] | null;
  impacts?: Array<{ kind: 'service' | 'api' | 'page'; value: string }> | null;
  supersedes?: string[] | null;
}
```

Legacy `scenarios` may be read for compatibility and presented as success criteria, but new agent output and edited output should use `successCriteria`. `implementationItems` are environment-agnostic developer actions and must not be treated as completed requirements until a human approves and checks them.

## Prompt and Guardrail Contract

The system prompt should require:

- Translate business requirements into concrete but repository-agnostic developer work.
- Prefer capability and behavior language over guessed framework, file path, table, or service names.
- Keep checklist items independently actionable and small enough for a developer or coding agent to drill into.
- Preserve the business requirement as context instead of replacing it with implementation guesses.
- Produce concise success criteria that describe observable outcomes, not a full QA test plan.
- State uncertainty or request project context when a technical detail cannot be grounded.
- Never mark work complete, silently mutate canonical requirements, or claim Git/repository verification.

## Eval Contract

Add provider-free cases first so CI protects the contract, then make the same cases reportable through Anvia Lens when a live provider is configured. Cases should cover:

- A grounded requirement producing useful developer checklist items.
- Different repository architectures receiving the same environment-agnostic output.
- Rejection of invented framework/path/database assumptions.
- Concise success criteria rather than bloated QA scenarios.
- Missing context causing uncertainty instead of invented implementation detail.
- Edited proposal approval using the edited version.
- Reset restoring the original model output.

## Risks And Trade-offs

- The ticket canvas response becomes larger, but proposals are local and bounded; one structured projection is preferable to an extra request per proposal for this MVP.
- Keeping the old `proposals` field avoids breaking existing consumers while the new projection supplies the UI contract.
- Dashboard editing is excluded to keep this task focused; existing domain versioning can support a follow-up.
