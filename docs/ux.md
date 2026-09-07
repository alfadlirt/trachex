# Trachex UX Direction

## Product Shape

Trachex is a focused ticket canvas, not a generic dashboard and not a chat application. The primary object is the current development checklist. Every surrounding surface should answer one of four questions:

- What must be built?
- Why is it required?
- What changed?
- What still needs human confirmation?

The visual language should be calm, document-oriented, and dense enough for engineering work without looking like an enterprise admin template.

## Information Architecture

Routes are ticket-centric:

```text
/projects
/projects/:projectId
/projects/:projectId/tickets/:ticketKey
/projects/:projectId/tickets/:ticketKey?panel=history
/projects/:projectId/tickets/:ticketKey?panel=chat
```

Routes stay thin. Feature modules own data loading, state, and composition.

Suggested UI modules:

```text
src/modules/
├── projects/
├── tickets/
├── checklist/
├── proposals/
├── sources/
├── timeline/
├── impacts/
├── chat/
└── export/
```

## Primary Ticket Canvas

Desktop layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ project / ticket breadcrumb       status     export           │
├───────────────┬──────────────────────────────┬───────────────┤
│ ticket list   │ current checklist             │ context panel │
│ project nav   │ progress + filters            │ source        │
│               │ requirement cards             │ impacts       │
│               │ pending proposal callouts    │ history       │
├───────────────┴──────────────────────────────┴───────────────┤
│ contextual chat drawer / adjustment composer                  │
└──────────────────────────────────────────────────────────────┘
```

The center column is the visual anchor. The right panel is inspectable context, not a second competing workspace. Chat opens deliberately from a button or keyboard shortcut and remains tied to the selected ticket.

Mobile layout:

- Single-column checklist.
- Project/ticket navigation in a drawer.
- Context and history in bottom sheets or tabs.
- Chat in a full-height sheet.
- Requirement metadata collapses below the title.
- Completion action remains visible and reachable.

## Checklist Interaction

Checklist items are custom structured components, not generic editor blocks. Each item displays:

- human completion checkbox
- title and concise requirement text
- lifecycle badge: active or superseded
- source chip with author/type and location
- impacted service/API/page chips
- relationship indicator such as “supersedes item-001”
- optional test-scenario disclosure
- overflow actions for history and proposal provenance

Unchecked and checked are visually distinct but not overly saturated. Superseded items leave the current checklist and remain available through history; never hide provenance from a user who is investigating change.

## Proposal Review

Pending proposals are first-class review objects. The review card should show:

- source note and exact snapshot reference
- model-suggested change
- affected existing requirements
- proposed relationship, especially supersession
- impacted-area changes
- confidence or rationale only when it is useful and clearly labeled as model output
- original and edited proposal versions

Actions are explicit: `Approve`, `Reject`, `Edit proposal`. Approval must explain what canonical records will be created or superseded before the final click.

## Adjustment Flow

The shortest path is an inline action in the ticket header or checklist:

1. Click `Add adjustment`.
2. Select source type and enter attribution.
3. Write the note in a BlockNote editor or paste content.
4. Submit for reconciliation.
5. Review resulting proposal cards in place.

BlockNote is valuable here for headings, pasted meeting notes, links, and readable source content. The saved note is versioned and linked to the proposal; it does not replace structured requirements.

## Timeline And History

The history panel is chronological and filterable by source type, repository/service, and status. The MVP may render relationships as a vertical timeline with connecting lines rather than a freeform graph. A graph view can be added after relationship data proves useful.

Each event should answer:

- what changed
- when the source event happened
- when Trachex ingested it
- who supplied it
- which requirement was created, revised, or superseded
- whether a human approved it

## Embedded Chat

Chat is an assistant for the ticket canvas, not the primary navigation model. It can:

- explain current requirements
- summarize changes
- identify open questions
- retrieve project context
- draft an adjustment proposal
- show pending proposals

It cannot silently apply changes or check items. Tool results should appear as compact, inspectable cards with links back to the affected requirement or proposal.

## Setup Experience

First-run setup should be short:

1. Create or select a project.
2. Register repositories/services and their paths.
3. Select context files/directories explicitly.
4. Configure a provider profile or confirm environment variables.
5. Create the first ticket and upload/paste its source.

Avoid a large settings dashboard. Provider setup, repositories, and context can be compact setup screens accessible from the project menu.

## Visual System

- Tailwind CSS v4 for layout and tokens.
- Selective shadcn/Radix primitives for dialogs, tabs, popovers, tooltips, command menus, and drawers.
- CVA for stateful requirement/proposal variants.
- Lucide icons with text labels for important actions.
- Typography that prioritizes readable document text over oversized marketing headings.
- Restrained color coding: source type and lifecycle status should be distinguishable without relying on color alone.
- Use borders, spacing, and subtle background shifts to create hierarchy rather than many cards and shadows.

## Accessibility And Feedback

- Keyboard navigation for checklist review and approval.
- Focus returns to the triggering control after drawers/dialogs close.
- Every async operation shows progress and a recoverable error.
- Proposal approval confirms the exact mutation.
- Completion checkbox announces current state and actor/timestamp after mutation.
- Timeline relationships have text alternatives.
- Empty states explain the next useful action, not just that data is absent.

## UI Non-Goals

- No general-purpose Notion clone.
- No full block editor for requirements.
- No dashboard KPI wall before the ticket canvas is useful.
- No chat-first landing page.
- No second UI component library beyond selective primitives.
- No mobile-specific application; responsive composition is sufficient.
