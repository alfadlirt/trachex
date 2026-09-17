# Implementation Plan: Root Landing Page

## Ordered Steps

1. Inspect the active frontend conventions and current root/dashboard route behavior.
2. Replace the root redirect with the landing-page composition while preserving the `/projects` route.
3. Add the typed example evidence timeline and local selection state with keyboard-accessible controls.
4. Add the stay-tuned CTA panel with close and Escape behavior, honest unpublished-package copy, and no fake installation action.
5. Add the near-black/amber responsive styles, focused states, reduced-motion behavior, and mobile overflow handling.
6. Run formatter/typecheck/tests/build for `apps/dashboard` and inspect the diff for unrelated changes.
7. Perform a final accessibility and content review against the PRD and antislop UI/human constraints.

## Validation Commands

- `pnpm --filter @trachex/dashboard typecheck`
- `pnpm --filter @trachex/dashboard test`
- `pnpm --filter @trachex/dashboard build`
- `pnpm exec biome check apps/dashboard/src`

## Review Gates

- Do not start implementation until this plan and the PRD are reviewed and the task status is changed from `planning` to `in_progress`.
- Before reporting completion, verify `/` and `/projects` route behavior, keyboard timeline selection, CTA panel close behavior, reduced motion, and mobile layout.
- Do not add invented social proof, metrics, package availability, or dead links during implementation.

## Rollback Point

If the landing page introduces dashboard regressions, restore the root route redirect and remove only the landing-page route/style additions. No backend rollback is needed.
