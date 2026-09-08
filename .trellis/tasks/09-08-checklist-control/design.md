# Human checklist control — Design (parent)

Shared design so both children stay consistent.

## Explicit ordering (migration v2 — child read-views)

- `requirements` gains `display_order INTEGER NOT NULL DEFAULT 0`.
- v2 migration: `ALTER TABLE requirements ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;` then backfill per ticket by `created_at, id`:
  ```sql
  UPDATE requirements
  SET display_order = (
    SELECT COUNT(*) FROM requirements r2
    WHERE r2.ticket_id = requirements.ticket_id
      AND (r2.created_at < requirements.created_at
           OR (r2.created_at = requirements.created_at AND r2.id < requirements.id))
  );
  ```
- Domain `Requirement` entity gains `displayOrder`; row mappers updated.
- Ordered reads: active list orders by `display_order, created_at`; superseded items carry their order too (frozen) so a struck-through history section can show original position.

## Uncheck provenance (migration v3 — child edit-commands)

- `completion_audits` gains `action TEXT NOT NULL DEFAULT 'check'` (values `check` | `uncheck`).
- `checkRequirement` records `action='check'`; new `uncheckRequirement` records `action='uncheck'` and flips `dev_status` to `unchecked`.
- Timeline/export builders filter/annotate by `action` so an uncheck is not misreported as a completion.

## Human edits (direct, auto-provenance) — child edit-commands

Mental model: the checklist is the human's control; the LLM proposes but never directly edits. Human edits are direct (fast) but every content change writes traceability:

- `addRequirementManual(uow, { ticketId, title, description?, parentLabel?, impacts?, sourceType?, attribution?, actorType, actorId?, note? })` → create a `Source` (default type `manual`, attribution = actor) then an active requirement referencing it, appended at the end of `display_order`.
- `editRequirementContent(uow, { ticketId, requirementId, title?, description?, actor..., note })` → guard: requirement is active and belongs to the ticket. Create a new active requirement (copy impacts/scenarios optional; fields replaced) at the **same** display_order, then supersede the old (lifecycle `superseded`, `supersedes` relationship new→old). Old keeps its source; new gets a fresh manual source.
- `supersedeRequirement(uow, { ticketId, requirementId, note?, actor... })` → mark active requirement superseded (no replacement); allowed even if checked.
- `reorderChecklist(uow, { ticketId, orderedIds })` → validate ids are active requirements of the ticket; rewrite `display_order` by index.
- `checkRequirement` (existing) + `uncheckRequirement(uow, { requirementId, actor..., note? })`.

Command surface (child edit-commands, mirroring existing CLI style):

```text
trachex checklist add <ticketKey> --project <slug> --title <t> [--description <d>] [--parent <label>] [--from <actor>] [--note <n>]
trachex checklist edit <ticketKey> <requirement-id> --project <slug> --title <t> [--description <d>] [--from <actor>] [--note <n>]
trachex checklist supersede <ticketKey> <requirement-id> --project <slug> [--from <actor>] [--note <n>]
trachex checklist reorder <ticketKey> --project <slug> --order <id1,id2,...>
trachex check <ticketKey> <requirement-id> --project <slug> [--yes]        # existing
trachex uncheck <ticketKey> <requirement-id> --project <slug> [--actor <a>] [--note <n>]
```

Source types on add/edit default to `manual` (matching `Source` allowed types); attribution defaults to the actor so "who" is always recorded.

## Status summary shape (child read-views)

`buildProjectStatus(uow, projectId)` returns:

```ts
{
  project: { slug, name },
  updatedAt,               // max over tickets/sources/requirements/proposals/audits
  totals: { tickets, active, checked, remaining, openProposals },
  tickets: [{
    key, title,
    checked, active, remaining,        // counts (remaining = active - checked)
    updatedAt,
    openProposals,
  }]
}
```

`trachex status` prints a readable block by default; `--json` prints the structure.

## Checklist list shape (child read-views)

`buildChecklistView(uow, { projectId, ticketKey })` returns ordered sections:

```ts
{
  ticketKey, title,
  groups: [{ label, items: ChecklistItem[] }],   // parent_label or "(ungrouped)"
  superseded: [{ item, supersededBy?: id/title }], // struck-through history, original order
}
// ChecklistItem: { id, title, description?, devStatus, source?: {type, attribution, location}, impacts: [{kind,value}], scenarios? }
```

CLI renders it: group headers, `[x]`/`[ ]`, source + impact chips inline; superseded items with `~~title~~`. `--json` prints the structure.

## Rollout / rollback

- Each child is independently checkable and archived. Migration v2 ships with read-views; v3 with edit-commands.
- Rollback: revert the child commit; migration runner is additive/idempotent (new columns only), so a revert of later migration does not corrupt prior data.
