# Implementation Plan

1. Read the existing dashboard shell, project index, project ticket index, ticket canvas, API types, and current Evidence Desk styles before editing.
2. Add consistent overview/parent links and breadcrumb context to all dashboard levels without changing route behavior.
3. Add project ticket-count summary using the existing `listTickets` response and an honest zero state.
4. Replace title-only project and ticket lists with responsive tables using only fields returned by the existing API; do not add N+1 project ticket requests.
5. Add ticket-canvas derived summary metrics from `TicketCanvas` arrays, keeping the checklist visually primary and documenting the active-only checklist response limitation.
6. Apply responsive spacing, wrapping, focus, and contrast treatment for navigation and summaries.
7. Add focused pure metric tests or route-level assertions where the existing test setup supports them.
8. Run dashboard lint, tests, typecheck, build, then inspect the final diff for invented data or interaction regressions.

## Validation

```bash
pnpm exec biome check apps/dashboard/src
pnpm --filter @trachex/dashboard test
pnpm --filter @trachex/dashboard typecheck
pnpm --filter @trachex/dashboard build
```

## Risky Files

- `apps/dashboard/src/routes/__root.tsx`
- `apps/dashboard/src/routes/projects.tsx`
- `apps/dashboard/src/routes/projects.$projectId.tsx`
- `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx`
- `apps/dashboard/src/index.css`

## Explicitly Not Doing

- No API or database changes.
- No fabricated metrics or backend analytics.
- No charts, KPI wall, generic sidebar, or chat-first layout.
