# Dashboard metrics and evidence summary

## Goal

Make the dashboard easier to navigate and give users a compact, evidence-backed view of project and ticket state without turning Trachex into a generic KPI dashboard.

## Background

- The approved Evidence Desk direction keeps the checklist as the ticket focal point and prohibits invented activity, progress, owner, or repository metrics.
- The dashboard currently has project, ticket, and ticket-canvas routes but users do not get a consistent explicit way to move back up the hierarchy.
- The existing API already returns the real entities needed for derived counts: projects, tickets, checklist requirements, proposals, impacts, and timeline events.

## Requirements

- Add a consistent visible back-navigation control at every dashboard level: landing to Projects, Projects to the overview, project tickets to Projects, and the ticket canvas to its project ticket list.
- Add breadcrumbs or equivalent hierarchy context on project and ticket pages so the current location is clear on desktop and mobile.
- Keep navigation destinations deterministic and usable when browser history is empty; do not rely on browser back alone.
- Derive and display only real summary metrics: project ticket count, ticket checklist checked versus total, active requirements, pending proposals, impact counts by service/API/page, and timeline/evidence event count. Superseded requirements remain deferred because the current canvas response excludes them.
- Make project indexes useful evidence tables: show returned project slug and description on `/projects`, and show the returned project identity plus ticket key, title, and description on `/projects/$projectId`. Do not add an invented ticket count or make N+1 ticket requests from the projects index.
- Present metrics as restrained evidence-summary rows or compact status groups, not a chart system, KPI wall, or generic admin sidebar.
- Keep the checklist as the primary ticket artifact and preserve all existing create, edit, approve, reject, complete, chat, adjustment, and export behavior.
- Keep metrics honest when data is empty: show zero or an explicit empty state, never placeholder values.
- Preserve responsive behavior, keyboard focus states, and comfortable mobile tap targets.

## Out Of Scope

- New backend persistence or analytics endpoints.
- Git/repository scanning, deployment metrics, activity feeds, or invented timestamps/owners.
- Charts, trend lines, generic KPI cards, or a chat-first dashboard layout.
- Changes to domain semantics or proposal approval behavior.

## Acceptance Criteria

- [ ] Every dashboard level has a visible labeled navigation path to its parent or overview, including a deterministic fallback when browser history is unavailable.
- [ ] Project and ticket pages expose the current hierarchy through readable breadcrumbs or equivalent context on desktop and mobile.
- [ ] Ticket summary shows checked/total requirements, active requirements, pending proposals, impact groups, and timeline event count using only loaded API data; it explicitly avoids claiming a superseded count that the response cannot support.
- [ ] Project summary shows the actual number of tickets returned by the project ticket API, including a correct zero state.
- [ ] No metric or visual implies data that the API does not provide.
- [ ] Metrics remain readable without horizontal scrolling on mobile and retain visible keyboard focus states.
- [ ] Existing dashboard interactions continue to work unchanged.
- [ ] Dashboard tests, typecheck, build, and focused lint pass.

## Notes

- This child task is independently verifiable from the parent Evidence Desk redesign.
- The API/domain behavior is intentionally unchanged; metrics are derived in the dashboard from existing responses.
