# Deduplicate reconciliation impact entries

## Goal

Prevent repeated service, API, and page entries from appearing in the ticket's impact tab after reconciliation, while preserving the underlying requirement-to-impact associations.

## Background

- Reconciliation approval creates one impact row for every impact in every created requirement draft in `packages/domain/src/services.ts:997-1031`.
- The ticket canvas returns all ticket impact rows from `listImpactsByTicket` in `apps/api/src/routes.ts:141-169`.
- The dashboard context panel renders that ticket-wide list directly in `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx:659-671`, so the same service value appears once per associated requirement.
- The same raw list also drives the impact count and service/API/page breakdown in `TicketEvidenceSummary` at `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx:725-750`.

## Requirements

- Deduplicate displayed impacts by the pair `(kind, normalized value)` for the ticket-wide impact tab.
- Normalize surrounding whitespace before comparing impact values, without changing the displayed value beyond removing surrounding whitespace.
- Keep distinct impact kinds separate, so an identically named service and API remain two entries.
- Keep the existing requirement-level impact associations intact for checklist rows and audit/context data.
- Apply the same unique-impact semantics to the ticket evidence summary counts so the count matches the impact tab.
- Do not alter proposal output, approval behavior, persistence schema, or impact creation history in this fix.

## Acceptance Criteria

- [x] A reconciliation producing the same service impact on multiple requirements displays that service once in the ticket impact tab.
- [x] Repeated values with different surrounding whitespace are displayed once using the trimmed value.
- [x] Distinct service, API, and page impacts remain separately visible.
- [x] The evidence summary impact total and per-kind counts count unique ticket-wide impacts, not raw associations.
- [x] Checklist rows continue to show the impacts associated with their individual requirements.
- [x] Regression coverage prevents the duplicate-impact display behavior from returning.

## Out Of Scope

- Removing duplicate impact associations from persisted history.
- Changing the agent prompt or reconciliation output schema.
- Merging impacts with similar but non-identical names beyond whitespace normalization.
