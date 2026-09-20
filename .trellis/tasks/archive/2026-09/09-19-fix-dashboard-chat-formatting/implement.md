# Implementation Plan

1. Add dashboard-local chat content/evidence normalization helpers and cover duplicate evidence behavior.
2. Update stream consumption to merge evidence into the active assistant response without creating duplicate messages.
3. Improve the lightweight markdown renderer for paragraph spacing and compact or line-separated unordered lists.
4. Add or extend focused tests for the API stream contract and dashboard rendering helpers.
5. Run dashboard/API tests, typecheck, and Biome on changed files.

## Validation

- `pnpm --filter @trachex/dashboard test`
- `pnpm --filter @trachex/api test`
- `pnpm --filter @trachex/dashboard typecheck`
- `pnpm exec biome check apps/api/src/chat.ts apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx`
