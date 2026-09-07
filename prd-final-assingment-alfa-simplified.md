# Trachex — Development Tracking Assistant

> **Trachex turns changing software requirements into a traceable, agent-readable development checklist.**

## 1. Problem

In a typical Agile/Scrum workflow, requirements don't only come from BRD/FSD documents.

They can change through:

* FSD/BRD revisions
* Teams/Slack/chat messages
* Meeting notes (MoM)
* BA clarifications
* UAT feedback

The problem is that these changes are usually scattered across different places.

This creates three major issues:

1. **Requirement drift is hard to track**

   * What was originally requested?
   * What changed?
   * Who requested the change?
   * What is the actual requirement now?

2. **Developers and AI coding agents lack context**

   * A coding agent may receive the latest FSD, but not the clarification that came later in a chat.
   * Developers repeatedly need to explain the same context when starting planning or switching tools.

3. **There is no clean development history**

   * When the feature is ready for testing, there is usually no single artifact showing what was implemented, what changed, and what should be tested.

---

# 2. Solution

Trachex maintains **one development checklist per ticket**.

The checklist starts from the original BRD/FSD and continuously grows as new requirements or adjustments appear.

Each item keeps its:

* Requirement
* Source
* Timestamp
* Status
* Impacted services/APIs/pages
* Relationship to previous requirements

Nothing is silently overwritten or deleted.

This creates a simple chain:

```text
Original Requirement
        ↓
Development Checklist
        ↓
Requirement Changes
        ↓
Current State
        ↓
Development Summary
```

---

# 3. How It Works

```text
┌──────────────────────────────┐
│  1. Project Context          │
│  Coding standards, policies, │
│  architecture, AGENTS.md    │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│  2. Ticket + BRD/FSD         │
│  Feed the initial requirement│
│  into Trachex                │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│  3. LLM extracts requirements│
│  → generates checklist       │
│  → identifies impacted areas │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│  4. Developer develops       │
│  Developer manually checks   │
│  completed items             │
└──────────────┬───────────────┘
               ↓
        New requirement?
               │
              Yes
               ↓
┌──────────────────────────────┐
│  5. Add Adjustment            │
│  Chat / MoM / UAT / new FSD  │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│  6. LLM reconciles changes   │
│  Detect new requirements and │
│  contradictions              │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│  7. Ready for testing        │
│  Export Development Summary  │
└──────────────────────────────┘
```

---

# 4. Example

### Initial Requirement

```bash
trachex ticket new TICKET-1234 \
  --fsd FSD-Loyalty-Program-v1.2.md
```

Trachex extracts:

```text
[ ] Validate loyalty tier before applying discount
    services: front-office-service, config-service
    source: FSD v1.2 §4.2
```

### Requirement Changes

A BA later sends a chat:

```text
"Discount cap should be 15%, not 20%.
VIP tier is exempt."
```

Instead of modifying the original requirement:

```bash
trachex adjustment TICKET-1234 \
  --from "Budi (BA)" \
  --source chat \
  --note "discount cap should be 15%, not 20%, VIP tier exempt"
```

Trachex adds:

```text
[ ] Discount cap = 15%, VIP tier exempt
    source: chat, Budi (BA), 2026-09-06
    supersedes: item-001
```

The original requirement remains in history:

```text
item-001 [SUPERSEDED]

Discount cap = 20%, no VIP exemption
source: FSD v1.2
```

But the current checklist only shows the latest valid requirement.

This gives us both:

```text
Current State
     +
Full Requirement History
```

---

# 5. Human-in-the-Loop

Trachex does **not** automatically mark development work as completed.

The developer explicitly checks an item:

```bash
trachex check TICKET-1234 item-002
```

This means:

> A human confirmed that this requirement has been completed.

The LLM can:

* Extract requirements
* Classify requirements
* Detect contradictions
* Identify impacted services/APIs/pages
* Generate test scenarios

But the developer remains responsible for confirming completion.

---

# 6. Agent / MCP Integration

Trachex is designed to work with **MCP-compatible coding agents** such as OpenCode, Claude Code, or other agentic coding harnesses.

The agent can ask Trachex:

### `get_checklist(ticket_id)`

Get the current requirements.

Example:

```text
What is left on this ticket?
What changed?
Which requirements are currently active?
Why does this requirement exist?
```

### `get_baseline(ticket_id)`

Get a complete context pack for development planning:

```text
Current requirements
+ Project context
+ Open questions
+ Requirement history
+ Impacted services/APIs/pages
```

The coding agent can use this as its baseline context before starting development or planning.

Instead of:

```text
Developer → explains ticket → explains architecture
          → explains previous changes → starts planning
```

It becomes:

```text
Developer
    ↓
Coding Agent
    ↓
get_baseline(TICKET-1234)
    ↓
Trachex
    ↓
Complete development context
```

---

# 7. Web UI

The core is agent-first (CLI + MCP server), but a thin React/Next.js frontend is included that talks to the **same MCP server** — no separate backend logic or API surface.

