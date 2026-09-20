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
    ├── components/
    │   └── crud-dialogs.tsx  # DangerConfirmDialog + SimpleEditDialog (native dialog)
    └── routes/
        ├── __root.tsx      # layout (header + Outlet); bare Outlet on the landing route
        ├── index.tsx       # landing page (/)
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
- **Dark-surface controls with zinc borders**: `border-zinc-600+` on `zinc-950` measures under 3:1 non-text contrast on an interactive boundary. Build filled/selected controls and text links instead of outlined buttons on dark surfaces.

## Chat Stream Rendering Contract

`apps/api/src/chat.ts` emits a `start` JSONL event that now carries the
created `sessionId` (lazy session creation on first message), followed by one
`text` event for the assistant answer, then zero or more `evidence` events,
followed by `done`. The dashboard must adopt the `sessionId` from the `start`
event so the reply lands in history and follow-ups stay in one thread. It must
merge evidence into the current assistant message instead of appending one
message per event. Evidence matching is case-insensitive and blank evidence
sources are ignored.

Chat history uses the same normalization as live responses. The lightweight
renderer supports paragraphs, `##`/`###` headings, unordered lists, inline
code, and bold text. Compact model output such as:

```text
It covers: - First item - Second item
```

is normalized to separate list items before rendering.

### Wrong

```tsx
if (event.type === 'evidence') append('assistant', `Evidence: ${event.source}`);
```

### Correct

```tsx
if (event.type === 'evidence' && event.source?.trim()) {
  appendEvidence(event.source);
}
```

Evidence is presentation metadata in this stream, not a separate assistant
turn. Keeping it in the current message prevents duplicate evidence when the
model has already included the same reference in its answer.

## Dashboard Summary Metrics

Dashboard summary metrics must be derived from the arrays returned by the
existing API client, not from placeholder values or inferred activity. The
ticket canvas response provides the active checklist, proposals, impacts,
timeline, `superseded` entries, and `adjustmentJobDetails`. Counts stay
active-only; the superseded section is separate evidence and never enters the
completion count or pagination.

Ticket-wide impact summaries are display projections, not replacements for the
requirement-level impact associations returned by the API. Use a shared helper
to deduplicate by `(kind, value.trim())`, trim the displayed value, and leave
the source array unchanged. Checklist rows must continue filtering the raw
impact array by `requirementId` so each requirement retains its own context.

---

## Landing Pages (`/`)

The root route (`routes/index.tsx`) is a public-facing, near-black minimalist landing page. Dashboard routes keep their light chrome because `__root.tsx` returns a bare `<Outlet />` only when the landing route is active:

```tsx
function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === '/') return <Outlet />;
  // dashboard shell ... unchanged
}
```

### Dark palette (contrast-verified against `#09090b`)

| Role | Utility | Ratio |
|------|---------|-------|
| Page background | `bg-zinc-950` (`#09090b`) | base |
| Primary text | `text-zinc-100` (`#f4f4f5`) | 18.1:1 |
| Muted text | `text-zinc-400` (`#9f9fa9`) | 7.59:1 |
| Accent / CTA fill | `bg-amber-400` (`#ffb900`) | 11.55:1 |
| Focus ring | `#ffd230` (`amber-300`) | 13.75:1 |

- `zinc-500` (`#71717b`) is 4.12:1 on the base: it FAILS normal-text contrast and must not be used for body text or interactive boundaries.
- One scoped focus rule covers every landing control: `.landing :focus-visible { outline: 2px solid #ffd230; outline-offset: 2px }` in `index.css`.
- Amber stays restrained: primary CTAs, selected timeline state, active status badge, and a single hero kicker. Never spread it across every section.

### Conventions

- **Modal panel**: native `<dialog>` + `showModal()`/`close()` driven by a `useEffect` on the `open` prop; sync React state via the dialog `close` event (gives Escape and focus trapping for free). Style `dialog::backdrop` in `index.css` (Tailwind utilities cannot target it). Do not use `backdrop-filter`. Shared edit/danger dialogs live in `src/components/crud-dialogs.tsx`; danger dialogs stay disabled until the typed name exactly matches the target.
- **Checklist rows**: one 44px flex row holds grip, position number, and check control (`items-center`); the title block aligns by top padding, not per-control `mt-*` offsets. Secondary up/down buttons sit side by side so rows keep a stable height.
- **Reduced motion**: Tailwind `motion-safe:` / `motion-reduce:` variants gate `transition-colors`; entrance/selection keyframes live in `index.css` and are disabled under `@media (prefers-reduced-motion: reduce)`.
- **Copy discipline**: landing copy comes from `copy.md` with light edits, zero em dashes, and example timeline content is labelled "Example walkthrough, not real project data." Never imply fabricated customers, metrics, or package availability (the CLI is not published; `npx trachex init` is shown as inert text only).
