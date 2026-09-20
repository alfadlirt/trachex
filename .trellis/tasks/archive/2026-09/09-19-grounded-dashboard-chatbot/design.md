# Grounded Dashboard Chatbot Design

## Boundary

The behavior gap is between the ticket canvas chat input and the existing Trachex agent/application contracts. The API owns baseline assembly and agent invocation. The dashboard owns stream presentation and resilient JSONL decoding. Canonical checklist state remains owned by domain proposal approval.

Chat history has two concerns: persisted UI transcript and model turn context. The existing `ChatSession`/`ChatMessage` repository is the canonical transcript for this local dashboard. A ticket owns many sessions; each session has a generated ID, a human-readable title/preview derived from its first user message, timestamps, and messages. Anvia memory may be attached later for richer multi-turn model context, but should not replace the persisted transcript or be required to render it.

## Data Flow

```text
Browser message
  -> POST /api/chat/:projectId/:ticketKey
  -> validate project/ticket
  -> assemble stored ticket baseline
  -> agent with search/evidence instructions
  -> JSONL response events
  -> browser line buffer/parser
  -> selected ChatSession
  -> persisted user/assistant messages
  -> assistant Markdown + evidence/error state
```

## Server Contract

The existing route remains JSONL. Events should have a stable shape:

```ts
{ type: 'start'; ticketKey: string }
{ type: 'text'; text: string }
{ type: 'evidence'; source: string; location?: string; excerpt?: string }
{ type: 'error'; error: string }
{ type: 'done' }
```

The agent prompt receives a serialized baseline and user question. It must answer only from the baseline/search evidence, explicitly state uncertainty, and explain that requirement changes become pending proposals. If mutation tools are not wired into this route in the first implementation, the UI should direct users to the adjustment flow rather than pretending chat applied a change.

## Prompt Rules

- You are a ticket-context assistant, not a generic assistant.
- Answer what the stored baseline supports.
- Cite or name source/requirement evidence when possible.
- Do not invent owners, causes, dates, implementation status, repository details, or confidence percentages.
- If evidence is insufficient, say so and direct the user to add a clarification or use the adjustment flow.
- Never mark requirements complete or silently apply changes.

## Frontend Stream Handling

Maintain a `buffer` across `ReadableStream` reads. Append decoded text, split only complete newline-delimited records, retain the final partial line, and parse remaining buffered content on stream completion if it is a complete JSON record. Map `text`, `evidence`, `error`, and `done` events to visible state.

## UX States

- Empty: explain what the ticket assistant can answer and show example questions based on the real ticket.
- Loading: show an explicit “Reading the ticket evidence” state and disable duplicate send.
- Response: render readable assistant text and evidence references.
- Error: explain the stream/agent failure and leave the composer usable for retry.
- History: load the ticket session/messages when Chat is opened or the ticket is loaded.
- Session list: show a compact previous-conversations list with `New Chat`, selected state, preview, and last-updated time.
- New session: create a new server session before the first message so the conversation has stable identity.
- Conversation history: keep the active transcript in the Chat tab and previous conversations in the dedicated Sessions tab. Each session entry shows a title/preview and can be selected without mixing transcripts.
- Composer stability: reserve a fixed button width for `Ask` and `Reading...` so async state does not move the input.

## Risks And Trade-offs

- Supplying the full baseline increases prompt size, but it makes the MVP deterministic and grounded; retrieval remains available through the existing search tool.
- Streaming agent output may require adapting the current `RunAgentFn`, which returns structured proposal output. Keep a small API-local answer seam or a dedicated text-agent function rather than weakening proposal schemas.
- Chat mutation support can be deferred to the existing adjustment composer; the critical MVP value is grounded explanation with safe handoff.
- Lightweight Markdown rendering must escape HTML and support only the small syntax needed for readable assistant output.
- The chat panel should use a wider layout allocation than the current narrow right rail; on desktop it can use a wider evidence column or an overlay/drawer, while on mobile it remains full-width.
