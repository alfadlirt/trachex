# Implementation Plan

1. Load backend and frontend Trellis specs before editing.
2. Add a minimal static-asset MIME mapping in `apps/api/src/index.ts` and apply it to existing asset responses.
3. Add API tests using a temporary dashboard distribution to assert HTML, JavaScript, CSS, SPA fallback, and API health behavior.
4. Review Dockerfile and Compose configuration for only concrete deployment inconsistencies; avoid unrelated changes and secrets.
5. Run the API/dashboard tests, typechecks, dashboard build, and Docker/Compose configuration validation available in the environment.
6. Inspect the final diff so unrelated worktree changes are untouched, then provide Dokploy redeploy and port guidance.

## Risky Files

- `apps/api/src/index.ts`: shared routing and static response behavior.
- `apps/api/src/routes.test.ts` or a focused API test: test setup can create temporary data and must clean it up.
- `Dockerfile`: only change if verification establishes a necessary production-runtime correction.

## Rollback Point

The MIME mapping and regression test are isolated. If the container build exposes a separate issue, keep the MIME fix and report that issue independently rather than broadening the patch.
