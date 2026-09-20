# Technical Design

## Boundaries

The API process owns both `/api/*` and the dashboard static files. Static file responses should retain the existing Hono routing and SPA fallback, but assign a content type based on the requested file extension before returning the bytes.

## Data Flow

1. Vite builds `apps/dashboard` into `apps/dashboard/dist` during the Docker build stage.
2. The runtime image copies the workspace and starts the API process.
3. `createApp` resolves the dashboard distribution directory.
4. Existing files under that directory are returned as static responses; unknown dashboard paths receive `index.html`.
5. API routes are registered before the wildcard dashboard route and remain JSON responses.

## Compatibility and Trade-offs

- Use a small extension-to-MIME mapping in the API rather than adding a new static-file dependency.
- Include common asset types emitted by Vite (`.js`, `.mjs`, `.css`, `.json`, `.svg`, `.png`, `.jpg`, `.webp`, `.woff2`) and use `application/octet-stream` as a safe fallback.
- Set `Content-Type` only for existing non-HTML assets. Continue using `c.html` for the HTML shell so its existing content type remains correct.
- The production command may be made explicit separately, but changing it is not required to solve the MIME failure and should not obscure the primary fix.

## Operational Notes

Dokploy should route external traffic to container port `8000`. Runtime variables belong in Dokploy’s environment configuration; `.env.example` is documentation only, and the local `.env` must remain outside the image/build context.

## Rollback

If asset serving regresses, revert only the static response helper and its tests. API routes and the Docker deployment contract remain independent.
