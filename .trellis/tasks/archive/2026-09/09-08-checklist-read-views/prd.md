# Read views: trachex status + checklist list

## Goal

Add the read surface that makes the checklist a usable human control: a project `status` rollup and a readable, grouped `checklist list` with explicit ordering, plus the schema/domain foundation (explicit `display_order`) both read views and the later edit commands rely on.

Source of truth: parent task `09-08-checklist-control` prd/design; `docs/architecture.md`.

## Requirements

- Migration v2 on the requirements table: add `display_order INTEGER NOT NULL DEFAULT 0`, backfill per ticket ordered by `created_at, id`.
- Domain: `Requirement.displayOrder` added; row mappers (storage-sqlite) map the column; ordered active-list reads (`ORDER BY display_order, created_at`).
- `buildProjectStatus(uow, projectId)` domain service returning the project rollup (see parent design): per-ticket and overall totals, remaining unchecked, last-updated, open pending proposals.
- `buildChecklistView(uow, { projectId, ticketKey })` domain service returning grouped current-checklist sections + a superseded (struck-through) history section with source/impact chips per item (see parent design).
- CLI `trachex status` — readable block by default, `--json` for the structure.
- CLI `trachex checklist list <ticketKey> --project <slug>` — readable grouped tree by default (group headers; `[x]`/`[ ]`; source + impact chips inline; superseded items rendered `~~title~~` in a history section), `--json` for the structure.

## Acceptance Criteria

- [ ] Migration v2 applies cleanly on an existing Phase 1+ database and backfills `display_order` preserving current creation order; re-running migrations is still idempotent.
- [ ] Active checklist reads come back in `display_order`; superseded items keep their original order for the history view.
- [ ] `trachex status` (with `--project` or active project) shows the project rollup: per-ticket checked/active/remaining, totals, last-updated, open proposals; `--json` emits the same data structurally.
- [ ] `trachex checklist list TICKET-X` shows a grouped tree, visually distinct checked/unchecked, source + impact chips, and a superseded history section with struck-through items.
- [ ] Domain + CLI tests cover both commands; `pnpm lint`, `pnpm typecheck`, `pnpm test` stay green.

## Dependency order

- Depends on Phases 0-8 of the MVP. Edit-commands child (09-08-checklist-edit-commands) depends on this task's `display_order` foundation.

## Notes

- Read-only; no mutation commands here. No `completion_audits` change yet (uncheck lands in edit-commands as migration v3).
