# Read views — Design

See parent `09-08-checklist-control/design.md` for the shared schema/domain contract. This file records child-local decisions.

## Storage

- `packages/storage-sqlite/src/migrations.ts`: append migration `{ version: 2, name: 'checklist-display-order' }`:
  - `ALTER TABLE requirements ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;`
  - backfill per ticket by `created_at, id` (correlated count), as in parent design.
- `SCHEMA_VERSION` -> 2.
- `SqliteRequirementRepository`:
  - `requirementFromRow` maps `display_order` -> `displayOrder`.
  - `listActiveByTicket` / `listByTicket` order by `display_order, created_at`.
  - adds `listSupersededByTicket(ticketId)` (lifecycle `superseded`, ordered by `display_order, created_at`).

## Domain

- `Requirement` entity adds `displayOrder: number`.
- `RequirementRepository` interface adds `listSupersededByTicket`.
- New `buildProjectStatus(uow, projectId)` in `packages/domain/src/services.ts` (shape per parent design):
  - loads project, all tickets, per ticket: requirements, sources, proposals, audits; computes checked/active/remaining, `updatedAt` = max over ticket + child rows, open proposals.
  - rollup totals across tickets.
- New `buildChecklistView(uow, { projectId, ticketKey })`:
  - resolves project + ticket; loads active (ordered) + superseded (ordered) requirements, impacts, scenarios, sources.
  - groups active items by `parentLabel` (fallback label `(ungrouped)`), preserving order.
  - resolves supersede relationships to annotate each superseded item with its superseder (new requirement id/title) where present.
  - returns `{ ticketKey, title, groups: [{label, items}], superseded: [{item, supersededBy?}] }`.

## CLI (`packages/cli`)

- New `src/commands/status.ts` — `statusProject(ctx, { project?, json })`; default readable block:
  ```
  project loyalty (Loyalty Program)
  tickets: 3   active: 7   checked: 4   remaining: 3   open proposals: 1
  last updated: <iso>

  TICKET-1   [2/3]  remaining 1   open 0   updated <iso>
  ...
  ```
  `--json` prints `buildProjectStatus` output via `printJson`.
- New `src/commands/checklist.ts` — `checklistList(ctx, { key, project?, json })`:
  - default renders groups + chips + struck-through superseded (`~~title~~` with `(superseded by <title>)` when known).
  - `--json` prints `buildChecklistView` via `printJson`.
- Router (`packages/cli/src/index.ts`):
  - `status` command (project-scoped, resolve via active/`--project`).
  - `checklist list` subcommand (parse `[sub,...rest]` style; first positional is the ticket key).
  - `--help` entries.
- Reuse the router's existing `resolveProject`, exit-code, and error mapping; both commands route domain `NotFoundError` to exit 3.

## Tests

- `packages/storage-sqlite`: migration v2 applies + backfills; ordered reads (active + superseded).
- `packages/domain`: `buildProjectStatus` rollup counts; `buildChecklistView` grouping + supersede annotation.
- `packages/cli`: `trachex status` output contains totals; `trachex checklist list` shows group headers and struck-through superseded; `--json` round-trips.

## Rollout

- Child commits on top of MVP base; migration is additive. Edit-commands child follows.