### Setup

* Drag-and-drop upload of FSD/BRD documents and static project knowledge
* BYOK provider selection (Anthropic / OpenAI / Gemini / Ollama) — API key stored locally

### Checklist View

* Notion-like editable blocks: checkbox, title, source tag, impacted-service tags
* Manual check-off only — same rule as the CLI
* Inline "add adjustment" to append a new requirement without leaving the page

### Timeline Graph

* Checklist items plotted chronologically
* `supersedes` links drawn between contradicting items
* Color-coded by source

### Embedded Chatbot

* Runs the same MCP tools as the CLI / agent path in an in-browser agent loop
* Uses the same BYOK key

Export is a button producing the same Markdown that `trachex export` generates.

---

# 8. Development Summary

When the ticket is ready for testing:

```bash
trachex export TICKET-1234
```

Trachex generates a Markdown summary containing:

```text
Development Summary
├── Timeline
├── Current Checklist
├── Services Impacted
├── APIs Changed / Added
├── Pages Impacted
├── Test Scenarios
└── Full Requirement History
```

Example:

```markdown
# Development Summary: TICKET-1234

## Current Checklist

- [x] Discount cap = 15%, VIP tier exempt
- [x] Cashier receipt timezone lookup

## Services Impacted

- front-office-service
- config-service

## APIs Changed

- `POST /checkout/apply-discount`
  - Added `vipExempt` flag

## Pages Impacted

- Checkout summary page

## Test Scenarios

- VIP customer at the previous 20% cap
- Non-VIP customer reaching the discount cap
- Cashier receipt timezone validation

## Requirement History

- item-001 — Discount cap 20%, no VIP exemption
  - Source: FSD v1.2
  - Status: Superseded

- item-002 — Discount cap 15%, VIP exempt
  - Source: BA chat
  - Status: Current
```

This can then be attached to Jira or shared with QA/BA.

---

# 9. Why AI Is Needed

Trachex is not just a checklist application.

The LLM handles the parts that are difficult to maintain manually:

### Requirement Extraction

Turn a BRD/FSD into actionable development requirements.

### Requirement Reconciliation

Understand whether a new adjustment:

```text
adds a new requirement
        or
clarifies an existing requirement
        or
contradicts an existing requirement
```

For example:

```text
Old:
Discount cap = 20%

New:
Discount cap = 15%

→ supersedes old requirement
```

### Impact Classification

Identify likely:

```text
Services
APIs
Pages
```

affected by each requirement.

### Development Context

Turn the accumulated ticket history into structured context that a coding agent can consume.

---

# 10. RAG / Grounding

Trachex has two types of knowledge.

### Static Project Context

Examples:

```text
AGENTS.md
PROJECT.md
Coding standards
Architecture documentation
Service conventions
```

This helps the LLM understand **how the project should be developed**.

### Ticket Change Records

Examples:

```text
Original FSD requirements
BA adjustments
MoM decisions
UAT feedback
Requirement changes
```

This helps Trachex understand **what the ticket actually requires now**.

```text
                Trachex
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
Static Context          Ticket History
        │                     │
        ↓                     ↓
How to build            What to build
        │                     │
        └──────────┬──────────┘
                   ↓
          Development Context
```

---

# 11. MVP

The MVP focuses on one developer and one ticket at a time.

### Included

* CLI
* MCP server
* Web UI (thin MCP client — setup, checklist view, timeline graph, embedded chatbot)
* BRD/FSD ingestion
* Requirement extraction
* Append-only checklist
* Requirement adjustments
* Superseded requirement detection
* Manual checklist completion
* Impact classification
* Development Summary export
* RAG over project context and ticket history
* BYOK LLM providers

### Storage

Default:

```text
SQLite + local vector index
```

No Docker or external infrastructure required.

Optional:

```text
Postgres + Qdrant
```

for persistent storage across machines.

### LLM Providers

Provider-agnostic:

```text
OpenAI
Anthropic
Gemini
Ollama
```

Users bring their own API key.

---

# 12. Success Criteria

The MVP is successful if we can demonstrate one complete real-world ticket:

```text
FSD
 ↓
Trachex
 ↓
Initial Checklist
 ↓
Developer Development
 ↓
Requirement Adjustment
 ↓
Trachex detects change
 ↓
Developer checks items
 ↓
Development Summary
```

Key metrics:

* Initial checklist generated in under 2 minutes
* ≥85% accuracy for impacted-service classification
* 100% of adjustments produce a source + timestamp
* Correctly detect direct requirement conflicts
* Complete at least one real ticket end-to-end

---

# 13. Future Enhancements

Not part of the MVP:

* Jira integration
* Slack/Discord bot
* Team/multi-user support
* Git branch / commit verification
* Multi-repository impact graph
* Feature-level rollup across multiple tickets

---

# 14. One-Liner

> **Trachex is a development traceability layer that keeps requirements, changes, and development context synchronized for both developers and AI coding agents.**
