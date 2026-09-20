# Grounded Dashboard Chatbot Implementation Plan

## Ordered Checklist

1. [x] Inspect the installed Anvia agent APIs and current `RunAgentFn` boundary; choose the smallest text-answer seam that does not weaken proposal output validation.
2. [x] Add a server-side ticket baseline projection for chat context using existing domain services/repositories.
3. [x] Replace placeholder chat events with grounded agent invocation and stable JSONL text/evidence/error/done events.
4. [x] Add prompt guardrails for evidence-bound answers, uncertainty, and proposal-only mutation.
5. [x] Fix dashboard JSONL stream parsing with a persistent chunk buffer.
6. [x] Improve chat empty/loading/error/response/evidence states without making chat the primary workspace.
7. [x] Preserve API contract coverage and validate the chat route through the existing test suite.
8. [x] Run focused dashboard/API/agent checks, then full typecheck/test/build.
9. [x] Persist ticket chat sessions/messages through the existing SQLite session repository and restore history in the dashboard.
10. [x] Pass recent persisted chat messages into the grounded assistant context without making chat memory canonical.
11. [x] Add safe lightweight Markdown rendering for assistant messages.
12. [x] Stabilize the send button width during the reading state.
13. [x] Add API session lifecycle routes: list sessions, create session, and load messages for a selected session.
14. [x] Update chat POST to accept an explicit session ID and create no implicit shared transcript.
15. [x] Add dashboard `New Chat`, previous-session list, selected-session loading, and session switching.
16. [x] Widen the chat layout so the assistant has a visibly larger reading/composer surface.
17. [x] Run focused and full validation after the multi-session iteration.

## Validation Commands

```bash
pnpm exec biome check apps/api/src apps/dashboard/src packages/agent/src
pnpm typecheck
pnpm test
pnpm build
```

## Risky Files

- `apps/api/src/chat.ts`
- `apps/api/src/chat.test.ts` or `apps/api/src/routes.test.ts`
- `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx`
- `packages/agent/src/` if a text-answer seam is required

## Explicitly Not Doing

- No Git/repository scan.
- No direct canonical requirement mutation from chat.
- No new chat framework or database schema.
- No replacement of MCP contracts.
