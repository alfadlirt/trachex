# Superseded cause rendering

## Goal

Each superseded checklist entry shows its cause chain so the reader never needs another command.

## Confirmed Facts

- View items already carry `source {type, attribution, location}` (`packages/domain/src/views.ts:198`); the CLI superseded branch ignores it (`packages/cli/src/commands/subject.ts:93-101`).
- Relations (`supersedes`, from → to) exist at approval time (`packages/domain/src/services.ts:500-507`).
- Completion audits persist on the old requirement (fixture `completion-audits.json`).

## Requirements

- Superseded entries show: old title + ID, its check audit (who/when/note), replacement title + ID, replacement source (type, attribution, location, note excerpt), replacement state (active/unchecked).
- JSON view includes the same fields (`supersededById`, new-item source, old-item audits).
- The view exposes enough stable evidence for an agent to count baseline requirements, additions, supersessions, active items, and unchecked items without rereading documents.
- Human output keeps the `~~struck~~` convention and adds cause lines beneath.
- Active-item rendering is unchanged.

## Acceptance Criteria

- [ ] `subject checklist --json` for a superseded item contains old audit, replacement ID/title, and replacement source.
- [ ] Human-readable output answers what/when/why/from-whom/replaced-by/stale without extra commands.
- [ ] Existing view tests updated; no active-item regression.
- [ ] The JSON contract supports source-backed drift summaries and makes absent evidence distinguishable from an empty value.

## Out Of Scope

- Runbook rewrite (child: supersede-runbook).
