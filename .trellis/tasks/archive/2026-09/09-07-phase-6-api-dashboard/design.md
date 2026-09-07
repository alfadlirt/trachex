# Phase 6: Local API and Bundled Dashboard — Design

## Two packages

- `apps/api` — Hono server (`@hono/node-server`), started by `trachex dashboard`. Serves `/api/*` + static `apps/dashboard/dist`.
- `apps/dashboard` — Vite + React 19 + TanStack Router + Tailwind v4.

## API design (`apps/api/src`)

- `src/index.ts` — `createApp({ appDir })` builds the Hono app; `startDashboard({ appDir, port })` serves it.
- `src/routes.ts` — route handlers calling domain services via a `SqliteUnitOfWork` (one per request, short transactions; no transaction across LLM).
- `src/validation.ts` — Zod schemas for request bodies.
- `src/errors.ts` — error → JSON `{ error: { code, message } }` + status mapping (404/409/400/500).
- `src/chat.ts` — `POST /api/chat/:projectId/:ticketKey` streams JSONL events from the agent pipeline; chat messages are persisted as pending proposals only.

Routes (per architecture):
- `GET /api/projects` → list
- `POST /api/projects` → create
- `GET /api/projects/:projectId/tickets` → list
- `POST /api/projects/:projectId/tickets` → create ticket (+ optional source)
- `GET /api/projects/:projectId/tickets/:ticketKey` → canvas data: ticket, checklist, proposals, timeline, impacts, scenarios, sources
- `POST /api/projects/:projectId/tickets/:ticketKey/adjustments` → ingest note + `runReconciliation` → pending proposal
- `POST /api/proposals/:proposalId/approve` / `reject`
- `POST /api/requirements/:requirementId/check` → human completion (requires `{ confirm: true }`)
- `GET /api/projects/:projectId/tickets/:ticketKey/export?format=markdown|json` → summary
- `POST /api/chat/:projectId/:ticketKey` → JSONL stream

## Dashboard design (`apps/dashboard/src`)

- `src/main.tsx`, `src/router.tsx` (TanStack Router file routes).
- `src/modules/` per docs/ux.md: `projects/`, `tickets/`, `checklist/`, `proposals/`, `sources/`, `timeline/`, `impacts/`, `chat/`, `export/`.
- `src/lib/api.ts` — typed fetch client for `/api/*`.
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge).
- `src/components/ui/` — selective shadcn/Radix primitives (button, dialog, tabs, popover, tooltip, drawer).
- Tailwind v4 via `@tailwindcss/vite`; CVA for requirement/proposal variants; lucide-react icons.
- Ticket canvas: center column checklist; right context panel (source/impacts/history); chat drawer; mobile drawers/tabs.
- Checklist completion: checkbox triggers a confirm dialog (human action); after mutation, announce actor/timestamp.
- Adjustment flow: inline composer (BlockNote editor for the note) → submit → pending proposal cards appear in place.
- Chat: embedded assistant streaming JSONL; tool results as compact cards; changes only ever create pending proposals.

## Build/serve

- `apps/dashboard` builds to `dist/` (Vite). `apps/api` serves it statically and falls back to `index.html` for SPA routes.
- `trachex dashboard [--project]` → CLI starts the Hono server (Phase 6 wires it; Phase 7 handles packaging).

## Tests

- `apps/api/src/routes.test.ts` — route validation + canvas data + approve/reject/check + export; JSONL chat emits events.
- `apps/dashboard` — minimal unit test for the api client + a component smoke test (Vitest if configured); keep light.

## Rollout / rollback

- Phase 6 builds on Phases 1-5. Failure = revert phase-6 commit(s). Phase 7 packages the built assets.
