# Evidence Desk Dashboard Implementation Plan

## Ordered Checklist

1. [x] Establish shared dashboard shell tokens and layout classes that bridge the landing page palette to application routes.
2. [x] Redesign the projects index with the Evidence Desk shell, purposeful empty state, compact create action, and existing error/loading behavior.
3. [x] Redesign the project ticket index with stronger project context, ticket hierarchy, and responsive list treatment without invented metrics.
4. [x] Recompose the ticket canvas around checklist-first hierarchy, pending proposal review, and secondary evidence context.
5. [x] Apply Evidence Desk styling to proposal, adjustment, context, history, chat, and export controls while preserving current behavior.
6. [x] Add responsive desktop/tablet/mobile composition and keyboard-visible focus states.
7. [x] Run focused UI checks, dashboard typecheck/test/build, then full repository typecheck/test/build.
8. [ ] Perform a manual interaction review for navigation, create forms, checklist completion, proposal edit/reset/approve/reject, tabs, chat, adjustment, and export actions.

## Verification Note

Focused dashboard Biome checks, dashboard typecheck/test/build, and full repository typecheck/test/build pass. The manual browser click-through remains to be performed in a running browser session.

## Validation Commands

```bash
pnpm exec biome check apps/dashboard/src
pnpm --filter @trachex/dashboard typecheck
pnpm --filter @trachex/dashboard test
pnpm --filter @trachex/dashboard build
pnpm typecheck
pnpm test
pnpm build
```

## Risky Files

- `apps/dashboard/src/routes/__root.tsx`
- `apps/dashboard/src/index.css`
- `apps/dashboard/src/routes/projects.tsx`
- `apps/dashboard/src/routes/projects.$projectId.tsx`
- `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx`

## Explicitly Not Doing

- No backend/API changes.
- No new dashboard features or metrics.
- No Git/repository scan UI.
- No KPI wall, chart system, generic sidebar navigation, or chat-first redesign.

## Rollback

The redesign is presentation-only. Revert route/layout/style changes while retaining the existing API client and interaction handlers if a visual iteration causes behavioral regression.
