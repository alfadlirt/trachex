# Dashboard Metrics And Navigation Design

## Boundary

This task is dashboard-only. Existing API responses remain the source of truth:

```text
landing -> projects route -> listProjects()
project route -> listTickets(projectId)
ticket canvas -> getCanvas(projectId, ticketKey)
```

The dashboard derives display-only counts from the returned arrays. No new API endpoint, persistence field, or domain calculation is needed.

## Navigation Contract

- `/` is the product overview and landing fallback.
- `/projects` is the project index.
- `/projects/$projectId` is the ticket index for one project.
- `/projects/$projectId/tickets/$ticketKey` is the ticket canvas.

Each non-root route gets a visible parent link. The ticket canvas shows a breadcrumb with project name and ticket key; the project ticket index shows the project name and a parent link to `/projects`. The projects index links to `/` through the product/overview control. Links are used instead of browser-history-only controls so deep links remain navigable.

## Derived Metrics

For a ticket canvas:

```ts
checked = checklist.filter((item) => item.devStatus === 'checked').length
total = checklist.length
active = checklist.filter((item) => item.lifecycleStatus === 'active').length
pendingProposals = proposals.filter((proposal) => proposal.status === 'pending').length
impactCounts = impacts grouped by kind
evidenceCount = timeline.length
```

For a project page, `tickets.length` is the only project metric. Labels must make the scope clear, and empty arrays render zero/empty copy rather than fabricated status. The current ticket canvas response is active-only, so the dashboard must not derive or display a superseded count from it.

## Project and ticket tables

The projects index will render the `slug` and nullable `description` already present in each `Project` response. It will not display ticket counts because `/api/projects` does not return them and fetching each project's tickets would introduce N+1 requests. The project ticket index will render the loaded `Project` identity and each loaded ticket's `key`, `title`, and nullable `description` in a responsive table. Empty descriptions use explicit copy, not inferred metadata.

## Visual Treatment

Use the existing Evidence Desk shell and Tailwind styles. Metrics are secondary to the checklist: a compact summary strip or definition-list block with one amber treatment for the current/pending state. Avoid charts and high-density dashboard cards. On small screens, summary items wrap into a two-column or stacked layout without horizontal scrolling.

## Compatibility And Rollback

The API contract and interaction callbacks remain unchanged. If the summary treatment causes layout regressions, remove the summary presentation and navigation styling while retaining the existing route links and data loading.
