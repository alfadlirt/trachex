# Human-controlled developer checklist implementation plan

## Ordered Checklist

1. [x] Add a domain read projection for effective proposal output, source metadata, and same-ticket supersession targets.
2. [x] Add coverage for extraction output, reconciliation output, edited-output precedence, malformed output, and missing targets where practical.
3. [x] Include the projection in the ticket canvas API response without removing the existing proposal summary.
4. [x] Add API coverage for pending review data.
5. [x] Extend dashboard API types and render structured review cards before approval controls.
6. [x] Disable approval for a proposal whose review projection has an error.
7. [x] Encode the canonical output shape: business requirement, environment-agnostic implementation items, and overall success criteria.
8. [x] Add system-prompt instructions and schema validation for environment-agnostic developer decomposition and uncertainty.
9. [x] Add API/domain mutation for validated proposal edits, preserving immutable versions.
10. [x] Add reset-to-original mutation that appends a clean version without deleting proposal history.
11. [x] Add dashboard editing controls for business requirement, implementation items, success criteria, reset action, dirty state, and edited/original labels.
12. [x] Add provider-free Basic, Contains, Relevancy, Faithfulness, G-Eval, and Prompt alignment cases with Lens-compatible reporting hooks for decomposition, guardrails, success criteria, edit, reset, and uncertainty behavior.
13. [x] Run formatting, tests, typecheck, and production build.

## Validation Commands

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

## Risky Files

- `packages/domain/src/services.ts`
- `apps/api/src/routes.ts`
- `apps/dashboard/src/lib/api.ts`
- `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx`

## Rollback

The API change is additive. If UI rendering is defective, revert the dashboard projection consumption while retaining the domain/API contract tests.
