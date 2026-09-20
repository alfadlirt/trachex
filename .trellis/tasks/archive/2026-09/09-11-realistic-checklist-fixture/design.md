# Technical Design

## Fixture Boundary

Add a self-contained fixture directory under `fixtures/subscription-billing-adjustment/`. It is documentation and deterministic data, not production application code. The fixture directory contains:

- `README.md`: scenario narrative, timeline, expected status, and experiment prompts.
- `project.json`: project metadata and related tickets.
- `requirements.json`: normalized requirements, including active and superseded rows.
- `sources.json`: source metadata linking requirements to Markdown documents.
- `impacts.json`: service/API/page impact records.
- `scenarios.json`: functional and edge-case scenarios.
- `completion-audits.json`: developer completion history before and after the adjustment.
- `documents/*.md`: canonical ingestion inputs for initial requirements, clarification, and UAT feedback.
- `insight-prompts.md`: MCP and AI-review questions with expected findings.
- `fixture.json`: derived combined convenience bundle; the separate files remain canonical.
- `proposals.json`: representative extraction and reconciliation payloads for raw-ingestion experiments.
- `expected-findings.json`: structured AI-review targets corresponding to the prompt rubric.
- `validate.mjs`: dependency-free structural validation for fixture references and statuses.

The fixture uses JSON field names matching the domain entities where practical (`projectId`, `ticketId`, `lifecycleStatus`, `devStatus`, `sourceId`, `requirementId`, `parentId`, and `displayOrder`). It is intentionally an export/import fixture rather than a direct database seed because the repository currently exposes ingestion as a service operation requiring a `UnitOfWork`.

## Scenario Data Flow

1. `project.json` establishes one project and three related tickets.
2. The initial FSD document describes the original billing checkout requirements.
3. The clarification document changes the trial conversion rule and adds a grace-period behavior.
4. The UAT document reports a timezone boundary defect and a missing retry/duplicate-charge expectation.
5. `requirements.json` retains original rows as `superseded` where meaning changed and adds active replacement rows.
6. `completion-audits.json` records a developer checking original work before the clarification, making stale completion a review question rather than hiding it.
7. Impacts and scenarios provide baseline context for MCP queries and AI gap analysis.
8. The combined bundle packages the canonical records and proposal/review artifacts for a one-command local setup; it does not establish a second source of truth.

## Determinism And Validation

All IDs use stable human-readable values, timestamps are fixed ISO strings, and array order is meaningful. `validate.mjs` checks JSON parsing, required enum values, uniqueness, foreign keys, supersession direction, and that audit rows reference requirements. It must run with Node.js only and must not mutate fixture files.

The validator also enforces scenario-shape invariants: at least one superseded requirement, one checked requirement, one unchecked active requirement, one active requirement without a scenario, one documented omitted edge case, and both extraction and reconciliation proposal examples.

## Compatibility And Rollback

No runtime or database schema changes are required. Removing the fixture directory fully reverts the change. If a later importer needs a different envelope, adapt a loader around these canonical files rather than changing the domain entities for demo data.
