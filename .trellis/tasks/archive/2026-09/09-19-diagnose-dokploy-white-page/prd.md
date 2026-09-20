# Diagnose Dokploy white page deployment

## Goal

Make the Dokploy deployment render the Trachex dashboard instead of returning an empty React root, while preserving the existing API, environment, and persistent-data behavior.

## Background and Confirmed Facts

- Dokploy reports the container listening on `0.0.0.0:8000` and returns the generated `index.html`.
- The generated shell references root-relative `/assets/*.js` and `/assets/*.css` files.
- In the current local reproduction, `GET /` returns `200 text/html`, while the generated JavaScript and CSS asset responses return `200` without a `Content-Type` header (`apps/api/src/index.ts:70-77`).
- The browser can reject a JavaScript module without a JavaScript MIME type, leaving `#root` empty and matching the reported white page.
- `Dockerfile:42` starts `pnpm --filter @trachex/api dev`; this uses the development script in the production image but is not the direct cause of the blank page because the server and generated assets are reachable.
- `docker-compose.yml` correctly exposes the internal port and supplies runtime API configuration. `TRACHEX_*`, provider keys, and database/vector settings are server-side values and are not needed by the Vite bundle.
- `.dockerignore` excludes local `.env` and build output; the Docker build creates the dashboard output in the build stage before copying it into the runtime image.
- The worktree contains unrelated user changes; those files must not be reverted or reformatted.

## Requirements

- Serve generated dashboard assets with browser-correct MIME types, at minimum JavaScript modules as `text/javascript` and CSS as `text/css`.
- Preserve SPA fallback behavior for dashboard routes while keeping `/api/*` routes handled by the API.
- Keep deployment configuration explicit and consistent between `.env.example`, `Dockerfile`, and `docker-compose.yml`.
- Avoid exposing or committing real secrets from the local `.env`.
- Add regression coverage for the dashboard shell and static asset response headers.

## Out of Scope

- Changing LLM provider behavior, API routes, storage adapters, or dashboard UI.
- Replacing Dokploy, adding a reverse proxy, or introducing a separate frontend container.
- Treating missing provider credentials as a dashboard startup failure; those credentials are only needed for agent actions.

## Acceptance Criteria

- [x] A production image request to `/` returns the dashboard HTML and a request to its generated `.js` asset returns `200` with a JavaScript MIME type.
- [x] A request to the generated `.css` asset returns `200` with `text/css`.
- [x] A client-side dashboard route still receives the dashboard HTML fallback.
- [x] API health remains available at `/api/health` and is not intercepted by the SPA fallback.
- [x] Docker build/typecheck/tests pass, and the final report includes the required Dokploy port and environment settings.
