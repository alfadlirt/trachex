# Implementation Plan

## Ordered Work

1. Add domain/API contracts and tests for project and subject update/delete, including exact-name confirmation and safe cascade behavior.
2. Update project and subject create screens to remove slug inputs, show generated slugs as subtitles, and add edit/delete dialogs with refresh and route recovery.
3. Expose the full checklist view projection through the ticket API, including superseded entries, source provenance, relationships, and timestamps.
4. Add the scoped reorder endpoint and dashboard active-list pagination, drag reorder, keyboard move controls, persistence feedback, and tests.
5. Extend agent adjustment/proposal schemas and worker instructions for dependency-aware order proposals, rationale, uncertainty, and approval-time validation.
6. Change chat to lazily create a session on first send, update the stream contract, preserve unsent drafts when switching session view, and add API/UI regression tests.
7. Refactor ticket canvas hierarchy so adjustment intake precedes queue, then improve category labels, select styling, file drop/select UI, queued modal, and responsive states.
8. Add superseded disclosure UI and verify it remains separate from active counts, pagination, completion, and reorder operations.
9. Run format, typecheck, unit/integration tests, dashboard build, and a manual keyboard/mobile interaction pass.

## Validation Commands

- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @trachex/dashboard build`
- `python3 /Users/bleur/.agents/skills/antislop-human/contrast-check.py "#18181b" "#fffdf8"`
- `python3 /Users/bleur/.agents/skills/antislop-human/contrast-check.py "#b45309" "#fffdf8"`

## Review Gates

- API/domain tests cover cross-resource scoping, exact-name delete rejection, cascade cleanup, superseded projection, complete reorder validation, and lazy chat sessions.
- Agent tests cover dependency-aware order output, stale/duplicate ID rejection, rationale, and uncertainty handling.
- Dashboard tests cover create/edit/delete states, pagination, reorder controls, dialog keyboard behavior, file selection, queued feedback, session creation, and mobile document order.
- Manual click-through records every new button, dialog, select, file control, pagination control, reorder control, tab, and chat path, including Escape and keyboard operation.

## Risky Files And Rollback Points

- `packages/storage-sqlite/src/migrations.ts` and `repositories.ts`: rollback requires preserving existing migration history and adapter compatibility.
- `packages/domain/src/edits.ts`, `views.ts`, and repository interfaces: rollback must not remove existing `displayOrder` or active-only behavior.
- `apps/api/src/routes.ts`, `chat.ts`, and validation: maintain response compatibility for current clients.
- `packages/worker/src/worker.ts` and agent schemas/prompts: old proposals must remain reviewable.
- `apps/dashboard/src/routes/projects.tsx`, `projects.$projectId.tsx`, and ticket canvas: retain empty/loading/error states while changing layout.
