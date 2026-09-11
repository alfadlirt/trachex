# Implementation Plan

## Ordered Work

1. Add domain lifecycle contracts for archive/deactivate and permanent deletion, including project/subject ownership and requirement subtree traversal.
2. Add SQLite schema/repositories for lifecycle state, safe dependent cleanup, proposal drafts/decisions, evidence references, review findings, chat activity, and agent run metadata.
3. Refine active/history projections and terminal/dashboard serializers so archived, superseded, and active items are clearly distinct.
4. Refactor `trachex tui` into a persistent workspace loop with empty-state menus, back/cancel behavior, explicit quit, error recovery, and Ctrl+C cleanup.
5. Add TUI evidence intake forms for file, pasted text, note/description, URL snapshot, and optional repository scope.
6. Extend extraction/proposal review with editable proposed items, evidence panels, citations, approve-all/reject-all/per-item decisions, and auditable human edits.
7. Implement shared read-only assistant service and expose it through TUI, dashboard/API, and MCP.
8. Implement structured subject baseline/context MCP output for coding agents.
9. Implement challenge/review runs with informational findings versus editable pending proposals, including evidence, severity, confidence, and decisions.
10. Update README, architecture/usage docs, tests, and Trellis specs; explicitly document source/Git verification as future work.

## Validation

- Run focused domain/storage tests for archive subtree behavior, permanent-delete guards, history projections, evidence snapshots, proposal decisions, and review findings.
- Run CLI/TUI tests for empty-state loops, cancellation, errors, explicit quit, Ctrl+C cleanup, forms, colors, and no-color mode.
- Run API/dashboard/MCP tests for shared assistant responses and baseline contract parity.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm eval`.
- Manually verify: empty project workspace, empty subject workspace, empty checklist workspace, cancelled forms, failed actions, archive subtree, forced deletion, FSD intake, pasted requirement intake, URL snapshot intake, editable proposal review, assistant citations, MCP baseline, and review findings.

## Review Gates

- Do not add assistant mutation tools before proposal approval and human-control tests exist.
- Do not expose source/Git implementation verification as available behavior.
- Confirm all TUI exits are explicit or Ctrl+C; cancellation must never close the process.
- Confirm history output distinguishes active, superseded, archived, rejected, and pending states.
