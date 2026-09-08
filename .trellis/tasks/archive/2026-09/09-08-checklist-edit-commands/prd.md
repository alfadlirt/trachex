# Direct edit commands with provenance

## Goal

Give the human direct control over the checklist (the "next level of to-do list"): add items, edit content (old item superseded + kept in history, new item in place), supersede/delete items, reorder, and uncheck — all while preserving the append-only/traceability guarantee. Every content change auto-records a `manual` source with actor/note; supersede relationships are always recorded; uncheck keeps an audit entry.

Source of truth: parent task `09-08-checklist-control` prd/design; `docs/architecture.md` (ADR 003, completion audit).

## Requirements

- Migration v3: `completion_audits` gains `action TEXT NOT NULL DEFAULT 'check'` (values `check` | `uncheck`); `SCHEMA_VERSION` -> 3.
- Domain services:
  - `addRequirementManual(uow, { ticketId, title, description?, parentLabel?, impacts?, sourceType?, attribution?, actorType, actorId?, note? })` — creates a `Source` (default type `manual`, attribution = actor) then an active requirement referencing it, appended at the end of `display_order`.
  - `editRequirementContent(uow, { ticketId, requirementId, title?, description?, actor..., note })` — guard: requirement active + belongs to ticket; creates a new active requirement at the **same** `display_order`, supersedes the old (lifecycle `superseded` + `supersedes` relationship new→old); new requirement gets a fresh manual source.
  - `supersedeRequirement(uow, { ticketId, requirementId, note?, actor... })` — mark an active requirement superseded (no replacement); allowed even if checked.
  - `reorderChecklist(uow, { ticketId, orderedIds })` — validate ids are active requirements of the ticket; rewrite `display_order` by index.
  - `uncheckRequirement(uow, { requirementId, actor..., note? })` — flip `dev_status` to `unchecked` + audit row with `action='uncheck'`.
  - `checkRequirement` records `action='check'`.
- CLI commands (mirroring existing style, human-readable + `--json`):
  - `trachex checklist add <ticketKey> --project <slug> --title <t> [--description <d>] [--parent <label>] [--from <actor>] [--note <n>]`
  - `trachex checklist edit <ticketKey> <requirement-id> --project <slug> --title <t> [--description <d>] [--from <actor>] [--note <n>]`
  - `trachex checklist supersede <ticketKey> <requirement-id> --project <slug> [--from <actor>] [--note <n>]`
  - `trachex checklist reorder <ticketKey> --project <slug> --order <id1,id2,...>`
  - `trachex uncheck <ticketKey> <requirement-id> --project <slug> [--from <actor>] [--note <n>]`
  - `trachex check ...` (existing) now records `action='check'`.
- Timeline/export builders annotate audits by `action` so an uncheck is not reported as a completion.

## Acceptance Criteria

- [ ] Migration v3 applies + is idempotent; `SCHEMA_VERSION` 3.
- [ ] `checklist add` creates a manual source + active requirement appended at the end; `status`/`checklist list` reflect it.
- [ ] `checklist edit` supersedes the old requirement (kept in history, struck-through in the view) and places the new requirement at the same position.
- [ ] `checklist supersede` marks an item superseded without a replacement.
- [ ] `checklist reorder` rewrites `display_order` and persists across reloads.
- [ ] `uncheck` flips to unchecked and records an audit with `action='uncheck'`; export timeline does not misreport it as a completion.
- [ ] Every content edit has a `manual` source with attribution/actor + timestamps.
- [ ] Domain + CLI tests; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm eval` green.

## Dependency order

- Depends on read-views (09-08-checklist-read-views): `display_order` foundation + ordered list semantics + `status`/`checklist list` for verification.

## Notes

- Human edits are direct (no LLM proposal); the append-only invariant is preserved by supersede-and-replace, never in-place content rewrites.
