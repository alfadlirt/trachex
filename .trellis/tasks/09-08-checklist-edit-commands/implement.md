# Direct edit commands — Implement

## Execution order

1. `packages/domain`: `CompletionAudit.action`; `checkRequirement` records `check`; new `uncheckRequirement`, `addRequirementManual`, `editRequirementContent`, `supersedeRequirement`, `reorderChecklist` in `services.ts` (or `edits.ts`).
2. `packages/storage-sqlite`: migration v3 + `SCHEMA_VERSION` 3; `auditFromRow` maps action; `create` persists action. Integration test.
3. `packages/domain`: unit tests for the five edit services (append-only supersede, same-order replacement, reorder rewrite, uncheck audit, manual source).
4. `packages/cli`: extend `commands/checklist.ts` (add/edit/supersede/reorder), new `commands/uncheck.ts`, router wiring + `--help`.
5. `packages/cli`: end-to-end tests (add → list, edit → supersede+in-place, reorder persists, uncheck audit, `--json`).
6. Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm eval` green.

## Validation commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm eval
pnpm run trachex checklist add TICKET-X --project <slug> --title "..." --from "Me"
pnpm run trachex checklist list TICKET-X --project <slug>
pnpm run trachex checklist edit TICKET-X <id> --project <slug> --title "..."
pnpm run trachex checklist supersede TICKET-X <id> --project <slug>
pnpm run trachex checklist reorder TICKET-X --project <slug> --order <id1,id2>
pnpm run trachex uncheck TICKET-X <id> --project <slug>
```

## Acceptance review checklist

- [ ] Migration v3 idempotent; audit action persisted.
- [ ] add/edit/supersede/reorder/uncheck behave per prd; append-only preserved.
- [ ] `checklist list` reflects edits (struck-through superseded, in-place replacement, new order).
- [ ] Export timeline does not misreport unchecks as completions.
- [ ] Full test/lint/typecheck/eval green.

## Review gate

Run trellis-check; then finish (spec update + commit + archive). Then parent integration review.

## Rollback

Revert child commit(s); read-views base stays.
