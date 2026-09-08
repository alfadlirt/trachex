# Direct edit commands with provenance

## Goal

Child 2 (edit). Human edit commands over the checklist: add item (manual), edit title/description (old item superseded + kept in history), supersede/delete item, reorder/move (display_order), uncheck (revert a check). Every content edit auto-records a manual source + actor/note so history stays trustworthy. Direct mutations (no LLM proposal) per the human-control model; completion is still a human-only action.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
