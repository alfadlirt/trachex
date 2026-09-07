# Phase 1: Global Registry and SQLite Foundation

## Goal

Platform app-dir resolver; SQLite connection manager (WAL, FKs, timeout, migrations); schema for projects, repositories, tickets, sources, snapshots, chunks, requirements, relationships, impacts, scenarios, proposals, versions, audits, sessions, messages, errors, export artifacts; repository impls + domain service interfaces; uniqueness constraints; archive export/import. Acceptance: multi-repo project; survives restart; concurrent read/write; archive round-trips without secrets.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
