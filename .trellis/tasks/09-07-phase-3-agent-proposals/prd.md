# Phase 3: Anvia Agent and Proposal Pipeline

## Goal

Provider config resolver (keychain/env/global config); Anvia agent factory with typed schemas and bounded turns; extraction + reconciliation prompts/output schemas; impact classification + test-scenario generation; context search tool; SQLite-backed Anvia memory; optional Lens/Pino observers. Acceptance: ticket new creates source + pending extraction proposals; adjustment creates source + pending reconciliation proposals; agent output cannot directly mutate canonical requirements; failed model output retained as error without corrupting ticket.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
