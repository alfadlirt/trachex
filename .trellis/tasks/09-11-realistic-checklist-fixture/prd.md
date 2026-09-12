# Create realistic Trachex checklist adjustment fixture

## Goal

Add a realistic, self-contained project fixture that demonstrates how a Trachex checklist evolves when a developer has already checked work and then receives a new ticket, clarification, and UAT feedback. The fixture must be usable for local ingestion and agent/MCP experiments without requiring production data.

## Background

The repository already models projects, tickets, source documents, requirements, impacts, scenarios, superseded requirement history, completion audits, proposals, and baseline/checklist views. The fixture should exercise those existing concepts through believable support for a subscription billing portal rather than introduce a parallel test format.

## Requirements

- Include one named demo project and a primary ticket with enough context to produce a non-trivial checklist.
- Include a ticket list covering the original feature, a mid-development adjustment, and a UAT defect/feedback item.
- Include requirement inputs from an initial product document, a clarification note, and UAT feedback. Each input must identify its source type, author/attribution, date, and relevant location or section.
- Include a realistic current checklist with checked and unchecked items, impacted service/API/page hints, test scenarios, and at least one item that remains intentionally uncovered.
- Preserve requirement history: at least one original requirement must be superseded by a later adjustment rather than overwritten.
- Include explicit completion/audit examples showing that a developer checked work before the adjustment arrived.
- Include an AI-review/insight prompt pack or expected investigation questions covering missing requirements, edge cases, contradictions, stale checks, and UAT regression risk.
- Provide ingestion-ready Markdown source documents and structured fixture data that can be loaded deterministically. A PDF source is optional; Markdown must be sufficient for the complete scenario.
- Provide both separate canonical files and a combined convenience bundle. Separate files support partial-ingestion and reference-failure experiments; the bundle supports one-command local loading. The separate files remain authoritative.
- Include normalized checklist state plus representative extraction/reconciliation proposal payloads so the fixture supports both raw-document ingestion and immediate MCP/baseline testing.
- Model adjustment and UAT tickets as separate related tickets with explicit machine-readable links back to the primary ticket.
- Provide expected AI findings both as a human-readable investigation rubric and structured finding-like records.
- Include an active requirement without a scenario and a documented omitted edge case as intentional AI-review gaps.
- Provide a concise README explaining the scenario timeline, expected checklist state, suggested MCP/AI questions, and how to use each fixture file.
- Keep all fixture identifiers, timestamps, and relationships deterministic so screenshots, assertions, and repeated local ingestion are stable.

## Acceptance Criteria

- [ ] A developer can identify the demo project, all related tickets, and the primary checklist from the fixture README alone.
- [ ] The initial document, clarification, and UAT documents are valid Markdown and contain enough detail for ingestion/chunking tests.
- [ ] The structured fixture contains active requirements plus superseded history, sources, impacts, scenarios, and completion audits with valid cross-references.
- [ ] The resulting current checklist clearly distinguishes checked items, remaining work, newly added adjustment work, and a known gap for AI review.
- [ ] At least one adjustment changes the meaning of a previously checked requirement and is represented as a new active requirement linked to the superseded requirement.
- [ ] Suggested MCP questions can be answered from the fixture, including progress, what changed, what remains, and why an item exists.
- [ ] Suggested AI insight questions expose at least three deliberate review opportunities: an edge case, an inconsistency or stale completion, and missing UAT coverage.
- [ ] Fixture validation catches malformed references or invalid status values before the fixture is used.
- [ ] Existing application/domain tests remain unaffected and pass after the fixture is added.

## Out Of Scope

- Adding a new production ingestion endpoint or changing the domain model solely for fixture support.
- Generating a binary PDF committed to the repository when equivalent Markdown source is available.
- Building a new demo UI or MCP server specifically for this fixture.

## Constraints And Decisions

- Prefer the repository's existing domain entity vocabulary and ingestion payload shape; do not invent a competing checklist schema.
- Use deterministic IDs and ISO timestamps so the fixture is reproducible.
- Keep intentionally unresolved gaps documented rather than silently filling them in; they are necessary for testing AI review quality.
- Markdown is the canonical document format. PDF conversion can be a local follow-up experiment, not a fixture prerequisite.
- Repeated local ingestion is reset/reload oriented; idempotent import semantics are out of scope unless already provided by the existing importer.
