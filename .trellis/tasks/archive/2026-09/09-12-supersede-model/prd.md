# Single-ticket adjustment model

## Goal

Align the fixture and runbook to the enforced same-ticket supersede rule so the demo story is reproducible live.

## Confirmed Facts

- Approval rejects cross-ticket supersede (`packages/domain/src/services.ts:491-498`).
- `subjectChecklist` builds the view for one `ticketKey` (`packages/cli/src/commands/subject.ts:77-81`).
- `adjustment` writes sources against the subject's own ticket (`packages/cli/src/commands/adjustment.ts:24-37`).
- The static fixture spreads requirements across `ticket-billing-checkout`, `ticket-trial-adjustment`, `ticket-uat-feedback`.

## Requirements

- All fixture requirements for the Checkout story share the subject ticket's `ticketId`.
- Clarification and UAT appear as `sources` with `type` clarification/uat, attribution, location, and note — not as separate tickets.
- The reconciliation proposal example targets a requirement on the same ticket.
- `validate.mjs` still passes; add a same-ticket supersede invariant if cheap.

## Acceptance Criteria

- [ ] Fixture `requirements.json` uses one ticket for the Checkout story.
- [ ] `validate.mjs` passes and rejects cross-ticket `supersedes` targets.
- [ ] The runbook's adjust → approve flow can legally produce the fixture's end state.

## Out Of Scope

- Rendering changes (child: supersede-rendering).
- Eval changes (child: supersede-eval).
