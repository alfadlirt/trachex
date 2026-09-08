# Direct edit commands — Design

See parent `09-08-checklist-control/design.md` for the shared contract (command surface, provenance model, migration v3). This file records child-local decisions.

## Storage (migration v3)

- `packages/storage-sqlite/src/migrations.ts`: append `{ version: 3, name: 'completion-audit-action' }`:
  - `ALTER TABLE completion_audits ADD COLUMN action TEXT NOT NULL DEFAULT 'check';`
- `SCHEMA_VERSION` -> 3.
- `CompletionAudit` entity gains `action: 'check' | 'uncheck'`; `auditFromRow` maps it; `SqliteCompletionAuditRepository.create` persists it.

## Domain

- `CompletionAudit` entity: add `action`.
- `checkRequirement` sets `action: 'check'`.
- New `uncheckRequirement(uow, { requirementId, actorType, actorId?, note? })`:
  - guard: requirement exists (any lifecycle), belongs to its ticket implicitly; flip `dev_status` to `unchecked`; insert audit with `action='uncheck'`.
- New `addRequirementManual(uow, input)`:
  - `sourceType` defaults to `manual`; `attribution` defaults to actorId/actorType label; create `Source` (ticketId, type, attribution, ingestedAt) then requirement (active, unchecked, `displayOrder = nextDisplayOrder`), optional impacts.
- New `editRequirementContent(uow, input)`:
  - load requirement; guard active + belongs to ticket (else InvalidOperationError).
  - create new active requirement with merged fields (title/description override; keep parentLabel unless provided; copy impacts/scenarios from old unless overridden) at the **same** `displayOrder`, with a fresh manual source (attribution/note).
  - supersede old: `lifecycleStatus='superseded'`, `updatedAt=now`; add `supersedes` relationship `from=new.id, to=old.id`.
- New `supersedeRequirement(uow, input)`:
  - load requirement; guard active; set superseded (no relationship, no replacement).
- New `reorderChecklist(uow, { ticketId, orderedIds })`:
  - load active requirements; verify the set of ids matches exactly (else InvalidOperationError); assign `displayOrder = index` and update each.

## CLI (`packages/cli`)

- Extend `src/commands/checklist.ts` with `add`, `edit`, `supersede`, `reorder` handlers; new `src/commands/uncheck.ts`; update `src/commands/check.ts` (already calls `checkRequirement`, which now records `action='check'` — no CLI change needed beyond verifying).
- Router: `checklist add|edit|supersede|reorder` subcommands (parse `[sub,...rest]` style; first positional is ticket key for add/edit/supersede, `--order` for reorder); `uncheck` command (like `check`). `--help` entries.
- All commands resolve project via active/`--project`; domain `NotFoundError`/`InvalidOperationError` route to exit 3 / 400-style mapping (existing router).

## Export/timeline

- `buildExportSummary` timeline: audits annotated by `action` — only `action='check'` emits a "checked" event; `action='uncheck'` emits "unchecked" (or is excluded from completion semantics). Keep it explicit so an uncheck is never reported as a completion.

## Tests

- `packages/storage-sqlite`: migration v3 idempotent; audit action persisted.
- `packages/domain`: add/edit/supersede/reorder/uncheck invariants (append-only supersede, same-order replacement, reorder rewrite, uncheck audit).
- `packages/cli`: end-to-end via runCli — add → list shows item; edit → old struck-through + new in place; supersede → removed from active; reorder → order persists; uncheck → dev_status unchecked + audit; `--json` round-trips.

## Rollout

- Child commits on top of read-views base. Migration v3 additive.
