# Phase 6: Local API and Bundled Dashboard

## Goal

Implement the Hono local API (started by `trachex dashboard`) serving the built React dashboard. The dashboard is ticket-centric (docs/ux.md): project list + ticket navigation, ticket canvas with the current checklist as the main artifact, proposal review/approval, inline adjustment flow, timeline/history + impact panels, export controls, and an embedded chatbot. The browser never opens SQLite directly; all reads/writes go through the Hono API which calls the same domain services as CLI/MCP.

Source of truth: `docs/implementation-plan.md` Phase 6, `docs/architecture.md` API Surface + Runtime Topology, `docs/ux.md` (whole doc).

## Requirements

- Hono server started by `trachex dashboard` (wired into CLI), binds localhost by default.
- API routes per `docs/architecture.md`:
  - `GET /api/projects`, `POST /api/projects`
  - `GET /api/projects/:projectId/tickets`, `POST /api/projects/:projectId/tickets`
  - `GET /api/projects/:projectId/tickets/:ticketKey` (ticket canvas data)
  - `POST /api/projects/:projectId/tickets/:ticketKey/adjustments` (pending adjustment proposal)
  - `POST /api/proposals/:proposalId/approve`, `POST /api/proposals/:proposalId/reject`
  - `POST /api/requirements/:requirementId/check` (human completion)
  - `GET /api/projects/:projectId/tickets/:ticketKey/export`
  - `POST /api/chat/:projectId/:ticketKey` (stream agent interaction)
- Handlers validate input (Zod), call domain services, serialize domain results.
- Static serving of the built React app (`apps/dashboard/dist`).
- Dashboard (React 19 + Vite + TanStack Router + Tailwind v4 + shadcn/Radix primitives):
  - `/projects`, `/projects/:projectId`, `/projects/:projectId/tickets/:ticketKey`, with `?panel=history|chat`.
  - Ticket canvas: current checklist as the main artifact; requirement cards with completion checkbox, lifecycle badge, source chip, impact chips, supersedes indicator, test-scenario disclosure.
  - Proposal review cards with Approve/Reject.
  - Inline adjustment flow (source type + attribution + note).
  - Timeline/history panel; impact panel.
  - Export controls (markdown/json download).
  - Embedded chatbot (same services; chat changes appear as pending proposals).
  - Responsive mobile layout (drawers/tabs).
- Every checklist completion remains a deliberate human action (explicit confirm in UI).

## Acceptance Criteria

- [ ] Dashboard works with SQLite and no Docker.
- [ ] Browser never accesses SQLite directly (only the Hono API).
- [ ] Dashboard and CLI can run concurrently (WAL).
- [ ] Every checklist completion remains a deliberate human action.
- [ ] Chat-created changes appear as pending proposals, not silent mutations.
- [ ] Ticket canvas shows checklist, proposals, timeline, impacts, scenarios.
- [ ] API routes validate input and return structured errors.
- [ ] API tests pass (route validation, JSONL events).

## Dependency order

- Depends on Phases 1-5 (domain, storage, agent, CLI wiring). Phase 7 packages the built dashboard assets.

## Notes

- Dashboard is a Vite app in `apps/dashboard`; the Hono server serves `dist/` and proxies `/api`.
- Chat route streams JSONL events (matching the reference stack); the chatbot uses the same agent pipeline and only creates pending proposals.
- BlockNote is used only for the adjustment note editor (ADR 004); requirements render as custom components.
