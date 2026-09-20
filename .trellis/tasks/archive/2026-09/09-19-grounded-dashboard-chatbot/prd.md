# Grounded dashboard chatbot

## Goal

Connect dashboard chat to the ticket baseline and real agent path so it provides useful, evidence-bound ticket assistance without becoming a generic chat application or silently mutating canonical data. Support multiple independent conversations per ticket, with explicit `New Chat` creation and a visible previous-session list.

## Product Value

The chatbot is valuable as a contextual assistant at the point where a developer is reviewing a ticket. It should answer questions such as:

- What changed on this ticket?
- What remains unchecked?
- Why does this requirement exist?
- Which source or person caused the change?
- What is still unclear and should be confirmed with the BA?

It should return grounded explanations and source references. When a user wants to change requirements, it should create a pending adjustment/reconciliation proposal, never apply a checklist mutation directly. It is not a general-purpose assistant, repository scanner, Git verifier, or chat-first navigation surface.

## Confirmed Current Problems

- `apps/api/src/chat.ts` currently emits a placeholder echo/note stream and does not invoke `runAgent`.
- The dashboard chat reader in `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx` parses each network chunk independently, so JSONL records split across reads can be lost or fail to parse.
- MCP already exposes baseline and proposal tools, but the dashboard chat does not reuse that grounded application behavior.
- The domain/storage layer already has `ChatSession` and `ChatMessage` persistence, but the current implementation uses one deterministic session identity per ticket. That preserves one transcript, not multiple user-created conversations.

## Requirements

- Build a ticket-scoped baseline context for the dashboard agent containing current checklist, superseded history, sources, impacts, success criteria/scenarios, timeline, and pending proposals.
- Invoke the configured Trachex agent through the existing API `runAgent` path, with system instructions requiring evidence-bound answers, uncertainty when evidence is missing, and proposal-only mutations.
- Expose grounded assistant responses through the existing JSONL stream route.
- Fix frontend JSONL parsing with a persistent buffer so records split across network chunks are handled correctly.
- Render assistant text, source/evidence references when available, loading state, stream errors, and empty state clearly.
- Restore persisted ticket chat history when the Chat tab opens and save user/assistant messages through the existing session repository.
- Support multiple chat sessions per ticket. `New Chat` creates a new session, the active session is explicit, and previous sessions are listed with a useful title/preview and last-updated time.
- Selecting a previous session restores only that session's messages; starting a new session does not delete prior conversations.
- Render assistant responses with a safe lightweight Markdown presentation for headings, bullets, inline code, and paragraphs. Do not add a Markdown package for this MVP.
- Give the chat panel enough horizontal space for readable Markdown and longer grounded answers while keeping it secondary to the checklist.
- Preserve the existing dashboard interaction model: chat is contextual and secondary to the checklist.
- Ensure questions about requirement changes are answered from stored evidence rather than model invention.
- Ensure any requirement adjustment created from chat is pending and requires the existing human review/approval flow.
- Add API tests for baseline/agent invocation, stream events, empty messages, agent errors, and grounded unsupported-question escalation.
- Add frontend-facing contract tests or parsing tests for chunked JSONL events where the existing test setup supports them.

## Out Of Scope

- General-purpose chat history across tickets.
- Git/repository scanning or implementation verification.
- Direct checklist mutation from chat.
- A new chat UI framework or new runtime dependency.
- Replacing MCP tools; the dashboard should reuse equivalent application/domain behavior, not duplicate a second source of truth.

## Acceptance Criteria

- [x] A dashboard message invokes the configured agent with the selected ticket baseline, not a placeholder echo.
- [x] A grounded question receives an answer that references the ticket's stored requirements/sources/history when evidence exists.
- [x] An unsupported question produces an explicit uncertainty/escalation response rather than an invented answer through prompt guardrails.
- [x] A chat-created adjustment remains a pending proposal and does not change the active checklist before approval through the existing adjustment flow.
- [x] JSONL events split across network chunks are parsed and rendered correctly.
- [x] Empty input, loading, stream error, and completed response states are visible and recoverable.
- [x] Existing MCP/domain proposal and human-approval invariants remain unchanged.
- [x] `pnpm test`, `pnpm typecheck`, and `pnpm build` remain green.
- [x] Changing away from and back to the Chat tab restores the ticket conversation.
- [x] User and assistant messages are persisted in the existing SQLite session/message tables.
- [x] Assistant Markdown is rendered safely without raw HTML execution.
- [x] `New Chat` starts a fresh ticket conversation without changing or deleting previous sessions.
- [x] Previous ticket chat sessions are listed and selectable.
- [x] Chat width is visibly increased while the checklist remains primary.
- [x] Previous sessions are available from the dedicated Sessions tab rather than an inline conversation-history section.
- [x] The send button keeps a stable width and does not shift the composer when its label changes to `Reading...`.

## Verification Note

Focused Biome, full typecheck, full tests, and full build pass. The provider-backed chat path requires the configured LLM environment at runtime. The aggregate `pnpm eval` command retains its known unrelated legacy CLI acceptance failure because that acceptance script invokes removed `ticket` commands.

## Resolved Decisions

- Chat remains inside the ticket canvas and is not the primary dashboard navigation.
- The baseline is assembled server-side from canonical domain data.
- The agent may explain and draft proposal changes, but only existing proposal approval applies canonical requirements.
- Use the existing Anvia/Trachex agent path and installed dependencies; do not add another chat framework.
- Use the existing SQLite session/message repository for UI history. Anvia memory is useful for agent turn context, but it is not the source of truth for rendering chat history.

## Resolved UX Clarification

The chat card should use a two-part layout:

```text
Chat header: New Chat + previous session selector/list
Conversation: messages for the selected session
Composer: ask the ticket assistant
```

The previous session list belongs inside the chat panel or its compact drawer, not as a new global dashboard navigation surface.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
