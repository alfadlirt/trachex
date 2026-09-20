# Technical Design

## Boundaries

The dashboard remains a thin API client. Domain interfaces and services own lifecycle, ordering, and provenance rules. SQLite stores the canonical state. API routes expose scoped mutations and view projections. The worker owns adjustment reconciliation and agent ordering proposals.

## Data Flow

1. Project/subject edit and delete requests validate resource ownership, exact-name confirmation, and cascade scope in the API/domain layer.
2. The canvas response returns active requirements in persisted order plus a separate superseded projection. Each superseded entry joins its requirement, source, superseding relationship, replacement, and audit timestamps.
3. Checklist reorder accepts the complete active ordered-id set for one ticket/subject and writes `displayOrder` in one short repository transaction. The API rejects missing, duplicate, superseded, or foreign IDs.
4. Adjustment submission remains asynchronous. The worker sends current requirements and adjustment evidence to the agent with an explicit dependency-aware ordering instruction and a structured proposed order/rationale. Proposal approval persists the proposal's canonical changes and proposed order; manual reorder uses the same reorder endpoint.
5. Chat accepts an optional session ID. If it is absent, the API creates a session for the validated ticket before invoking the agent, then returns the stream with the created session ID in the start event. The dashboard updates its active session from that event.

## Contracts

- Extend the dashboard API types with `Subject`, edit/delete response types, superseded entries, order proposal metadata, and chat start session metadata.
- Add project and subject `PATCH` plus `DELETE` endpoints. Delete requires a body containing the exact resource name, and the API returns a scoped conflict when it does not match.
- Add `POST /requirements/reorder` or a ticket-scoped equivalent carrying `{ ticketId, orderedIds }`; validate ticket/project scope before calling `reorderChecklist`.
- Expand the ticket canvas response with `superseded` and relationship/provenance data without changing the meaning of `checklist`, which remains active-only for compatibility.
- Use a structured proposal field for ordering rather than parsing prose. The field contains ordered requirement IDs, a rationale, and uncertainty notes. Existing proposal versions preserve prior model output.

## Persistence And Migration

- Reuse `display_order`, requirement relationships, sources, audits, and existing lifecycle fields wherever possible.
- Add only fields that are required to persist agent order rationale or proposal metadata after confirming the existing proposal schema and serializers. Prefer proposal-version JSON for review-only metadata if canonical order can be validated against current requirements at approval time.
- Implement project/subject cascade deletion in repository/domain services with foreign-key-safe ordering. Do not rely on SQLite cascade behavior that is not declared in the current schema.
- Add migration tests only if a new column/table is necessary; existing order and relationship migrations must remain backward compatible.

## UI Composition

- Projects page: compact create form with name only, project rows/cards showing name with slug beneath, and row actions for edit/delete.
- Project page: project identity with slug subtitle and actions, subject creation with title only, subjects listed with title/slug hierarchy and actions.
- Ticket canvas: identity/actions, active checklist with pagination and reorder affordances, proposal review, adjustment composer, processing queue, superseded disclosure, then context/history/chat tabs. Desktop may use a two-column support rail; mobile uses document order.
- Use native `dialog` for edit, danger confirmation, and queued feedback. Confirmation remains disabled until exact-name input matches and reports errors in the dialog.
- Use a real hidden file input behind a labelled drop/select surface. Drag and drop enhances the input; it is never the only path.

## UX And Accessibility Decisions

- Agent ordering is previewed as a reviewable change, never silently applied.
- Reorder has both pointer and keyboard controls. Move buttons announce the item's new position and disable at list boundaries.
- Every data region has loading, empty, and error states. Status uses text in addition to color.
- Slugs are secondary metadata, not competing table columns, because the human name is the user's recognition anchor.
- Amber remains reserved for active focus, review attention, and primary action; destructive actions use explicit red text/fill with contrast rather than decorative warning color.
- Design read: dashboard workflow for developers and analysts, in a warm evidence-led paper-and-ink visual language, dial ENERGY 2 / RHYTHM 2 / MOTION 1. Motion is limited to dialog entry, queue feedback, and state transitions because the user is managing evidence rather than browsing a marketing page.

## Risks And Rollback

- Existing clients depend on `checklist` being active-only. Keep that field stable and add `superseded` rather than changing its semantics.
- Agent output may reference stale IDs. Validate the complete proposed order against the current active set and show an uncertainty state instead of applying invalid data.
- Cascade deletion can affect multiple repositories. Keep deletion behind explicit confirmation, perform it in a transaction where the adapter supports it, and add integration coverage before enabling the UI action.
- If agent ordering is not available for an old proposal, render the proposal normally and omit the order preview rather than blocking approval.
