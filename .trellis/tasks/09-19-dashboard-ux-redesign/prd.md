# Dashboard UX redesign analysis

## Goal

Analyze the dashboard's current UX and visual relationship to the landing page, identify boring or generic areas, and propose a focused redesign direction before implementation.

## Confirmed Product And Visual Direction

- The landing page uses a near-black `zinc-950` canvas, warm amber accent, restrained borders, editorial spacing, readable sans-serif typography, evidence/timeline storytelling, and minimal motion.
- The dashboard uses a separate light `zinc-50`/white shell with a plain header, generic text navigation, thin bordered cards, default form rows, and mostly inline route-level composition.
- The product UX direction says Trachex is a focused ticket canvas, not a generic dashboard or chat application. The current checklist should remain the visual anchor and surrounding surfaces should answer what must be built, why, what changed, and what needs human confirmation.
- The dashboard has real data and functional interactions, but its visual hierarchy is weak: projects, tickets, checklist, proposals, context, history, chat, and export controls compete without a strong focal sequence.

## Current Boring Or Generic Areas

### 1. Dashboard shell does not belong to the landing page

`apps/dashboard/src/routes/__root.tsx` switches from the landing page's editorial dark language to a generic white application header. The wordmark, navigation, spacing, border treatment, and color hierarchy feel like a separate starter template rather than the same product.

### 2. Projects page is a CRUD list without a point of view

`apps/dashboard/src/routes/projects.tsx` presents a heading, two inputs, a Create button, and a plain list of bordered rows. It does not help the user understand project scope, recent work, or how to enter the requirement-tracking workflow. The create form is always visible and gives the page no calm starting state.

### 3. Tickets page repeats the same CRUD pattern

`apps/dashboard/src/routes/projects.$projectId.tsx` repeats the same heading/form/list treatment. Project context, ticket identity, progress, proposal state, and next action are not visually prioritized.

### 4. Ticket canvas is feature-rich but visually flat

`apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx` contains the most valuable product surface, but it currently reads as a long stack of white bordered boxes. The checklist, pending proposal review, adjustment form, impacts, history, chat, and export actions all use similar visual weight.

### 5. Proposal review still has too much simultaneous information

The proposal review is now readable and editable, but it remains embedded in the main flow with source metadata, draft content, editor controls, and approval actions appearing together. It needs stronger review sequencing: understand the proposed change first, edit only when needed, then approve.

### 6. The current visual language lacks a dashboard identity motif

The landing page has evidence, timeline, amber selection, and document-like narrative. The dashboard has no equivalent repeated gesture. It uses generic rounded cards and utility controls without a distinctive relationship between evidence, current state, and human action.

### 7. Mobile composition is functional but not yet intentional

The route layout collapses to a single column, but the current implementation does not clearly establish mobile priorities for checklist, proposal review, context/history, chat, and adjustment entry. It is responsive by wrapping rather than by deliberate task sequencing.

## What Should Not Change

- Keep the checklist as the center of the ticket experience.
- Keep the dashboard minimal rather than adding KPI cards, charts, or a generic admin sidebar.
- Keep explicit human approval and completion actions.
- Keep the existing API/domain behavior for this analysis task.
- Do not copy the landing page literally; carry over its tone, palette, typography, restraint, and evidence-oriented hierarchy into an application layout.

## Candidate Design Directions

### Direction A: Evidence Desk (recommended)

Carry the landing page's evidence narrative into the app. Use a dark shell, warm amber only for pending/current states, a narrow project/ticket rail, and a light or warm document surface for the checklist. The ticket page becomes a working evidence desk: current checklist in the center, proposal review as a prominent but contained callout, and history/context as a secondary inspection rail.

Trade-off: strongest product identity and clearest connection to the landing page, but requires the most coordinated shell and ticket-canvas restyling.

### Direction B: Paper On Charcoal

Keep the dashboard mostly light for long-form reading, but put it inside a dark charcoal shell that matches the landing page. Use amber for selected navigation and review states, with document-like checklist cards and a quiet timeline motif. Projects and tickets become simple index pages inside the same frame.

Trade-off: safer for dense engineering content and easier to read, but the product identity is carried more by framing than by the surfaces themselves.

### Direction C: Quiet Workbench

Keep the current light canvas but replace the generic CRUD treatment with a strong typographic system, compact command-like navigation, deliberate whitespace, and an amber evidence rail. The landing page's dark theme appears in the header, selected states, and proposal review rather than across the whole application.

Trade-off: smallest visual migration and lowest contrast risk, but the dashboard will feel less visibly connected to the landing page than Directions A or B.

## Analysis Acceptance Criteria

- [x] Landing page visual language and dashboard implementation are compared with file-backed evidence.
- [x] Boring/generic areas are identified by route and interaction, not only by aesthetic opinion.
- [x] Product UX non-goals and invariants are preserved.
- [x] At least three bounded redesign directions include trade-offs.
- [ ] User selects a direction or requests a hybrid before design artifacts and implementation begin.

## Resolved Product Decision

Direction A, **Evidence Desk**, is approved for planning. The dashboard will use a charcoal shell, warm document surfaces for dense engineering content, restrained amber for pending/current states, and a secondary evidence rail for source, impact, and history context. The landing page's tone and motif will carry into the application without copying its marketing layout literally.

The redesign remains focused on visual hierarchy and interaction clarity. It will not add KPI cards, charts, generic admin-dashboard sections, Git/repository scanning, new backend behavior, or a chat-first layout.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
