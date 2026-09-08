# Human checklist control: status, checklist view, direct edits

## Goal

Make the checklist the human's control surface (the "next level of to-do list for the developer"). The LLM proposes via extraction/reconciliation, but the human directly owns, reads, and edits the checklist. Add a project `status` summary, a readable grouped `checklist list` view, and direct human edit commands with automatic provenance so the append-only/traceability guarantee still holds.

Source of truth: `docs/architecture.md` (CLI contract, domain model, ADR 003), the existing CLI in `packages/cli`, and the domain/storage layers.

## Requirements

- `trachex status` — project-scoped rollup (uses `--project` / active-project like other commands):
  - ticket list with per-ticket progress (checked / active / remaining unchecked),
  - overall progress totals,
  - last-updated per ticket and overall,
  - remaining items count,
  - open pending proposals count.
- `trachex checklist list <ticketKey> --project <slug>` — readable grouped tree of the current checklist:
  - grouped by `parentLabel` when present,
  - explicit stable order (new explicit `display_order`, not created_at),
  - checked vs unchecked visually distinct,
  - source chip (type / attribution / location) and impact chips per item,
  - superseded items shown struck-through (history section), never hidden.
- Direct human edit commands (no LLM proposal path):
  - add item (manual),
  - edit title/description (old item superseded and kept in history; new item takes its place),
  - supersede / delete item,
  - reorder / move via `display_order`,
  - check (exists) and uncheck (revert a check).
- Provenance: every human content edit records a `manual` source (or chosen source type) with actor/note; superseded relationships always recorded; uncheck records an audit entry.
- Both new read commands support a human-readable default and `--json`.
- The architecture "human is in control" stance is documented: completion is human-only; edits are direct but traceable (never silent).

## Task map

| Task | Deliverable |
| --- | --- |
| 09-08-checklist-read-views | Migration v2 (`display_order`), ordered read support, `trachex status`, `trachex checklist list` |
| 09-08-checklist-edit-commands | Direct edit commands + provenance (depends on read-views ordering foundation) |

Dependency ordering (written in child artifacts, not implied by tree position): read-views -> edit-commands. Edit commands build on the `display_order` foundation and ordered list semantics from read-views.

## Cross-child acceptance criteria

- [x] A developer can, entirely via the CLI: create a project/ticket, add manual items, see an accurate `status` rollup and grouped `checklist list`, edit an item (old superseded + struck-through in the view, new item in place), reorder, uncheck, and confirm every change is traceable (manual source + actor + timestamps). (Verified end-to-end via the packaged CLI.)
- Superseded items remain queryable in history and never disappear from provenance.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm eval` stay green.

## Constraints

- Append-only canonical data preserved: content edits create a new requirement + `supersedes` relationship; they never rewrite the old requirement's content in place.
- Explicit `--project` wins; active-project fallback used otherwise (ADR 002).
- Human completion is never inferred; uncheck keeps an audit record.
