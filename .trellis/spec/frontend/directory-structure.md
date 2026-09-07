# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The dashboard (`apps/dashboard`) is a Vite + React 19 + TanStack Router + Tailwind v4 SPA. It is a thin client of the Hono API (`apps/api`) — the browser never touches SQLite (ADR 001). Routes are ticket-centric per `docs/ux.md`.

---

## Directory Layout

```
apps/dashboard/
├── index.html
├── vite.config.ts
└── src/
    ├── main.tsx            # entry (createRoot + RouterProvider)
    ├── router.tsx          # route tree (rootRoute.addChildren)
    ├── index.css           # Tailwind v4 (@import 'tailwindcss')
    ├── lib/
    │   ├── api.ts          # typed fetch client for /api/*
    │   └── utils.ts        # cn() (clsx + tailwind-merge)
    └── routes/
        ├── __root.tsx      # layout (header + Outlet)
        ├── index.tsx       # redirect / -> /projects
        ├── projects.tsx
        ├── projects.$projectId.tsx
        └── projects.$projectId.tickets.$ticketKey.tsx   # ticket canvas
```

## Module Organization

- Routes stay thin; pages compose data loading + UI inline (MVP). Feature modules dirs (`src/modules/`) are the target for future growth per `docs/ux.md`.
- `apps/api/src/routes.ts` owns the API handlers; `src/chat.ts` owns the JSONL chat stream; `src/validation.ts` owns Zod request schemas; `src/errors.ts` maps errors → `{ error: { code, message } }` + status.

## Naming Conventions

- TanStack Router file routes: `$param` for dynamic segments.
- Components use `cn()` from `src/lib/utils.ts`.
- Buttons always declare `type="button"` (Biome `useButtonType`).

## Examples

- Ticket canvas: `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx` — checklist as the main artifact, proposal review cards, adjustment composer, context/history/chat panels, export buttons.
- API mount: `app.route('/api', createRoutes(...))` — note: mount with `/api` prefix, NOT `/api/*` (Hono wildcard mount did not match).

## Common Mistakes

- **Hono `app.route('/api/*', sub)` returns 404** — use `app.route('/api', sub)` for prefix mounting.
- **TanStack Router component props**: use `useParams({ from: route.id })`, not destructured props (component type is a lazy-exotic).
- **`key={index}` in maps** triggers Biome `noArrayIndexKey`; use stable ids (e.g. a `useRef` counter for chat log lines).
