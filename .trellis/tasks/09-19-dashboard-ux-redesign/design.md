# Evidence Desk Dashboard Design

## Design Read

Reading this as: a developer requirements workspace for engineers and AI-assisted implementation, in an editorial evidence-desk visual language, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

## Design Boundary

The current dashboard behavior works but its shell and route composition do not express the product's evidence-first identity. The redesign changes the dashboard presentation and interaction hierarchy only. Existing API contracts, domain operations, proposal editing, approval, completion, export, chat, and adjustment behavior remain unchanged.

## Visual System

- Charcoal application shell carries the landing page identity and separates navigation from work surfaces.
- Warm document surface keeps long checklist and proposal content readable.
- Amber is reserved for pending review, selected navigation, and the current human decision point.
- Zinc neutrals provide hierarchy through text, spacing, and borders rather than multiple status colors.
- Typography remains readable and editorial, using the existing sans-serif stack; no new type dependency is needed.
- Motion stays at MOTION 1: hover/focus transitions only, with no decorative loops or staged dashboard animation.

## Information Architecture

```text
Charcoal shell
├── compact product/project navigation
├── project or ticket context rail
└── warm work surface
    ├── ticket identity and next action
    ├── current checklist as the focal object
    ├── pending proposal review callout
    └── contextual evidence rail or mobile tabs
```

### Projects

Projects become a calm index rather than a CRUD wall. The page should establish the project list as the user's entry point and place project creation behind a compact action surface, while preserving the current create behavior and empty/error states.

### Tickets

The project page should establish project identity, ticket list, and the next useful action. Ticket rows should prioritize ticket key/title and real state information available from the API, without inventing progress or activity metrics.

### Ticket Canvas

The ticket canvas gets the strongest treatment:

- Header: breadcrumb, ticket identity, export actions, and one clear pending-review signal when available.
- Center: current checklist with completion as the primary action.
- Proposal: visually distinct review callout, proposal-first content, focused editing, and explicit approval/rejection.
- Evidence rail: context, history, and chat remain secondary and switchable. On mobile they become tabs or stacked sections in task order.
- Adjustment composer: remains available inline but should not dominate the initial checklist view.

## Component Boundaries

Expected frontend work should remain inside the dashboard routes and shared utility styles for the first pass. New visual primitives may be extracted only when a repeated pattern appears across projects, tickets, and the canvas. No second component library is introduced.

## Responsive Behavior

- Desktop: shell navigation and evidence rail remain visible; checklist gets the most width.
- Tablet: evidence rail becomes a compact tab row; checklist remains the primary column.
- Mobile: single-column task flow ordered as ticket header, pending proposal, checklist, adjustment, then context/history/chat tabs.
- Controls maintain comfortable touch targets and visible focus states.

## Risks And Trade-offs

- A darker shell introduces a theme boundary between navigation and document surfaces; contrast must be checked for every interactive state.
- Restyling the ticket canvas across one large route can create regressions; preserve data flow and interaction functions while changing composition incrementally.
- Project/ticket index pages have limited backend state today, so the redesign must avoid invented counts, activity, or progress.
